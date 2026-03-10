"""
FIFO Stock Rotation API — Phase 5b
Tracks inventory by batch. Always suggests oldest-expiry-first for issuing.
Migrated from SQLite3 to SQLAlchemy (PostgreSQL compatible).
Note: batch_inventory table may not exist in all deployments — all endpoints
handle this gracefully.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta
from sqlalchemy import text
from app.core.database import engine

router = APIRouter()


def run_q(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


def run_s(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        row = result.fetchone()
        return row[0] if row and row[0] is not None else 0


# ── List All Batches ──
@router.get("/batches")
def list_batches(
    product_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    status: str = "active",
    limit: int = 200
):
    try:
        where = ["bi.status = :status", "bi.quantity_remaining > 0"]
        params: dict = {"status": status, "limit": limit}

        if product_id:
            where.append("bi.product_id = :product_id")
            params["product_id"] = product_id
        if warehouse_id:
            where.append("bi.warehouse_id = :warehouse_id")
            params["warehouse_id"] = warehouse_id

        rows = run_q(f"""
            SELECT bi.*, p.name as product_name, p.sku, p.barcode, p.unit_of_measure,
                   w.name as warehouse_name
            FROM batch_inventory bi
            JOIN products p ON bi.product_id = p.id
            LEFT JOIN warehouses w ON bi.warehouse_id = w.id
            WHERE {" AND ".join(where)}
            ORDER BY bi.expiry_date ASC NULLS LAST, bi.received_date ASC
            LIMIT :limit
        """, params)
    except Exception:
        return {"batches": [], "total": 0}

    today = date.today()
    batches = []
    for b in rows:
        if b.get("expiry_date"):
            try:
                exp = datetime.strptime(str(b["expiry_date"])[:10], "%Y-%m-%d").date()
                b["days_until_expiry"] = (exp - today).days
            except Exception:
                b["days_until_expiry"] = None
        else:
            b["days_until_expiry"] = None
        batches.append(b)

    return {"batches": batches, "total": len(batches)}


# ── FIFO Pick Suggestion ──
@router.get("/suggest/{product_id}")
def suggest_fifo_picks(product_id: int, quantity: float = Query(..., gt=0)):
    try:
        batches = run_q("""
            SELECT bi.*, p.name as product_name, p.sku, p.unit_of_measure
            FROM batch_inventory bi
            JOIN products p ON bi.product_id = p.id
            WHERE bi.product_id = :pid AND bi.status = 'active' AND bi.quantity_remaining > 0
            ORDER BY bi.expiry_date ASC NULLS LAST, bi.received_date ASC
        """, {"pid": product_id})
    except Exception:
        batches = []

    picks = []
    remaining_need = quantity
    today = date.today()

    for b in batches:
        if remaining_need <= 0:
            break
        pick_qty = min(float(b["quantity_remaining"]), remaining_need)
        days_exp = None
        if b.get("expiry_date"):
            try:
                exp = datetime.strptime(str(b["expiry_date"])[:10], "%Y-%m-%d").date()
                days_exp = (exp - today).days
            except Exception:
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
    try:
        issued = []
        with engine.begin() as conn:
            for pick in req.picks:
                rows = conn.execute(text(
                    "SELECT * FROM batch_inventory WHERE id = :id AND status = 'active'"
                ), {"id": pick.batch_id}).fetchall()
                if not rows:
                    raise HTTPException(404, f"Batch {pick.batch_id} not found or not active")
                batch = dict(zip(rows[0]._mapping.keys(), rows[0]))
                if float(batch["quantity_remaining"]) < pick.quantity:
                    raise HTTPException(400,
                        f"Batch {pick.batch_id} has only {batch['quantity_remaining']} remaining")

                new_remaining = round(float(batch["quantity_remaining"]) - pick.quantity, 3)
                new_status = "depleted" if new_remaining <= 0 else "active"

                conn.execute(text("""
                    UPDATE batch_inventory
                    SET quantity_remaining = :qty, status = :status
                    WHERE id = :id
                """), {"qty": new_remaining, "status": new_status, "id": pick.batch_id})

                try:
                    conn.execute(text("""
                        INSERT INTO inventory_transactions
                        (product_id, warehouse_id, transaction_type, quantity, unit_cost,
                         reference_number, notes, transaction_date, created_by)
                        VALUES (:pid, :wid, 'issue', :qty, :cost, :ref, :notes, :dt, 1)
                    """), {
                        "pid": req.product_id, "wid": batch["warehouse_id"],
                        "qty": pick.quantity, "cost": batch["cost_price"],
                        "ref": req.reference,
                        "notes": f"FIFO issue from batch {batch['batch_number']} — {req.reason}",
                        "dt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    })
                except Exception:
                    pass

                issued.append({
                    "batch_id": pick.batch_id,
                    "batch_number": batch["batch_number"],
                    "issued_quantity": pick.quantity,
                    "remaining_after": new_remaining,
                    "status": new_status,
                })

        return {
            "message": f"Issued {len(issued)} batch(es) for product {req.product_id}",
            "issued": issued,
            "total_issued": sum(i["issued_quantity"] for i in issued),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, f"FIFO issue failed (batch_inventory may not be set up): {str(e)}")


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
    if not batch_number:
        batch_number = f"B-{product_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    received_date = datetime.now().strftime("%Y-%m-%d")

    try:
        with engine.begin() as conn:
            result = conn.execute(text("""
                INSERT INTO batch_inventory
                (product_id, warehouse_id, batch_number, quantity_received, quantity_remaining,
                 cost_price, received_date, expiry_date, supplier_id, purchase_order_id, notes)
                VALUES (:pid, :wid, :bn, :qty, :qty, :cost, :rdate, :exp, :sup, :po, :notes)
                RETURNING id
            """), {
                "pid": product_id, "wid": warehouse_id, "bn": batch_number,
                "qty": quantity, "cost": cost_price, "rdate": received_date,
                "exp": expiry_date or None, "sup": supplier_id,
                "po": purchase_order_id, "notes": notes,
            })
            batch_id = result.fetchone()[0]

            try:
                conn.execute(text("""
                    INSERT INTO inventory_transactions
                    (product_id, warehouse_id, transaction_type, quantity, unit_cost,
                     reference_number, notes, transaction_date, created_by)
                    VALUES (:pid, :wid, 'receipt', :qty, :cost, :ref, :notes, :dt, 1)
                """), {
                    "pid": product_id, "wid": warehouse_id, "qty": quantity,
                    "cost": cost_price, "ref": batch_number,
                    "notes": f"FIFO batch received: {notes}", "dt": received_date,
                })
            except Exception:
                pass

        return {
            "message": f"Batch {batch_number} received with {quantity} units",
            "batch_id": batch_id,
            "batch_number": batch_number,
        }
    except Exception as e:
        raise HTTPException(503, f"Batch receive failed (batch_inventory may not be set up): {str(e)}")


# ── Expiring Soon ──
@router.get("/expiring")
def expiring_batches(days: int = Query(default=30, ge=1)):
    today = date.today()
    future = (today + timedelta(days=days)).strftime("%Y-%m-%d")

    try:
        rows = run_q("""
            SELECT bi.*, p.name as product_name, p.sku, p.unit_of_measure,
                   w.name as warehouse_name
            FROM batch_inventory bi
            JOIN products p ON bi.product_id = p.id
            LEFT JOIN warehouses w ON bi.warehouse_id = w.id
            WHERE bi.status = 'active' AND bi.quantity_remaining > 0
              AND bi.expiry_date IS NOT NULL AND bi.expiry_date <= :future
            ORDER BY bi.expiry_date ASC
        """, {"future": future})
    except Exception:
        return {"batches": [], "total": 0, "days_window": days, "already_expired": 0}

    result = []
    for b in rows:
        try:
            exp = datetime.strptime(str(b["expiry_date"])[:10], "%Y-%m-%d").date()
            b["days_until_expiry"] = (exp - today).days
            b["is_expired"] = (exp - today).days < 0
        except Exception:
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
    today = date.today().strftime("%Y-%m-%d")
    exp_7 = (date.today() + timedelta(days=7)).strftime("%Y-%m-%d")
    exp_30 = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")

    try:
        total_batches = run_s(
            "SELECT COUNT(*) FROM batch_inventory WHERE status='active' AND quantity_remaining > 0"
        )
        expired = run_s(
            "SELECT COUNT(*) FROM batch_inventory WHERE status='active' AND quantity_remaining > 0 AND expiry_date < :today",
            {"today": today}
        )
        expiring_7d = run_s(
            "SELECT COUNT(*) FROM batch_inventory WHERE status='active' AND quantity_remaining > 0 AND expiry_date BETWEEN :s AND :e",
            {"s": today, "e": exp_7}
        )
        expiring_30d = run_s(
            "SELECT COUNT(*) FROM batch_inventory WHERE status='active' AND quantity_remaining > 0 AND expiry_date BETWEEN :s AND :e",
            {"s": today, "e": exp_30}
        )
        total_value = run_s(
            "SELECT COALESCE(SUM(quantity_remaining * cost_price), 0) FROM batch_inventory WHERE status='active'"
        )
    except Exception:
        total_batches = expired = expiring_7d = expiring_30d = total_value = 0

    return {
        "total_active_batches": int(total_batches),
        "already_expired": int(expired),
        "expiring_within_7_days": int(expiring_7d),
        "expiring_within_30_days": int(expiring_30d),
        "total_stock_value": round(float(total_value), 3),
    }
