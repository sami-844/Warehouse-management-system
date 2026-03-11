"""
Bills API — Phase 25
Expense/service invoices (rent, utilities, logistics) separate from product purchases.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
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


def next_bill_number() -> str:
    try:
        n = run_s("SELECT COALESCE(MAX(CAST(REPLACE(bill_number, 'BILL-', '') AS INTEGER)), 0) FROM bills")
        return f"BILL-{int(n) + 1:05d}"
    except Exception:
        import random
        return f"BILL-{random.randint(10000, 99999)}"


# ── Schemas ──
class BillCreate(BaseModel):
    bill_date: str
    due_date: Optional[str] = None
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    expense_account: Optional[str] = None
    description: str = ""
    amount: float = 0
    add_vat: bool = False
    notes: Optional[str] = None


class BillUpdate(BaseModel):
    bill_date: Optional[str] = None
    due_date: Optional[str] = None
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    expense_account: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    tax_amount: Optional[float] = None
    notes: Optional[str] = None


class BillPayment(BaseModel):
    amount: float
    payment_method: str = "cash"  # cash or bank


# ── List Bills ──
@router.get("/bills")
def list_bills(
    status: str = "",
    vendor_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
):
    try:
        where = ["1=1"]
        params: dict = {}
        if status:
            where.append("b.status = :status")
            params["status"] = status
        if vendor_id:
            where.append("b.vendor_id = :vendor_id")
            params["vendor_id"] = vendor_id
        if start_date:
            where.append("b.bill_date >= :start_date")
            params["start_date"] = start_date
        if end_date:
            where.append("b.bill_date <= :end_date")
            params["end_date"] = end_date
        if search:
            where.append("(b.bill_number LIKE :search OR b.vendor_name LIKE :search OR b.description LIKE :search)")
            params["search"] = f"%{search}%"

        wc = " AND ".join(where)
        rows = run_q(f"""
            SELECT b.id, b.bill_number, b.bill_date, b.due_date,
                   b.vendor_id, b.vendor_name, b.expense_account,
                   b.description, b.amount, b.tax_amount, b.total_amount,
                   b.amount_paid, b.status, b.payment_method, b.notes,
                   b.created_at,
                   COALESCE(s.name, b.vendor_name) as display_vendor
            FROM bills b
            LEFT JOIN suppliers s ON b.vendor_id = s.id
            WHERE {wc}
            ORDER BY b.bill_date DESC
            LIMIT :limit OFFSET :offset
        """, {**params, "limit": limit, "offset": offset})

        total = run_s(f"SELECT COUNT(*) FROM bills b WHERE {wc}", params)
        return {"bills": rows, "total": int(total)}
    except Exception:
        return {"bills": [], "total": 0}


# ── Get Bill Detail ──
@router.get("/bills/{bill_id}")
def get_bill(bill_id: int):
    try:
        rows = run_q("""
            SELECT b.*, COALESCE(s.name, b.vendor_name) as display_vendor
            FROM bills b
            LEFT JOIN suppliers s ON b.vendor_id = s.id
            WHERE b.id = :id
        """, {"id": bill_id})
        if not rows:
            raise HTTPException(404, "Bill not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(404, "Bill not found")


# ── Create Bill ──
@router.post("/bills")
def create_bill(data: BillCreate):
    try:
        bill_number = next_bill_number()
        amount = round(data.amount, 3)
        tax_amount = round(amount * 0.05, 3) if data.add_vat else 0
        total_amount = round(amount + tax_amount, 3)

        # Resolve vendor name
        vendor_name = data.vendor_name or ""
        if data.vendor_id and not vendor_name:
            try:
                sup = run_q("SELECT name FROM suppliers WHERE id = :id", {"id": data.vendor_id})
                if sup:
                    vendor_name = sup[0]["name"]
            except Exception:
                pass

        with engine.begin() as conn:
            result = conn.execute(text("""
                INSERT INTO bills (bill_number, bill_date, due_date, vendor_id, vendor_name,
                    expense_account, description, amount, tax_amount, total_amount,
                    amount_paid, status, notes)
                VALUES (:bn, :bdate, :ddate, :vid, :vname, :eacc, :desc, :amt, :tax,
                        :total, 0, 'unpaid', :notes)
                RETURNING id
            """), {
                "bn": bill_number, "bdate": data.bill_date, "ddate": data.due_date,
                "vid": data.vendor_id, "vname": vendor_name,
                "eacc": data.expense_account, "desc": data.description,
                "amt": amount, "tax": tax_amount, "total": total_amount,
                "notes": data.notes,
            })
            bill_id = result.fetchone()[0]

        return {"message": f"Bill {bill_number} created", "id": bill_id, "bill_number": bill_number, "total_amount": total_amount}
    except Exception as e:
        raise HTTPException(500, f"Failed to create bill: {str(e)}")


# ── Update Bill ──
@router.put("/bills/{bill_id}")
def update_bill(bill_id: int, data: BillUpdate):
    try:
        rows = run_q("SELECT * FROM bills WHERE id = :id", {"id": bill_id})
        if not rows:
            raise HTTPException(404, "Bill not found")
        bill = rows[0]
        if bill["status"] == "paid":
            raise HTTPException(400, "Cannot edit a paid bill")

        sets = []
        params = {"id": bill_id}
        if data.bill_date is not None:
            sets.append("bill_date = :bill_date")
            params["bill_date"] = data.bill_date
        if data.due_date is not None:
            sets.append("due_date = :due_date")
            params["due_date"] = data.due_date
        if data.vendor_id is not None:
            sets.append("vendor_id = :vendor_id")
            params["vendor_id"] = data.vendor_id
        if data.vendor_name is not None:
            sets.append("vendor_name = :vendor_name")
            params["vendor_name"] = data.vendor_name
        if data.expense_account is not None:
            sets.append("expense_account = :expense_account")
            params["expense_account"] = data.expense_account
        if data.description is not None:
            sets.append("description = :description")
            params["description"] = data.description
        if data.amount is not None:
            tax = data.tax_amount if data.tax_amount is not None else float(bill["tax_amount"] or 0)
            sets.append("amount = :amount")
            sets.append("tax_amount = :tax_amount")
            sets.append("total_amount = :total_amount")
            params["amount"] = round(data.amount, 3)
            params["tax_amount"] = round(tax, 3)
            params["total_amount"] = round(data.amount + tax, 3)
        if data.notes is not None:
            sets.append("notes = :notes")
            params["notes"] = data.notes

        if not sets:
            return {"message": "Nothing to update"}

        with engine.begin() as conn:
            conn.execute(text(f"UPDATE bills SET {', '.join(sets)} WHERE id = :id"), params)

        return {"message": "Bill updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to update bill: {str(e)}")


# ── Delete Bill ──
@router.delete("/bills/{bill_id}")
def delete_bill(bill_id: int):
    try:
        rows = run_q("SELECT * FROM bills WHERE id = :id", {"id": bill_id})
        if not rows:
            raise HTTPException(404, "Bill not found")
        if rows[0]["status"] != "unpaid":
            raise HTTPException(400, "Only unpaid bills can be deleted")
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM bills WHERE id = :id"), {"id": bill_id})
        return {"message": "Bill deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to delete bill: {str(e)}")


# ── Record Payment ──
@router.post("/bills/{bill_id}/payment")
def pay_bill(bill_id: int, data: BillPayment):
    try:
        rows = run_q("SELECT * FROM bills WHERE id = :id", {"id": bill_id})
        if not rows:
            raise HTTPException(404, "Bill not found")
        bill = rows[0]
        if bill["status"] == "paid":
            raise HTTPException(400, "Bill is already fully paid")

        new_paid = round(float(bill["amount_paid"] or 0) + data.amount, 3)
        total = float(bill["total_amount"] or 0)
        new_status = "paid" if new_paid >= total else "partial"

        with engine.begin() as conn:
            conn.execute(text("""
                UPDATE bills SET amount_paid = :paid, status = :status,
                    payment_method = :method WHERE id = :id
            """), {"paid": new_paid, "status": new_status, "method": data.payment_method, "id": bill_id})

        # Post journal entry: DR Expense, CR Cash/Bank
        try:
            from app.services.journal import post_expense
            db = SessionLocal()
            try:
                expense_account = bill["expense_account"] or "6900"  # Default to Miscellaneous
                post_expense(
                    db, bill_id,
                    bill["description"] or f"Bill {bill['bill_number']}",
                    data.amount,
                    expense_account,
                    data.payment_method,
                )
            finally:
                db.close()
        except Exception:
            pass  # Journal is best-effort

        return {
            "message": f"Payment of {data.amount:.3f} recorded. Status: {new_status}",
            "amount_paid": new_paid,
            "status": new_status,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to record payment: {str(e)}")


# ── Summary ──
@router.get("/summary")
def bills_summary():
    total_bills = total_due = paid_month = overdue = 0
    try:
        total_bills = run_s("SELECT COUNT(*) FROM bills")
        total_due = run_s("SELECT COALESCE(SUM(total_amount - amount_paid), 0) FROM bills WHERE status != 'paid'")

        month_start = date.today().replace(day=1).isoformat()
        paid_month = run_s(
            "SELECT COALESCE(SUM(amount_paid), 0) FROM bills WHERE status IN ('paid','partial') AND bill_date >= :ms",
            {"ms": month_start})

        today = date.today().isoformat()
        overdue = run_s(
            "SELECT COUNT(*) FROM bills WHERE status != 'paid' AND due_date IS NOT NULL AND due_date < :today",
            {"today": today})
    except Exception:
        pass
    return {
        "total_bills": int(total_bills),
        "total_due": round(float(total_due), 3),
        "paid_this_month": round(float(paid_month), 3),
        "overdue": int(overdue),
    }
