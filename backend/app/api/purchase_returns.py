"""
Purchase Returns & Debit Notes API — Phase 24
Handles supplier returns, de-stocking, and debit note generation.
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
class PurchaseReturnItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit_price: float = 0
    condition: str = "good"  # good, damaged, expired


class PurchaseReturnCreate(BaseModel):
    supplier_id: int
    purchase_invoice_id: Optional[int] = None
    reason: str = ""
    items: List[PurchaseReturnItemCreate]


# ── List Purchase Returns ──
@router.get("/purchase-returns")
def list_purchase_returns(
    status: str = "",
    supplier_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0
):
    try:
        where = ["1=1"]
        params: dict = {}
        if status:
            where.append("r.status = :status")
            params["status"] = status
        if supplier_id:
            where.append("r.supplier_id = :supplier_id")
            params["supplier_id"] = supplier_id

        wc = " AND ".join(where)
        rows = run_q(f"""
            SELECT r.id, r.return_number, r.supplier_id, r.purchase_invoice_id,
                   r.return_date, r.reason, r.status,
                   r.subtotal, r.tax_amount, r.total_amount,
                   r.created_at,
                   s.name as supplier_name,
                   (SELECT COUNT(*) FROM purchase_return_items WHERE return_id = r.id) as item_count
            FROM purchase_returns r
            JOIN suppliers s ON r.supplier_id = s.id
            WHERE {wc}
            ORDER BY r.created_at DESC
            LIMIT :limit OFFSET :offset
        """, {**params, "limit": limit, "offset": offset})

        total = run_s(f"SELECT COUNT(*) FROM purchase_returns r WHERE {wc}", params)
        return {"returns": rows, "total": int(total)}
    except Exception:
        return {"returns": [], "total": 0}


# ── Get Purchase Return Detail ──
@router.get("/purchase-returns/{return_id}")
def get_purchase_return(return_id: int):
    try:
        rows = run_q("""
            SELECT r.id, r.return_number, r.supplier_id, r.purchase_invoice_id,
                   r.return_date, r.reason, r.status,
                   r.subtotal, r.tax_amount, r.total_amount,
                   r.created_at,
                   s.name as supplier_name, s.phone as supplier_phone
            FROM purchase_returns r
            JOIN suppliers s ON r.supplier_id = s.id
            WHERE r.id = :id
        """, {"id": return_id})
        if not rows:
            raise HTTPException(404, "Purchase return not found")
        ret = rows[0]

        items = run_q("""
            SELECT ri.id, ri.product_id, ri.quantity, ri.unit_price,
                   ri.condition, ri.tax_rate, ri.line_total,
                   p.name as product_name, p.sku
            FROM purchase_return_items ri
            JOIN products p ON ri.product_id = p.id
            WHERE ri.return_id = :id
        """, {"id": return_id})

        debit_note = None
        try:
            dn_rows = run_q("SELECT * FROM debit_notes WHERE return_id = :id", {"id": return_id})
            debit_note = dn_rows[0] if dn_rows else None
        except Exception:
            pass

        ret["items"] = items
        ret["debit_note"] = debit_note
        return ret
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(404, "Purchase return not found")


# ── Create Purchase Return ──
@router.post("/purchase-returns")
def create_purchase_return(data: PurchaseReturnCreate):
    try:
        return_number = next_number("PRET", "purchase_returns", "return_number")
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
                INSERT INTO purchase_returns (return_number, purchase_invoice_id, supplier_id,
                    return_date, reason, status, subtotal, tax_amount, total_amount)
                VALUES (:rn, :inv_id, :sup_id, :rdate, :reason, 'pending', :sub, :tax, :total)
                RETURNING id
            """), {
                "rn": return_number, "inv_id": data.purchase_invoice_id,
                "sup_id": data.supplier_id, "rdate": return_date,
                "reason": data.reason,
                "sub": subtotal, "tax": tax_amount, "total": total_amount,
            })
            return_id = result.fetchone()[0]

            for item in data.items:
                line_total = round(item.quantity * item.unit_price, 3)
                conn.execute(text("""
                    INSERT INTO purchase_return_items (return_id, product_id, quantity, unit_price,
                        tax_rate, line_total, condition)
                    VALUES (:rid, :pid, :qty, :price, :tax_rate, :line_total, :cond)
                """), {
                    "rid": return_id, "pid": item.product_id,
                    "qty": item.quantity, "price": item.unit_price,
                    "tax_rate": tax_rate, "line_total": line_total,
                    "cond": item.condition,
                })

        return {"message": f"Purchase return {return_number} created", "id": return_id, "return_number": return_number}
    except Exception as e:
        raise HTTPException(500, f"Failed to create purchase return: {str(e)}")


