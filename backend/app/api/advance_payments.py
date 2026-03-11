"""
Advance Payments API — Phase 26
Customer prepayments / deposits that can be applied to future invoices.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date
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


# ── Schemas ──
class AdvanceCreate(BaseModel):
    customer_id: int
    amount: float
    payment_date: Optional[str] = None
    payment_method: str = "cash"
    reference: Optional[str] = None
    notes: Optional[str] = None


class AdvanceApply(BaseModel):
    invoice_id: int
    amount: float


# ── List Advance Payments ──
@router.get("/advance-payments")
def list_advance_payments(
    customer_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
):
    try:
        where = ["1=1"]
        params: dict = {}
        if customer_id:
            where.append("a.customer_id = :customer_id")
            params["customer_id"] = customer_id
        if status:
            where.append("a.status = :status")
            params["status"] = status

        wc = " AND ".join(where)
        rows = run_q(f"""
            SELECT a.id, a.customer_id, a.amount, a.payment_date, a.payment_method,
                   a.reference, a.notes, a.amount_used, a.balance, a.status,
                   a.created_at, c.name as customer_name, c.code as customer_code
            FROM customer_advance_payments a
            LEFT JOIN customers c ON a.customer_id = c.id
            WHERE {wc}
            ORDER BY a.payment_date DESC
            LIMIT :limit OFFSET :offset
        """, {**params, "limit": limit, "offset": offset})

        total = run_s(f"SELECT COUNT(*) FROM customer_advance_payments a WHERE {wc}", params)
        return {"advances": rows, "total": int(total)}
    except Exception:
        return {"advances": [], "total": 0}


# ── Get Advance Detail ──
@router.get("/advance-payments/{advance_id}")
def get_advance(advance_id: int):
    rows = run_q("""
        SELECT a.*, c.name as customer_name, c.code as customer_code
        FROM customer_advance_payments a
        LEFT JOIN customers c ON a.customer_id = c.id
        WHERE a.id = :id
    """, {"id": advance_id})
    if not rows:
        raise HTTPException(404, "Advance payment not found")
    return rows[0]


# ── Record Advance Payment ──
@router.post("/advance-payments")
def create_advance(data: AdvanceCreate):
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    pay_date = data.payment_date or date.today().isoformat()
    amount = round(data.amount, 3)

    # Get customer name for journal entry
    customer_name = ""
    try:
        cust = run_q("SELECT name FROM customers WHERE id = :id", {"id": data.customer_id})
        if not cust:
            raise HTTPException(404, "Customer not found")
        customer_name = cust[0]["name"]
    except HTTPException:
        raise
    except Exception:
        pass

    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO customer_advance_payments
                (customer_id, amount, payment_date, payment_method, reference, notes, amount_used, balance, status)
            VALUES (:cid, :amt, :pdate, :method, :ref, :notes, 0, :balance, 'active')
        """), {
            "cid": data.customer_id, "amt": amount, "pdate": pay_date,
            "method": data.payment_method, "ref": data.reference, "notes": data.notes,
            "balance": amount,
        })

    # Get the ID of the just-inserted row
    advance_id = run_s("SELECT MAX(id) FROM customer_advance_payments WHERE customer_id = :cid", {"cid": data.customer_id})

    # Post journal entry: DR Cash/Bank, CR 2120 Customer Advances
    try:
        from app.services.journal import post_advance_payment
        db = SessionLocal()
        try:
            post_advance_payment(db, int(advance_id), customer_name, float(amount), data.payment_method)
        finally:
            db.close()
    except Exception:
        pass  # Journal is best-effort

    return {
        "message": f"Advance payment of {amount:.3f} OMR recorded for {customer_name}",
        "id": int(advance_id),
        "balance": amount,
    }


