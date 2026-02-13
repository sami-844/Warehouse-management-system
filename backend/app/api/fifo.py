"""
FIFO Stock Rotation API — Phase 5b
Tracks inventory by batch. Always suggests oldest-expiry-first for issuing.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
import sqlite3, os

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "warehouse.db")


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# ── List All Batches ──
@router.get("/batches")
def list_batches(
    product_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    status: str = "active",
    limit: int = 200
):
    """List batches ordered by expiry date (FIFO order). Nearest expiry first."""
    conn = get_db()
    where = ["bi.status = ?"]
    params = [status]

    if product_id:
        where.append("bi.product_id = ?")
        params.append(product_id)
    if warehouse_id:
        where.append("bi.warehouse_id = ?")
        params.append(warehouse_id)

    where_clause = " AND ".join(where)
    rows = conn.execute(f"""
        SELECT bi.*, p.name as product_name, p.sku, p.barcode, p.unit_of_measure,
               w.name as warehouse_name
        FROM batch_inventory bi
        JOIN products p ON bi.product_id = p.id
        LEFT JOIN warehouses w ON bi.warehouse_id = w.id
        WHERE {where_clause} AND bi.quantity_remaining > 0
        ORDER BY bi.expiry_date ASC NULLS LAST, bi.received_date ASC
        LIMIT ?
    """, params + [limit]).fetchall()
    conn.close()

    batches = []
    today = date.today()
    for r in rows:
        b = dict(r)
        # Calculate days until expiry
        if b.get("expiry_date"):
            try:
                exp = datetime.strptime(b["expiry_date"][:10], "%Y-%m-%d").date()
                b["days_until_expiry"] = (exp - today).days
            except:
                b["days_until_expiry"] = None
        else:
            b["days_until_expiry"] = None
        batches.append(b)

    return {"batches": batches, "total": len(batches)}


# ── FIFO Pick Suggestion ──
@router.get("/suggest/{product_id}")
def suggest_fifo_picks(product_id: int, quantity: float = Query(..., gt=0)):
    """
    Given a product and desired quantity, suggest which batches to pick
    following FIFO (nearest expiry first, then oldest received first).
    """
    conn = get_db()
    batches = conn.execute("""
        SELECT bi.*, p.name as product_name, p.sku, p.unit_of_measure
        FROM batch_inventory bi
        JOIN products p ON bi.product_id = p.id
        WHERE bi.product_id = ? AND bi.status = 'active' AND bi.quantity_remaining > 0
        ORDER BY bi.expiry_date ASC NULLS LAST, bi.received_date ASC
    """, (product_id,)).fetchall()
    conn.close()

    picks = []
    remaining_need = quantity
    today = date.today()

    for b in batches:
        if remaining_need <= 0:
            break
        b = dict(b)
        pick_qty = min(b["quantity_remaining"], remaining_need)

        days_exp = None
        if b.get("expiry_date"):
            try:
                exp = datetime.strptime(b["expiry_date"][:10], "%Y-%m-%d").date()
                days_exp = (exp - today).days
            except:
                pass

        picks.append({
            "batch_id": b["id"],
            "batch_number": b["batch_number"],
            "quantity_available": b["quantity_remaining"],
            "pick_quantity": pick_qty,
            "expiry_date": b["expiry_date"],
            "days_until_expiry": days_exp,
            "received_date": b["received_date"],
            "cost_price": b["cost_price"],
            "warehouse_id": b["warehouse_id"],
        })
        remaining_need -= pick_qty

    return {
        "product_id": product_id,
        "requested_quantity": quantity,
        "picks": picks,
        "total_available": sum(p["quantity_available"] for p in picks),
        "total_picked": sum(p["pick_quantity"] for p in picks),
        "shortfall": max(0, remaining_need),
        "fully_satisfiable": remaining_need <= 0,
    }


# ── Issue Stock (FIFO) ──
class FIFOIssueItem(BaseModel):
    batch_id: int
    quantity: float

class FIFOIssueRequest(BaseModel):
    product_id: int
    picks: List[FIFOIssueItem]
    reason: str = "sales_order"
    reference: str = ""

@router.post("/issue")
def issue_fifo(req: FIFOIssueRequest):
    """
    Issue stock from specific batches. Call /suggest first to get the picks,
    then POST them here to execute the issue.
    """
    conn = get_db()
    issued = []

    for pick in req.picks:
        batch = conn.execute(
            "SELECT * FROM batch_inventory WHERE id = ? AND status = 'active'",
            (pick.batch_id,)
        ).fetchone()
        if not batch:
            conn.close()
            raise HTTPException(404, f"Batch {pick.batch_id} not found or not active")
        if batch["quantity_remaining"] < pick.quantity:
            conn.close()
            raise HTTPException(400,
                f"Batch {pick.batch_id} has only {batch['quantity_remaining']} remaining, "
                f"but {pick.quantity} requested")

        new_remaining = round(batch["quantity_remaining"] - pick.quantity, 3)
        new_status = "depleted" if new_remaining <= 0 else "active"

        conn.execute("""
            UPDATE batch_inventory
            SET quantity_remaining = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (new_remaining, new_status, pick.batch_id))

        # Also record as inventory transaction if the table exists
        try:
            conn.execute("""
                INSERT INTO inventory_transactions
                (product_id, warehouse_id, transaction_type, quantity, unit_cost,
                 reference_number, notes, transaction_date, created_by)
                VALUES (?, ?, 'issue', ?, ?, ?, ?, ?, 1)
            """, (req.product_id, batch["warehouse_id"], pick.quantity,
                  batch["cost_price"], req.reference,
                  f"FIFO issue from batch {batch['batch_number']} — {req.reason}",
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        except Exception:
            pass  # inventory_transactions table might have different schema

        issued.append({
            "batch_id": pick.batch_id,
            "batch_number": batch["batch_number"],
            "issued_quantity": pick.quantity,
            "remaining_after": new_remaining,
            "status": new_status,
        })

    conn.commit()
    conn.close()

    return {
        "message": f"Issued {len(issued)} batch(es) for product {req.product_id}",
        "issued": issued,
        "total_issued": sum(i["issued_quantity"] for i in issued),
    }


# ── Receive New Batch ──
@router.post("/receive")
def receive_batch(
    product_id: int = Query(...),
    quantity: float = Query(..., gt=0),
    warehouse_id: int = Query(default=1),
    batch_number: str = Query(default=""),
    cost_price: float = Query(default=0),
    expiry_date: str = Query(default=""),
    supplier_id: Optional[int] = Query(default=None),
    purchase_order_id: Optional[int] = Query(default=None),
    notes: str = Query(default=""),
):
    """Receive a new batch of stock into the FIFO system."""
    conn = get_db()

    if not batch_number:
        batch_number = f"B-{product_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    received_date = datetime.now().strftime("%Y-%m-%d")

    conn.execute("""
        INSERT INTO batch_inventory
        (product_id, warehouse_id, batch_number, quantity_received, quantity_remaining,
         cost_price, received_date, expiry_date, supplier_id, purchase_order_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (product_id, warehouse_id, batch_number, quantity, quantity,
          cost_price, received_date, expiry_date or None,
          supplier_id, purchase_order_id, notes))

    batch_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    # Also record receipt transaction
    try:
        conn.execute("""
            INSERT INTO inventory_transactions
            (product_id, warehouse_id, transaction_type, quantity, unit_cost,
             reference_number, notes, transaction_date, created_by)
            VALUES (?, ?, 'receipt', ?, ?, ?, ?, ?, 1)
        """, (product_id, warehouse_id, quantity, cost_price, batch_number,
              f"FIFO batch received: {notes}", received_date))
    except Exception:
        pass

    conn.commit()
    conn.close()

    return {
        "message": f"Batch {batch_number} received with {quantity} units",
        "batch_id": batch_id,
        "batch_number": batch_number,
    }


# ── Expiring Soon ──
@router.get("/expiring")
def expiring_batches(days: int = Query(default=30, ge=1)):
    """Get batches expiring within N days."""
    conn = get_db()
    today = date.today()
    cutoff = today.strftime("%Y-%m-%d")

    # SQLite date comparison — get everything with expiry_date <= today + N days
    from datetime import timedelta
    future = (today + timedelta(days=days)).strftime("%Y-%m-%d")

    rows = conn.execute("""
        SELECT bi.*, p.name as product_name, p.sku, p.unit_of_measure,
               w.name as warehouse_name
        FROM batch_inventory bi
        JOIN products p ON bi.product_id = p.id
        LEFT JOIN warehouses w ON bi.warehouse_id = w.id
        WHERE bi.status = 'active' AND bi.quantity_remaining > 0
          AND bi.expiry_date IS NOT NULL AND bi.expiry_date <= ?
        ORDER BY bi.expiry_date ASC
    """, (future,)).fetchall()
    conn.close()

    result = []
    for r in rows:
        b = dict(r)
        try:
            exp = datetime.strptime(b["expiry_date"][:10], "%Y-%m-%d").date()
            b["days_until_expiry"] = (exp - today).days
            b["is_expired"] = (exp - today).days < 0
        except:
            b["days_until_expiry"] = None
            b["is_expired"] = False
        result.append(b)

    return {
        "batches": result,
        "total": len(result),
        "days_window": days,
        "already_expired": sum(1 for b in result if b.get("is_expired")),
    }


# ── FIFO Summary ──
@router.get("/summary")
def fifo_summary():
    """Dashboard summary for FIFO stock status."""
    conn = get_db()
    today = date.today().strftime("%Y-%m-%d")

    total_batches = conn.execute(
        "SELECT COUNT(*) FROM batch_inventory WHERE status='active' AND quantity_remaining > 0"
    ).fetchone()[0]

    expired = conn.execute(
        "SELECT COUNT(*) FROM batch_inventory WHERE status='active' AND quantity_remaining > 0 AND expiry_date < ?",
        (today,)
    ).fetchone()[0]

    from datetime import timedelta
    exp_7 = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
    exp_30 = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")

    expiring_7d = conn.execute(
        "SELECT COUNT(*) FROM batch_inventory WHERE status='active' AND quantity_remaining > 0 AND expiry_date BETWEEN ? AND ?",
        (today, exp_7)
    ).fetchone()[0]

    expiring_30d = conn.execute(
        "SELECT COUNT(*) FROM batch_inventory WHERE status='active' AND quantity_remaining > 0 AND expiry_date BETWEEN ? AND ?",
        (today, exp_30)
    ).fetchone()[0]

    total_value = conn.execute(
        "SELECT COALESCE(SUM(quantity_remaining * cost_price), 0) FROM batch_inventory WHERE status='active'"
    ).fetchone()[0]

    conn.close()
    return {
        "total_active_batches": total_batches,
        "already_expired": expired,
        "expiring_within_7_days": expiring_7d,
        "expiring_within_30_days": expiring_30d,
        "total_stock_value": round(total_value, 3),
    }
