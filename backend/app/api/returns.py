"""
Returns & Credit Notes API — Phase 5c
Handles customer returns, restocking, and credit note generation.
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


def next_number(conn, prefix, table, col):
    row = conn.execute(f"SELECT MAX(CAST(REPLACE({col}, '{prefix}-', '') AS INTEGER)) FROM {table}").fetchone()
    n = (row[0] or 0) + 1
    return f"{prefix}-{n:05d}"


# ── Models ──
class ReturnItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit_price: float = 0
    reason: str = ""
    condition: str = "good"  # good, damaged, expired
    restock: bool = True

class ReturnCreate(BaseModel):
    customer_id: int
    sales_order_id: Optional[int] = None
    return_type: str = "refund"  # refund, replacement, credit
    reason: str = ""
    items: List[ReturnItemCreate]
    notes: str = ""


# ── List Returns ──
@router.get("/returns")
def list_returns(
    status: str = "",
    customer_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0
):
    conn = get_db()
    where = ["1=1"]
    params = []
    if status:
        where.append("r.status = ?")
        params.append(status)
    if customer_id:
        where.append("r.customer_id = ?")
        params.append(customer_id)

    wc = " AND ".join(where)
    rows = conn.execute(f"""
        SELECT r.*, c.name as customer_name,
               (SELECT COUNT(*) FROM return_items WHERE return_id = r.id) as item_count
        FROM returns r
        JOIN customers c ON r.customer_id = c.id
        WHERE {wc}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    """, params + [limit, offset]).fetchall()

    total = conn.execute(f"SELECT COUNT(*) FROM returns r WHERE {wc}", params).fetchone()[0]
    conn.close()
    return {"returns": [dict(r) for r in rows], "total": total}


# ── Get Return Detail ──
@router.get("/returns/{return_id}")
def get_return(return_id: int):
    conn = get_db()
    ret = conn.execute("""
        SELECT r.*, c.name as customer_name, c.phone as customer_phone
        FROM returns r
        JOIN customers c ON r.customer_id = c.id
        WHERE r.id = ?
    """, (return_id,)).fetchone()
    if not ret:
        raise HTTPException(404, "Return not found")

    items = conn.execute("""
        SELECT ri.*, p.name as product_name, p.sku, p.barcode
        FROM return_items ri
        JOIN products p ON ri.product_id = p.id
        WHERE ri.return_id = ?
    """, (return_id,)).fetchall()

    credit_note = conn.execute(
        "SELECT * FROM credit_notes WHERE return_id = ?", (return_id,)
    ).fetchone()

    conn.close()
    result = dict(ret)
    result["items"] = [dict(i) for i in items]
    result["credit_note"] = dict(credit_note) if credit_note else None
    return result


# ── Create Return ──
@router.post("/returns")
def create_return(data: ReturnCreate):
    conn = get_db()
    return_number = next_number(conn, "RET", "returns", "return_number")
    return_date = date.today().isoformat()

    # Get tax rate
    try:
        tax_rate = float(conn.execute(
            "SELECT setting_value FROM company_settings WHERE setting_key='tax_rate'"
        ).fetchone()[0])
    except:
        tax_rate = 5.0

    # Calculate totals
    subtotal = sum(i.quantity * i.unit_price for i in data.items)
    tax_amount = round(subtotal * tax_rate / 100, 3)
    total_amount = round(subtotal + tax_amount, 3)

    conn.execute("""
        INSERT INTO returns (return_number, sales_order_id, customer_id, return_date,
            return_type, reason, status, subtotal, tax_amount, total_amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    """, (return_number, data.sales_order_id, data.customer_id, return_date,
          data.return_type, data.reason, subtotal, tax_amount, total_amount, data.notes))

    return_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    for item in data.items:
        conn.execute("""
            INSERT INTO return_items (return_id, product_id, quantity, unit_price,
                reason, condition, restock)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (return_id, item.product_id, item.quantity, item.unit_price,
              item.reason, item.condition, item.restock))

    conn.commit()
    conn.close()
    return {"message": f"Return {return_number} created", "id": return_id, "return_number": return_number}