# ── Apply Advance to Invoice ──
@router.post("/advance-payments/{advance_id}/apply")
def apply_advance(advance_id: int, data: AdvanceApply):
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    # Get advance record
    advances = run_q("SELECT * FROM customer_advance_payments WHERE id = :id", {"id": advance_id})
    if not advances:
        raise HTTPException(404, "Advance payment not found")
    adv = advances[0]

    if adv["status"] == "fully_used":
        raise HTTPException(400, "This advance has been fully used")

    available = float(adv["balance"] or 0)
    apply_amount = round(min(data.amount, available), 3)

    if apply_amount <= 0:
        raise HTTPException(400, "No balance available to apply")

    # Get customer info
    customer_name = ""
    customer_id = adv["customer_id"]
    try:
        cust = run_q("SELECT name FROM customers WHERE id = :id", {"id": customer_id})
        if cust:
            customer_name = cust[0]["name"]
    except Exception:
        pass

    # Verify invoice exists and belongs to this customer
    from app.models.sales import SalesInvoice
    db = SessionLocal()
    try:
        invoice = db.query(SalesInvoice).filter(SalesInvoice.id == data.invoice_id).first()
        if not invoice:
            raise HTTPException(404, "Invoice not found")
        if invoice.customer_id != customer_id:
            raise HTTPException(400, "Invoice does not belong to this customer")
        if invoice.status == "paid":
            raise HTTPException(400, "Invoice is already fully paid")

        outstanding = float(invoice.total_amount or 0) - float(invoice.amount_paid or 0)
        apply_amount = round(min(apply_amount, outstanding), 3)

        if apply_amount <= 0:
            raise HTTPException(400, "Invoice has no outstanding balance")

        # Update invoice
        invoice.amount_paid = round(float(invoice.amount_paid or 0) + apply_amount, 3)
        if invoice.amount_paid >= float(invoice.total_amount or 0):
            invoice.status = "paid"
        else:
            invoice.status = "partial"

        # Update customer balance
        from app.models.business_partner import Customer
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if customer:
            customer.current_balance = round(float(customer.current_balance or 0) - apply_amount, 3)

        db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to apply: {str(e)}")
    finally:
        db.close()

    # Update advance record
    new_used = round(float(adv["amount_used"] or 0) + apply_amount, 3)
    new_balance = round(float(adv["amount"] or 0) - new_used, 3)
    new_status = "fully_used" if new_balance <= 0 else "active"

    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE customer_advance_payments
            SET amount_used = :used, balance = :balance, status = :status
            WHERE id = :id
        """), {"used": new_used, "balance": max(new_balance, 0), "status": new_status, "id": advance_id})

    # Post journal entry: DR 2120 Customer Advances, CR 1210 AR
    try:
        from app.services.journal import post_advance_application
        db2 = SessionLocal()
        try:
            post_advance_application(db2, advance_id, data.invoice_id, customer_name, float(apply_amount))
        finally:
            db2.close()
    except Exception:
        pass

    return {
        "message": f"Applied {apply_amount:.3f} OMR to invoice. Remaining advance: {max(new_balance, 0):.3f} OMR",
        "applied": apply_amount,
        "remaining_balance": max(new_balance, 0),
        "advance_status": new_status,
    }


# ── Summary ──
@router.get("/summary")
def advance_summary():
    total_advances = total_amount = available_balance = total_applied = active_count = 0
    try:
        total_advances = run_s("SELECT COUNT(*) FROM customer_advance_payments")
        total_amount = run_s("SELECT COALESCE(SUM(amount), 0) FROM customer_advance_payments")
        available_balance = run_s("SELECT COALESCE(SUM(balance), 0) FROM customer_advance_payments WHERE status = 'active'")
        total_applied = run_s("SELECT COALESCE(SUM(amount_used), 0) FROM customer_advance_payments")
        active_count = run_s("SELECT COUNT(*) FROM customer_advance_payments WHERE status = 'active'")
    except Exception:
        pass
    return {
        "total_advances": int(total_advances),
        "total_amount": round(float(total_amount), 3),
        "available_balance": round(float(available_balance), 3),
        "total_applied": round(float(total_applied), 3),
        "active_count": int(active_count),
    }
