"""
Returns & Credit Notes API — Phase 5c
Handles customer returns, restocking, and credit note generation.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from sqlalchemy import text
from app.core.database import engine, SessionLocal

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


def next_number(prefix: str, table: str, col: str) -> str:
    try:
        n = run_s(f"SELECT COALESCE(MAX(CAST(REPLACE({col}, '{prefix}-', '') AS INTEGER)), 0) FROM {table}")
        return f"{prefix}-{int(n) + 1:05d}"
    except Exception:
        import random
        return f"{prefix}-{random.randint(10000, 99999)}"


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
    try:
        where = ["1=1"]
        params: dict = {}
        if status:
            where.append("r.status = :status")
            params["status"] = status
        if customer_id:
            where.append("r.customer_id = :customer_id")
            params["customer_id"] = customer_id

        wc = " AND ".join(where)
        rows = run_q(f"""
            SELECT r.id, r.return_number, r.customer_id, r.sales_order_id,
                   r.return_date, r.return_type, r.reason, r.status,
                   r.subtotal, r.tax_amount, r.total_amount, r.notes,
                   r.created_at,
                   c.name as customer_name,
                   (SELECT COUNT(*) FROM return_items WHERE return_id = r.id) as item_count
            FROM returns r
            JOIN customers c ON r.customer_id = c.id
            WHERE {wc}
            ORDER BY r.created_at DESC
            LIMIT :limit OFFSET :offset
        """, {**params, "limit": limit, "offset": offset})

        total = run_s(f"SELECT COUNT(*) FROM returns r WHERE {wc}", params)
        return {"returns": rows, "total": int(total)}
    except Exception:
        return {"returns": [], "total": 0}


# ── Get Return Detail ──
@router.get("/returns/{return_id}")
def get_return(return_id: int):
    try:
        rows = run_q("""
            SELECT r.id, r.return_number, r.customer_id, r.sales_order_id,
                   r.return_date, r.return_type, r.reason, r.status,
                   r.subtotal, r.tax_amount, r.total_amount, r.notes,
                   r.created_at,
                   c.name as customer_name, c.phone as customer_phone
            FROM returns r
            JOIN customers c ON r.customer_id = c.id
            WHERE r.id = :id
        """, {"id": return_id})
        if not rows:
            raise HTTPException(404, "Return not found")
        ret = rows[0]

        items = run_q("""
            SELECT ri.id, ri.product_id, ri.quantity, ri.unit_price,
                   ri.reason, ri.condition, ri.restock,
                   p.name as product_name, p.sku, p.barcode
            FROM return_items ri
            JOIN products p ON ri.product_id = p.id
            WHERE ri.return_id = :id
        """, {"id": return_id})

        credit_note = None
        try:
            cn_rows = run_q("SELECT * FROM credit_notes WHERE return_id = :id", {"id": return_id})
            credit_note = cn_rows[0] if cn_rows else None
        except Exception:
            pass

        ret["items"] = items
        ret["credit_note"] = credit_note
        return ret
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(404, "Return not found")


# ── Create Return ──
@router.post("/returns")
def create_return(data: ReturnCreate):
    try:
        return_number = next_number("RET", "returns", "return_number")
        return_date = date.today().isoformat()

        tax_rate = 5.0
        try:
            val = run_s("SELECT setting_value FROM company_settings WHERE setting_key='tax_rate'")
            if val:
                tax_rate = float(val)
        except Exception:
            pass

        subtotal = sum(i.quantity * i.unit_price for i in data.items)
        tax_amount = round(subtotal * tax_rate / 100, 3)
        total_amount = round(subtotal + tax_amount, 3)

        with engine.begin() as conn:
            result = conn.execute(text("""
                INSERT INTO returns (return_number, sales_order_id, customer_id, return_date,
                    return_type, reason, status, subtotal, tax_amount, total_amount, notes)
                VALUES (:rn, :so_id, :cust_id, :rdate,
                        :rtype, :reason, 'pending', :sub, :tax, :total, :notes)
                RETURNING id
            """), {
                "rn": return_number, "so_id": data.sales_order_id,
                "cust_id": data.customer_id, "rdate": return_date,
                "rtype": data.return_type, "reason": data.reason,
                "sub": subtotal, "tax": tax_amount, "total": total_amount,
                "notes": data.notes
            })
            return_id = result.fetchone()[0]

            for item in data.items:
                conn.execute(text("""
                    INSERT INTO return_items (return_id, product_id, quantity, unit_price,
                        reason, condition, restock)
                    VALUES (:rid, :pid, :qty, :price, :reason, :cond, :restock)
                """), {
                    "rid": return_id, "pid": item.product_id,
                    "qty": item.quantity, "price": item.unit_price,
                    "reason": item.reason, "cond": item.condition,
                    "restock": item.restock
                })

        return {"message": f"Return {return_number} created", "id": return_id, "return_number": return_number}
    except Exception as e:
        raise HTTPException(500, f"Failed to create return: {str(e)}")


# ── Process Return (approve → restock + generate credit note) ──
@router.post("/returns/{return_id}/process")
def process_return(return_id: int):
    try:
        rows = run_q("SELECT * FROM returns WHERE id = :id", {"id": return_id})
        if not rows:
            raise HTTPException(404, "Return not found")
        ret = rows[0]
        if ret["status"] != "pending":
            raise HTTPException(400, f"Return is already {ret['status']}")

        items = run_q("SELECT * FROM return_items WHERE return_id = :id", {"id": return_id})

        with engine.begin() as conn:
            # Restock items marked for restocking
            for item in items:
                if item["restock"]:
                    try:
                        conn.execute(text("""
                            INSERT INTO inventory_transactions
                            (product_id, warehouse_id, transaction_type, quantity, unit_cost,
                             reference_number, notes, transaction_date, created_by)
                            VALUES (:pid, 1, 'receipt', :qty, :cost, :ref, :notes, :dt, 1)
                        """), {
                            "pid": item["product_id"], "qty": item["quantity"],
                            "cost": item["unit_price"], "ref": ret["return_number"],
                            "notes": f"Restocked from return {ret['return_number']} — condition: {item['condition']}",
                            "dt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        })
                    except Exception:
                        pass

            # Generate credit note — graceful if table doesn't exist
            cn_number = next_number("CN", "credit_notes", "credit_note_number")
            try:
                conn.execute(text("""
                    INSERT INTO credit_notes (credit_note_number, return_id, customer_id,
                        issue_date, amount, tax_amount, total_amount, status, notes)
                    VALUES (:cn, :rid, :cust, :idate, :amt, :tax, :total, 'issued', :notes)
                """), {
                    "cn": cn_number, "rid": return_id, "cust": ret["customer_id"],
                    "idate": date.today().isoformat(),
                    "amt": ret["subtotal"], "tax": ret["tax_amount"],
                    "total": ret["total_amount"],
                    "notes": f"Credit note for return {ret['return_number']}"
                })
            except Exception:
                cn_number = "N/A"

            # Update return status
            conn.execute(text(
                "UPDATE returns SET status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE id = :id"
            ), {"id": return_id})

        # Post journal entry: DR Sales Revenue + DR VAT, CR AR
        try:
            customer_name = "Unknown"
            try:
                cust_rows = run_q("SELECT name FROM customers WHERE id = :id", {"id": ret["customer_id"]})
                if cust_rows:
                    customer_name = cust_rows[0]["name"]
            except Exception:
                pass
            from app.services.journal import post_sales_return
            db = SessionLocal()
            try:
                post_sales_return(
                    db, return_id, customer_name,
                    float(ret["subtotal"]), float(ret["tax_amount"]),
                    float(ret["total_amount"])
                )
            finally:
                db.close()
        except Exception:
            pass  # Journal entry is best-effort

        return {
            "message": f"Return processed. Credit note {cn_number} issued.",
            "credit_note_number": cn_number,
            "restocked_items": sum(1 for i in items if i["restock"]),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to process return: {str(e)}")


# ── Reject Return ──
@router.post("/returns/{return_id}/reject")
def reject_return(return_id: int, reason: str = Query(default="")):
    try:
        with engine.begin() as conn:
            result = conn.execute(text("SELECT id FROM returns WHERE id = :id"), {"id": return_id})
            if not result.fetchone():
                raise HTTPException(404, "Return not found")
            conn.execute(text(
                "UPDATE returns SET status='rejected', notes=CONCAT(COALESCE(notes,''), :note), updated_at=CURRENT_TIMESTAMP WHERE id=:id"
            ), {"note": f"\nRejected: {reason}", "id": return_id})
        return {"message": "Return rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to reject return: {str(e)}")


# ── List Credit Notes ──
@router.get("/credit-notes")
def list_credit_notes(customer_id: Optional[int] = None, status: str = "", limit: int = 100):
    try:
        where = ["1=1"]
        params: dict = {"limit": limit}
        if customer_id:
            where.append("cn.customer_id = :customer_id")
            params["customer_id"] = customer_id
        if status:
            where.append("cn.status = :status")
            params["status"] = status

        rows = run_q(f"""
            SELECT cn.*, c.name as customer_name, r.return_number
            FROM credit_notes cn
            JOIN customers c ON cn.customer_id = c.id
            LEFT JOIN returns r ON cn.return_id = r.id
            WHERE {" AND ".join(where)}
            ORDER BY cn.created_at DESC LIMIT :limit
        """, params)
        return {"credit_notes": rows}
    except Exception:
        return {"credit_notes": []}


# ── Apply Credit Note to Invoice ──
@router.post("/credit-notes/{cn_id}/apply")
def apply_credit_note(cn_id: int, invoice_id: int = Query(...)):
    try:
        cn_rows = run_q("SELECT * FROM credit_notes WHERE id = :id", {"id": cn_id})
        if not cn_rows:
            raise HTTPException(404, "Credit note not found")
        cn = cn_rows[0]
        if cn["status"] != "issued":
            raise HTTPException(400, f"Credit note is already {cn['status']}")

        inv_rows = run_q("SELECT * FROM sales_invoices WHERE id = :id", {"id": invoice_id})
        if not inv_rows:
            raise HTTPException(404, "Invoice not found")
        invoice = inv_rows[0]

        new_paid = float(invoice["amount_paid"] or 0) + float(cn["total_amount"])
        new_status = "paid" if new_paid >= float(invoice["total_amount"]) else "partial"

        with engine.begin() as conn:
            conn.execute(text(
                "UPDATE sales_invoices SET amount_paid=:paid, status=:status, updated_at=CURRENT_TIMESTAMP WHERE id=:id"
            ), {"paid": new_paid, "status": new_status, "id": invoice_id})
            conn.execute(text(
                "UPDATE credit_notes SET status='applied', applied_to_invoice_id=:inv WHERE id=:id"
            ), {"inv": invoice_id, "id": cn_id})

        return {"message": f"Credit note applied to invoice. New paid amount: {new_paid}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to apply credit note: {str(e)}")


# ── Returns Summary ──
@router.get("/summary")
def returns_summary():
    pending_count = pending_value = processed_count = processed_value = 0
    cn_count = cn_value = 0
    try:
        pending_count = run_s("SELECT COUNT(*) FROM returns WHERE status='pending'")
        pending_value = run_s("SELECT COALESCE(SUM(total_amount),0) FROM returns WHERE status='pending'")
        processed_count = run_s("SELECT COUNT(*) FROM returns WHERE status='processed'")
        processed_value = run_s("SELECT COALESCE(SUM(total_amount),0) FROM returns WHERE status='processed'")
    except Exception:
        pass
    try:
        cn_count = run_s("SELECT COUNT(*) FROM credit_notes WHERE status='issued'")
        cn_value = run_s("SELECT COALESCE(SUM(total_amount),0) FROM credit_notes WHERE status='issued'")
    except Exception:
        pass
    return {
        "pending_returns": int(pending_count), "pending_value": round(float(pending_value), 3),
        "processed_returns": int(processed_count), "processed_value": round(float(processed_value), 3),
        "open_credit_notes": int(cn_count), "open_credit_value": round(float(cn_value), 3),
    }