# ── Process Purchase Return (approve → destock + generate debit note + journal entry) ──
@router.post("/purchase-returns/{return_id}/process")
def process_purchase_return(return_id: int):
    try:
        rows = run_q("SELECT * FROM purchase_returns WHERE id = :id", {"id": return_id})
        if not rows:
            raise HTTPException(404, "Purchase return not found")
        ret = rows[0]
        if ret["status"] != "pending":
            raise HTTPException(400, f"Return is already {ret['status']}")

        items = run_q("SELECT * FROM purchase_return_items WHERE return_id = :id", {"id": return_id})

        # Get supplier name for journal entry
        supplier_name = "Unknown"
        try:
            sup_rows = run_q("SELECT name FROM suppliers WHERE id = :id", {"id": ret["supplier_id"]})
            if sup_rows:
                supplier_name = sup_rows[0]["name"]
        except Exception:
            pass

        with engine.begin() as conn:
            # De-stock items (issue out of inventory)
            for item in items:
                try:
                    conn.execute(text("""
                        INSERT INTO inventory_transactions
                        (product_id, warehouse_id, transaction_type, quantity, unit_cost,
                         reference_number, notes, transaction_date, created_by)
                        VALUES (:pid, 1, 'issue', :qty, :cost, :ref, :notes, :dt, 1)
                    """), {
                        "pid": item["product_id"], "qty": -abs(float(item["quantity"])),
                        "cost": item["unit_price"], "ref": ret["return_number"],
                        "notes": f"De-stocked for purchase return {ret['return_number']} — condition: {item['condition']}",
                        "dt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    })
                except Exception:
                    pass

            # Generate debit note
            dn_number = next_number("DN", "debit_notes", "debit_note_number")
            try:
                conn.execute(text("""
                    INSERT INTO debit_notes (debit_note_number, return_id, supplier_id,
                        issue_date, amount, tax_amount, total_amount, status, notes)
                    VALUES (:dn, :rid, :sup, :idate, :amt, :tax, :total, 'issued', :notes)
                """), {
                    "dn": dn_number, "rid": return_id, "sup": ret["supplier_id"],
                    "idate": date.today().isoformat(),
                    "amt": ret["subtotal"], "tax": ret["tax_amount"],
                    "total": ret["total_amount"],
                    "notes": f"Debit note for purchase return {ret['return_number']}"
                })
            except Exception:
                dn_number = "N/A"

            # Update return status
            conn.execute(text(
                "UPDATE purchase_returns SET status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE id = :id"
            ), {"id": return_id})

        # Post journal entry: DR AP, CR Inventory + CR Input VAT
        try:
            from app.services.journal import post_purchase_return
            db = SessionLocal()
            try:
                post_purchase_return(
                    db, return_id, supplier_name,
                    float(ret["subtotal"]), float(ret["tax_amount"]),
                    float(ret["total_amount"])
                )
            finally:
                db.close()
        except Exception:
            pass  # Journal entry is best-effort

        return {
            "message": f"Purchase return processed. Debit note {dn_number} issued.",
            "debit_note_number": dn_number,
            "destocked_items": len(items),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to process purchase return: {str(e)}")


# ── Reject Purchase Return ──
@router.post("/purchase-returns/{return_id}/reject")
def reject_purchase_return(return_id: int, reason: str = Query(default="")):
    try:
        with engine.begin() as conn:
            result = conn.execute(text("SELECT id FROM purchase_returns WHERE id = :id"), {"id": return_id})
            if not result.fetchone():
                raise HTTPException(404, "Purchase return not found")
            conn.execute(text(
                "UPDATE purchase_returns SET status='rejected', reason=COALESCE(reason,'') || :note, updated_at=CURRENT_TIMESTAMP WHERE id=:id"
            ), {"note": f"\nRejected: {reason}", "id": return_id})
        return {"message": "Purchase return rejected"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to reject return: {str(e)}")


# ── List Debit Notes ──
@router.get("/debit-notes")
def list_debit_notes(supplier_id: Optional[int] = None, status: str = "", limit: int = 100):
    try:
        where = ["1=1"]
        params: dict = {"limit": limit}
        if supplier_id:
            where.append("dn.supplier_id = :supplier_id")
            params["supplier_id"] = supplier_id
        if status:
            where.append("dn.status = :status")
            params["status"] = status

        rows = run_q(f"""
            SELECT dn.*, s.name as supplier_name, r.return_number
            FROM debit_notes dn
            JOIN suppliers s ON dn.supplier_id = s.id
            LEFT JOIN purchase_returns r ON dn.return_id = r.id
            WHERE {" AND ".join(where)}
            ORDER BY dn.id DESC LIMIT :limit
        """, params)
        return {"debit_notes": rows}
    except Exception:
        return {"debit_notes": []}


# ── Apply Debit Note to Purchase Invoice ──
@router.post("/debit-notes/{dn_id}/apply")
def apply_debit_note(dn_id: int, invoice_id: int = Query(...)):
    try:
        dn_rows = run_q("SELECT * FROM debit_notes WHERE id = :id", {"id": dn_id})
        if not dn_rows:
            raise HTTPException(404, "Debit note not found")
        dn = dn_rows[0]
        if dn["status"] != "issued":
            raise HTTPException(400, f"Debit note is already {dn['status']}")

        inv_rows = run_q("SELECT * FROM purchase_invoices WHERE id = :id", {"id": invoice_id})
        if not inv_rows:
            raise HTTPException(404, "Purchase invoice not found")
        invoice = inv_rows[0]

        new_paid = float(invoice["amount_paid"] or 0) + float(dn["total_amount"])
        new_status = "paid" if new_paid >= float(invoice["total_amount"]) else "partial"

        with engine.begin() as conn:
            conn.execute(text(
                "UPDATE purchase_invoices SET amount_paid=:paid, status=:status WHERE id=:id"
            ), {"paid": new_paid, "status": new_status, "id": invoice_id})
            conn.execute(text(
                "UPDATE debit_notes SET status='applied', applied_to_invoice_id=:inv WHERE id=:id"
            ), {"inv": invoice_id, "id": dn_id})

        return {"message": f"Debit note applied to purchase invoice. New paid amount: {new_paid}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to apply debit note: {str(e)}")


# ── Purchase Returns Summary ──
@router.get("/summary")
def purchase_returns_summary():
    pending_count = pending_value = processed_count = processed_value = 0
    dn_count = dn_value = 0
    try:
        pending_count = run_s("SELECT COUNT(*) FROM purchase_returns WHERE status='pending'")
        pending_value = run_s("SELECT COALESCE(SUM(total_amount),0) FROM purchase_returns WHERE status='pending'")
        processed_count = run_s("SELECT COUNT(*) FROM purchase_returns WHERE status='processed'")
        processed_value = run_s("SELECT COALESCE(SUM(total_amount),0) FROM purchase_returns WHERE status='processed'")
    except Exception:
        pass
    try:
        dn_count = run_s("SELECT COUNT(*) FROM debit_notes WHERE status='issued'")
        dn_value = run_s("SELECT COALESCE(SUM(total_amount),0) FROM debit_notes WHERE status='issued'")
    except Exception:
        pass
    return {
        "pending_returns": int(pending_count), "pending_value": round(float(pending_value), 3),
        "processed_returns": int(processed_count), "processed_value": round(float(processed_value), 3),
        "open_debit_notes": int(dn_count), "open_debit_value": round(float(dn_value), 3),
    }