# ── Process Return (approve → restock + generate credit note) ──
@router.post("/returns/{return_id}/process")
def process_return(return_id: int):
    conn = get_db()
    ret = conn.execute("SELECT * FROM returns WHERE id = ?", (return_id,)).fetchone()
    if not ret:
        raise HTTPException(404, "Return not found")
    if ret["status"] != "pending":
        raise HTTPException(400, f"Return is already {ret['status']}")

    items = conn.execute("SELECT * FROM return_items WHERE return_id = ?", (return_id,)).fetchall()

    # Restock items marked for restocking
    for item in items:
        if item["restock"]:
            try:
                conn.execute("""
                    INSERT INTO inventory_transactions
                    (product_id, warehouse_id, transaction_type, quantity, unit_cost,
                     reference_number, notes, transaction_date, created_by)
                    VALUES (?, 1, 'receipt', ?, ?, ?, ?, ?, 1)
                """, (item["product_id"], item["quantity"], item["unit_price"],
                      ret["return_number"],
                      f"Restocked from return {ret['return_number']} — condition: {item['condition']}",
                      datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            except:
                pass
            # Also add to FIFO batch if table exists
            try:
                conn.execute("""
                    INSERT INTO batch_inventory
                    (product_id, warehouse_id, batch_number, quantity_received,
                     quantity_remaining, cost_price, received_date, notes)
                    VALUES (?, 1, ?, ?, ?, ?, ?, ?)
                """, (item["product_id"], f"RET-{ret['return_number']}",
                      item["quantity"], item["quantity"], item["unit_price"],
                      date.today().isoformat(),
                      f"Returned stock — {item['condition']}"))
            except:
                pass

    # Generate credit note
    cn_number = next_number(conn, "CN", "credit_notes", "credit_note_number")
    conn.execute("""
        INSERT INTO credit_notes (credit_note_number, return_id, customer_id,
            issue_date, amount, tax_amount, total_amount, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'issued', ?)
    """, (cn_number, return_id, ret["customer_id"], date.today().isoformat(),
          ret["subtotal"], ret["tax_amount"], ret["total_amount"],
          f"Credit note for return {ret['return_number']}"))

    # Update return status
    conn.execute(
        "UPDATE returns SET status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (return_id,))

    conn.commit()
    conn.close()
    return {
        "message": f"Return processed. Credit note {cn_number} issued.",
        "credit_note_number": cn_number,
        "restocked_items": sum(1 for i in items if i["restock"]),
    }


# ── Reject Return ──
@router.post("/returns/{return_id}/reject")
def reject_return(return_id: int, reason: str = Query(default="")):
    conn = get_db()
    ret = conn.execute("SELECT * FROM returns WHERE id = ?", (return_id,)).fetchone()
    if not ret:
        raise HTTPException(404, "Return not found")
    conn.execute(
        "UPDATE returns SET status='rejected', notes=notes||?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (f"\nRejected: {reason}", return_id))
    conn.commit()
    conn.close()
    return {"message": "Return rejected"}


# ── List Credit Notes ──
@router.get("/credit-notes")
def list_credit_notes(customer_id: Optional[int] = None, status: str = "", limit: int = 100):
    conn = get_db()
    where = ["1=1"]
    params = []
    if customer_id:
        where.append("cn.customer_id = ?")
        params.append(customer_id)
    if status:
        where.append("cn.status = ?")
        params.append(status)

    rows = conn.execute(f"""
        SELECT cn.*, c.name as customer_name, r.return_number
        FROM credit_notes cn
        JOIN customers c ON cn.customer_id = c.id
        LEFT JOIN returns r ON cn.return_id = r.id
        WHERE {" AND ".join(where)}
        ORDER BY cn.created_at DESC LIMIT ?
    """, params + [limit]).fetchall()
    conn.close()
    return {"credit_notes": [dict(r) for r in rows]}


# ── Apply Credit Note to Invoice ──
@router.post("/credit-notes/{cn_id}/apply")
def apply_credit_note(cn_id: int, invoice_id: int = Query(...)):
    conn = get_db()
    cn = conn.execute("SELECT * FROM credit_notes WHERE id = ?", (cn_id,)).fetchone()
    if not cn:
        raise HTTPException(404, "Credit note not found")
    if cn["status"] != "issued":
        raise HTTPException(400, f"Credit note is already {cn['status']}")

    invoice = conn.execute("SELECT * FROM sales_invoices WHERE id = ?", (invoice_id,)).fetchone()
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    # Reduce invoice amount
    new_paid = (invoice["amount_paid"] or 0) + cn["total_amount"]
    new_status = "paid" if new_paid >= invoice["total_amount"] else "partial"
    conn.execute(
        "UPDATE sales_invoices SET amount_paid=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (new_paid, new_status, invoice_id))

    conn.execute(
        "UPDATE credit_notes SET status='applied', applied_to_invoice_id=? WHERE id=?",
        (invoice_id, cn_id))

    conn.commit()
    conn.close()
    return {"message": f"Credit note applied to invoice. New paid amount: {new_paid}"}


# ── Returns Summary ──
@router.get("/summary")
def returns_summary():
    conn = get_db()
    pending = conn.execute("SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM returns WHERE status='pending'").fetchone()
    processed = conn.execute("SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM returns WHERE status='processed'").fetchone()
    cn_open = conn.execute("SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM credit_notes WHERE status='issued'").fetchone()
    conn.close()
    return {
        "pending_returns": pending[0], "pending_value": round(pending[1], 3),
        "processed_returns": processed[0], "processed_value": round(processed[1], 3),
        "open_credit_notes": cn_open[0], "open_credit_value": round(cn_open[1], 3),
    }
