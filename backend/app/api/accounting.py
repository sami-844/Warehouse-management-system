"""Accounting API — Chart of Accounts, Money Transfers, Cash Transactions, Bank Reconciliation"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel
from datetime import date, datetime
from app.core.database import get_db, engine
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter()


# ── Pydantic Schemas ──

class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: str
    parent_id: Optional[int] = None
    balance: float = 0
    notes: Optional[str] = None

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
    parent_id: Optional[int] = None
    balance: Optional[float] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class TransferCreate(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: float
    transfer_date: str
    reference: Optional[str] = None
    notes: Optional[str] = None


class CashTxCreate(BaseModel):
    tx_date: Optional[str] = None
    account_code: str = "1110"  # 1110=Cash, 1120=Bank
    category: Optional[str] = None
    amount: float
    description: str = ""
    reference: Optional[str] = None


class ManualJournalLine(BaseModel):
    account_code: str
    description: Optional[str] = None
    debit: float = 0
    credit: float = 0


class ManualJournalCreate(BaseModel):
    entry_date: Optional[str] = None
    description: str = ""
    reference: Optional[str] = None
    lines: List[ManualJournalLine]


class VATPaymentCreate(BaseModel):
    period_from: Optional[str] = None
    period_to: Optional[str] = None
    vat_amount: float
    payment_date: Optional[str] = None
    payment_account: str = "1120"  # Bank account
    reference: Optional[str] = None


# ── Helper ──

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


# ── Chart of Accounts ──

DEFAULT_ACCOUNTS = [
    ('1110', 'Cash on Hand', 'Asset', None),
    ('1120', 'Bank Account - Main', 'Asset', None),
    ('1210', 'Trade Debtors', 'Asset', None),
    ('1310', 'Goods for Resale', 'Asset', None),
    ('1410', 'Advance Payments Paid', 'Asset', None),
    ('2110', 'Trade Creditors', 'Liability', None),
    ('2210', 'VAT Payable', 'Liability', None),
    ('2310', 'Advance Payments Received', 'Liability', None),
    ('3100', 'Owner\'s Capital', 'Equity', None),
    ('3200', 'Retained Earnings', 'Equity', None),
    ('4110', 'Product Sales', 'Income', None),
    ('4210', 'Returns Income', 'Income', None),
    ('5100', 'Cost of Goods Sold', 'COGS', None),
    ('6110', 'Transport & Fuel', 'Expense', None),
    ('6120', 'Salaries', 'Expense', None),
    ('6130', 'Rent', 'Expense', None),
    ('6140', 'Utilities', 'Expense', None),
    ('6150', 'Office Supplies', 'Expense', None),
    ('6160', 'Maintenance', 'Expense', None),
    ('6900', 'Miscellaneous Expenses', 'Expense', None),
]


@router.get("/accounts")
async def list_accounts(account_type: Optional[str] = None,
                        current_user: User = Depends(get_current_user)):
    try:
        where = ["1=1"]
        params: dict = {}
        if account_type:
            where.append("a.account_type = :atype")
            params["atype"] = account_type
        rows = run_q(f"""
            SELECT a.id, a.code, a.name, a.account_type, a.parent_id,
                   a.balance, a.is_active, a.notes,
                   p.name as parent_name, p.code as parent_code
            FROM accounts a
            LEFT JOIN accounts p ON a.parent_id = p.id
            WHERE {" AND ".join(where)}
            ORDER BY a.code
        """, params)
        return [{
            "id": r["id"], "code": r["code"], "name": r["name"],
            "account_type": r["account_type"], "parent_id": r["parent_id"],
            "parent_name": r["parent_name"] or None,
            "balance": round(float(r["balance"] or 0), 3),
            "is_active": r["is_active"], "notes": r["notes"] or "",
        } for r in rows]
    except Exception:
        return []


@router.post("/accounts", status_code=201)
async def create_account(data: AccountCreate,
                         current_user: User = Depends(get_current_user)):
    try:
        with engine.begin() as conn:
            result = conn.execute(text("""
                INSERT INTO accounts (code, name, account_type, parent_id, balance, is_active, notes)
                VALUES (:code, :name, :atype, :parent_id, :balance, true, :notes)
                RETURNING id
            """), {
                "code": data.code, "name": data.name, "atype": data.account_type,
                "parent_id": data.parent_id, "balance": data.balance,
                "notes": data.notes,
            })
            aid = result.fetchone()[0]
        return {"id": aid, "code": data.code, "name": data.name, "message": "Account created"}
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(400, "Account code already exists")
        raise HTTPException(500, f"Failed to create account: {str(e)}")


@router.put("/accounts/{account_id}")
async def update_account(account_id: int, data: AccountUpdate,
                         current_user: User = Depends(get_current_user)):
    updates = []
    params: dict = {"id": account_id}
    for field in ['name', 'account_type', 'parent_id', 'balance', 'notes', 'is_active']:
        val = getattr(data, field, None)
        if val is not None:
            col = 'account_type' if field == 'account_type' else field
            updates.append(f"{col} = :{field}")
            params[field] = val
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates.append("updated_at = CURRENT_TIMESTAMP")
    try:
        with engine.begin() as conn:
            conn.execute(text(f"UPDATE accounts SET {', '.join(updates)} WHERE id = :id"), params)
        return {"message": "Account updated"}
    except Exception as e:
        raise HTTPException(500, f"Failed to update account: {str(e)}")


@router.post("/accounts/seed")
async def seed_accounts(current_user: User = Depends(get_current_user)):
    """Seed default chart of accounts if table is empty."""
    count = run_s("SELECT COUNT(*) FROM accounts")
    if count > 0:
        return {"message": f"Accounts already exist ({count} records). Skipped seeding."}
    created = 0
    with engine.begin() as conn:
        for code, name, atype, parent_id in DEFAULT_ACCOUNTS:
            try:
                conn.execute(text("""
                    INSERT INTO accounts (code, name, account_type, parent_id, balance, is_active)
                    VALUES (:code, :name, :atype, :pid, 0, true)
                """), {"code": code, "name": name, "atype": atype, "pid": parent_id})
                created += 1
            except Exception:
                pass
    return {"message": f"Seeded {created} default accounts"}


# ── Money Transfers ──

@router.get("/transfers")
async def list_transfers(from_date: Optional[str] = None, to_date: Optional[str] = None,
                         current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT mt.id, mt.amount, mt.transfer_date, mt.reference, mt.notes, mt.created_at,
                   fa.code as from_code, fa.name as from_name,
                   ta.code as to_code, ta.name as to_name
            FROM money_transfers mt
            JOIN accounts fa ON mt.from_account_id = fa.id
            JOIN accounts ta ON mt.to_account_id = ta.id
            WHERE DATE(mt.transfer_date) BETWEEN :start AND :end
            ORDER BY mt.transfer_date DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []
    return [{
        "id": r["id"],
        "from_account": f"{r['from_code']} - {r['from_name']}",
        "to_account": f"{r['to_code']} - {r['to_name']}",
        "amount": round(float(r["amount"] or 0), 3),
        "date": str(r["transfer_date"])[:10],
        "reference": r["reference"] or "", "notes": r["notes"] or "",
    } for r in rows]


@router.post("/transfers", status_code=201)
async def create_transfer(data: TransferCreate,
                          current_user: User = Depends(get_current_user)):
    if data.from_account_id == data.to_account_id:
        raise HTTPException(400, "From and To accounts must be different")
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO money_transfers (from_account_id, to_account_id, amount, transfer_date, reference, notes, created_by)
                VALUES (:from_id, :to_id, :amount, :dt, :ref, :notes, :uid)
            """), {
                "from_id": data.from_account_id, "to_id": data.to_account_id,
                "amount": data.amount, "dt": data.transfer_date,
                "ref": data.reference, "notes": data.notes,
                "uid": current_user.id,
            })
            # Update account balances
            conn.execute(text("UPDATE accounts SET balance = balance - :amt WHERE id = :id"),
                         {"amt": data.amount, "id": data.from_account_id})
            conn.execute(text("UPDATE accounts SET balance = balance + :amt WHERE id = :id"),
                         {"amt": data.amount, "id": data.to_account_id})
        return {"message": f"Transfer of {data.amount:.3f} OMR completed"}
    except Exception as e:
        raise HTTPException(500, f"Transfer failed: {str(e)}")


# ── Cash Transactions (unified view) ──

@router.get("/cash-transactions")
async def cash_transactions(from_date: Optional[str] = None, to_date: Optional[str] = None,
                            tx_type: Optional[str] = None,
                            current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    transactions = []

    # Sales payments received
    if not tx_type or tx_type == 'sales_payment':
        try:
            rows = run_q("""
                SELECT p.payment_date as date, 'Sales Payment' as type,
                       si.invoice_number as reference,
                       CONCAT('Payment from ', c.name) as description,
                       p.amount as amount_in, 0 as amount_out
                FROM payments p
                JOIN sales_invoices si ON p.reference_id = si.id AND p.reference_type = 'sales_invoice'
                JOIN customers c ON si.customer_id = c.id
                WHERE p.payment_date BETWEEN :start AND :end
                ORDER BY p.payment_date DESC
            """, {"start": start, "end": end})
            transactions.extend(rows)
        except Exception:
            pass

    # Purchase payments made
    if not tx_type or tx_type == 'purchase_payment':
        try:
            rows = run_q("""
                SELECT p.payment_date as date, 'Purchase Payment' as type,
                       pi.invoice_number as reference,
                       CONCAT('Payment to ', s.name) as description,
                       0 as amount_in, p.amount as amount_out
                FROM payments p
                JOIN purchase_invoices pi ON p.reference_id = pi.id AND p.reference_type = 'purchase_invoice'
                JOIN suppliers s ON pi.supplier_id = s.id
                WHERE p.payment_date BETWEEN :start AND :end
                ORDER BY p.payment_date DESC
            """, {"start": start, "end": end})
            transactions.extend(rows)
        except Exception:
            pass

    # Money transfers
    if not tx_type or tx_type == 'transfer':
        try:
            rows = run_q("""
                SELECT mt.transfer_date as date, 'Transfer' as type,
                       mt.reference,
                       CONCAT(fa.name, ' -> ', ta.name) as description,
                       0 as amount_in, mt.amount as amount_out
                FROM money_transfers mt
                JOIN accounts fa ON mt.from_account_id = fa.id
                JOIN accounts ta ON mt.to_account_id = ta.id
                WHERE DATE(mt.transfer_date) BETWEEN :start AND :end
                ORDER BY mt.transfer_date DESC
            """, {"start": start, "end": end})
            transactions.extend(rows)
        except Exception:
            pass

    # Cash In/Out from cash_transactions table
    if not tx_type or tx_type == 'cash_in':
        try:
            rows = run_q("""
                SELECT tx_date as date, 'Cash In' as type,
                       reference, description,
                       amount as amount_in, 0 as amount_out
                FROM cash_transactions
                WHERE tx_type = 'cash_in' AND tx_date BETWEEN :start AND :end
            """, {"start": start, "end": end})
            transactions.extend(rows)
        except Exception:
            pass

    if not tx_type or tx_type == 'cash_out':
        try:
            rows = run_q("""
                SELECT tx_date as date, 'Cash Out' as type,
                       reference, description,
                       0 as amount_in, amount as amount_out
                FROM cash_transactions
                WHERE tx_type = 'cash_out' AND tx_date BETWEEN :start AND :end
            """, {"start": start, "end": end})
            transactions.extend(rows)
        except Exception:
            pass

    # Sort by date descending
    transactions.sort(key=lambda x: str(x.get('date', '')), reverse=True)

    # Build running balance
    total_in = sum(float(t.get('amount_in', 0) or 0) for t in transactions)
    total_out = sum(float(t.get('amount_out', 0) or 0) for t in transactions)

    data = [{
        "date": str(t["date"])[:10], "type": t["type"],
        "reference": t["reference"] or "-",
        "description": t["description"] or "-",
        "amount_in": round(float(t["amount_in"] or 0), 3),
        "amount_out": round(float(t["amount_out"] or 0), 3),
    } for t in transactions]

    return {
        "data": data, "count": len(data),
        "total_in": round(total_in, 3), "total_out": round(total_out, 3),
        "net": round(total_in - total_out, 3),
        "period": {"from": start, "to": end},
    }


# ── Cash In / Cash Out ──

@router.post("/cash-in", status_code=201)
async def record_cash_in(data: CashTxCreate,
                         current_user: User = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    tx_date = data.tx_date or date.today().isoformat()
    amount = round(data.amount, 3)

    # Insert cash transaction
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO cash_transactions (tx_type, tx_date, account_code, category, amount, description, reference, created_by)
            VALUES ('cash_in', :dt, :acct, :cat, :amt, :desc, :ref, :uid)
        """), {
            "dt": tx_date, "acct": data.account_code, "cat": data.category,
            "amt": amount, "desc": data.description, "ref": data.reference,
            "uid": current_user.id,
        })

    # Post journal entry: DR Cash/Bank, CR Income/category
    try:
        from app.core.database import SessionLocal
        from app.services.journal import _next_entry_number
        from app.models.accounts import JournalEntry, JournalEntryLine
        from decimal import Decimal
        db = SessionLocal()
        try:
            credit_code = data.category or "4900"
            credit_name = data.description or "Other Income"
            acct_name = "Cash on Hand" if data.account_code == "1110" else "Bank Account"

            entry = JournalEntry(
                entry_number=_next_entry_number(db),
                entry_date=date.today(),
                description=f"Cash In — {data.description or 'Received'}",
                reference_type="CASH_IN",
                reference_id=0,
                created_by=current_user.id,
            )
            db.add(entry)
            db.flush()
            db.add_all([
                JournalEntryLine(journal_entry_id=entry.id, account_code=data.account_code,
                                 account_name=acct_name,
                                 debit_amount=Decimal(str(amount)), credit_amount=0),
                JournalEntryLine(journal_entry_id=entry.id, account_code=credit_code,
                                 account_name=credit_name,
                                 debit_amount=0, credit_amount=Decimal(str(amount))),
            ])
            db.commit()
        finally:
            db.close()
    except Exception:
        pass

    return {"message": f"Cash In of {amount:.3f} OMR recorded"}


@router.post("/cash-out", status_code=201)
async def record_cash_out(data: CashTxCreate,
                          current_user: User = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    tx_date = data.tx_date or date.today().isoformat()
    amount = round(data.amount, 3)

    # Insert cash transaction
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO cash_transactions (tx_type, tx_date, account_code, category, amount, description, reference, created_by)
            VALUES ('cash_out', :dt, :acct, :cat, :amt, :desc, :ref, :uid)
        """), {
            "dt": tx_date, "acct": data.account_code, "cat": data.category,
            "amt": amount, "desc": data.description, "ref": data.reference,
            "uid": current_user.id,
        })

    # Post journal entry: DR Expense/category, CR Cash/Bank
    try:
        from app.core.database import SessionLocal
        from app.services.journal import _next_entry_number
        from app.models.accounts import JournalEntry, JournalEntryLine
        from decimal import Decimal
        db = SessionLocal()
        try:
            debit_code = data.category or "6900"
            debit_name = data.description or "Miscellaneous Expense"
            acct_name = "Cash on Hand" if data.account_code == "1110" else "Bank Account"

            entry = JournalEntry(
                entry_number=_next_entry_number(db),
                entry_date=date.today(),
                description=f"Cash Out — {data.description or 'Payment'}",
                reference_type="CASH_OUT",
                reference_id=0,
                created_by=current_user.id,
            )
            db.add(entry)
            db.flush()
            db.add_all([
                JournalEntryLine(journal_entry_id=entry.id, account_code=debit_code,
                                 account_name=debit_name,
                                 debit_amount=Decimal(str(amount)), credit_amount=0),
                JournalEntryLine(journal_entry_id=entry.id, account_code=data.account_code,
                                 account_name=acct_name,
                                 debit_amount=0, credit_amount=Decimal(str(amount))),
            ])
            db.commit()
        finally:
            db.close()
    except Exception:
        pass

    return {"message": f"Cash Out of {amount:.3f} OMR recorded"}


# ── Manual Journal Entry ──

@router.post("/journal-entries", status_code=201)
async def create_journal_entry(data: ManualJournalCreate,
                                current_user: User = Depends(get_current_user)):
    if not data.lines or len(data.lines) < 2:
        raise HTTPException(400, "At least 2 lines required")

    total_debit = round(sum(l.debit for l in data.lines), 3)
    total_credit = round(sum(l.credit for l in data.lines), 3)
    if abs(total_debit - total_credit) > 0.001:
        raise HTTPException(400, f"Debits ({total_debit}) must equal Credits ({total_credit})")

    try:
        from app.core.database import SessionLocal
        from app.services.journal import _next_entry_number
        from app.models.accounts import JournalEntry, JournalEntryLine
        from decimal import Decimal

        entry_date_val = date.fromisoformat(data.entry_date) if data.entry_date else date.today()

        db = SessionLocal()
        try:
            entry = JournalEntry(
                entry_number=_next_entry_number(db),
                entry_date=entry_date_val,
                description=data.description or "Manual journal entry",
                reference_type="MANUAL",
                reference_id=0,
                created_by=current_user.id,
            )
            db.add(entry)
            db.flush()

            je_lines = []
            for line in data.lines:
                if line.debit == 0 and line.credit == 0:
                    continue
                # Look up account name
                acct_name = line.description or line.account_code
                try:
                    acct = run_q("SELECT name FROM accounts WHERE code = :code", {"code": line.account_code})
                    if acct:
                        acct_name = acct[0]["name"]
                except Exception:
                    pass

                je_lines.append(JournalEntryLine(
                    journal_entry_id=entry.id,
                    account_code=line.account_code,
                    account_name=acct_name,
                    debit_amount=Decimal(str(round(line.debit, 3))),
                    credit_amount=Decimal(str(round(line.credit, 3))),
                    description=line.description or "",
                ))
            db.add_all(je_lines)
            db.commit()
            return {"message": f"Journal entry {entry.entry_number} created", "entry_number": entry.entry_number}
        except Exception as e:
            db.rollback()
            raise HTTPException(500, f"Failed: {str(e)}")
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to create journal entry: {str(e)}")


# ── VAT Payment ──

@router.post("/vat-payment", status_code=201)
async def record_vat_payment(data: VATPaymentCreate,
                              current_user: User = Depends(get_current_user)):
    if data.vat_amount <= 0:
        raise HTTPException(400, "VAT amount must be positive")

    amount = round(data.vat_amount, 3)
    pay_date = data.payment_date or date.today().isoformat()

    try:
        from app.core.database import SessionLocal
        from app.services.journal import _next_entry_number
        from app.models.accounts import JournalEntry, JournalEntryLine
        from decimal import Decimal

        db = SessionLocal()
        try:
            acct_name = "Cash on Hand" if data.payment_account == "1110" else "Bank Account"

            entry = JournalEntry(
                entry_number=_next_entry_number(db),
                entry_date=date.fromisoformat(pay_date) if isinstance(pay_date, str) else pay_date,
                description=f"VAT payment to OTA — {data.reference or ''}".strip(),
                reference_type="VAT_PAYMENT",
                reference_id=0,
                created_by=current_user.id,
            )
            db.add(entry)
            db.flush()
            db.add_all([
                JournalEntryLine(journal_entry_id=entry.id, account_code="2210",
                                 account_name="VAT Payable",
                                 debit_amount=Decimal(str(amount)), credit_amount=0),
                JournalEntryLine(journal_entry_id=entry.id, account_code=data.payment_account,
                                 account_name=acct_name,
                                 debit_amount=0, credit_amount=Decimal(str(amount))),
            ])
            db.commit()
            return {"message": f"VAT payment of {amount:.3f} OMR recorded", "entry_number": entry.entry_number}
        except Exception as e:
            db.rollback()
            raise HTTPException(500, f"Failed: {str(e)}")
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to record VAT payment: {str(e)}")


# ── Enhanced P&L ──

@router.get("/profit-loss-detailed")
async def profit_loss_detailed(from_date: Optional[str] = None, to_date: Optional[str] = None,
                                current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()

    # Revenue
    sales_revenue = run_s(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE order_date BETWEEN :s AND :e AND status NOT IN ('cancelled','draft')",
        {"s": start, "e": end})
    sales_returns = 0
    try:
        sales_returns = run_s(
            "SELECT COALESCE(SUM(total_amount), 0) FROM returns WHERE return_date BETWEEN :s AND :e AND status = 'processed'",
            {"s": start, "e": end})
    except Exception:
        pass
    discounts = run_s(
        "SELECT COALESCE(SUM(discount_amount), 0) FROM sales_orders WHERE order_date BETWEEN :s AND :e AND status NOT IN ('cancelled','draft')",
        {"s": start, "e": end})
    net_sales = float(sales_revenue) - float(sales_returns) - float(discounts)

    # COGS
    cogs = run_s("""
        SELECT COALESCE(SUM(soi.quantity_ordered * COALESCE(soi.unit_cost, 0)), 0)
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.sales_order_id = so.id
        WHERE so.order_date BETWEEN :s AND :e AND so.status NOT IN ('cancelled','draft')
    """, {"s": start, "e": end})

    # Purchases total
    purchases_total = run_s(
        "SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE order_date BETWEEN :s AND :e AND status NOT IN ('cancelled','draft')",
        {"s": start, "e": end})
    try:
        purchase_returns = run_s(
            "SELECT COALESCE(SUM(total_amount), 0) FROM purchase_returns WHERE return_date BETWEEN :s AND :e AND status = 'processed'",
            {"s": start, "e": end})
    except Exception:
        purchase_returns = 0

    gross_profit = net_sales - float(cogs)

    # Expenses — from accounts table if available
    expenses = {}
    try:
        exp_rows = run_q("""
            SELECT code, name, balance FROM accounts
            WHERE account_type = 'Expense' AND is_active = true
            ORDER BY code
        """)
        for r in exp_rows:
            bal = float(r['balance'] or 0)
            if bal > 0:
                expenses[r['name']] = round(bal, 3)
    except Exception:
        pass

    # Freight from purchase orders
    freight = 0
    try:
        freight = run_s(
            "SELECT COALESCE(SUM(shipping_cost), 0) FROM purchase_orders WHERE order_date BETWEEN :s AND :e",
            {"s": start, "e": end})
    except Exception:
        pass
    if float(freight) > 0:
        expenses["Freight & Shipping"] = round(float(freight), 3)

    total_expenses = sum(expenses.values())
    net_profit = gross_profit - total_expenses

    # Tax collected
    tax_collected = run_s(
        "SELECT COALESCE(SUM(tax_amount), 0) FROM sales_orders WHERE order_date BETWEEN :s AND :e AND status NOT IN ('cancelled','draft')",
        {"s": start, "e": end})

    return {
        "period": {"from": start, "to": end},
        "revenue": {
            "sales_revenue": round(float(sales_revenue), 3),
            "sales_returns": round(float(sales_returns), 3),
            "discounts": round(float(discounts), 3),
            "net_sales": round(net_sales, 3),
        },
        "cogs": {
            "cost_of_goods_sold": round(float(cogs), 3),
            "purchases_total": round(float(purchases_total), 3),
        },
        "gross_profit": round(gross_profit, 3),
        "gross_margin_pct": round(gross_profit / net_sales * 100, 1) if net_sales > 0 else 0,
        "expenses": expenses,
        "total_expenses": round(total_expenses, 3),
        "net_profit": round(net_profit, 3),
        "net_margin_pct": round(net_profit / net_sales * 100, 1) if net_sales > 0 else 0,
        "tax_collected": round(float(tax_collected), 3),
    }


# ── Per-Customer Sales & Payments ──

@router.get("/customer-ledger")
async def customer_ledger(customer_id: int = Query(...),
                          from_date: Optional[str] = None, to_date: Optional[str] = None,
                          current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        customer = run_q("SELECT id, code, name FROM customers WHERE id = :id", {"id": customer_id})
        if not customer:
            raise HTTPException(404, "Customer not found")
        cust = customer[0]

        rows = run_q("""
            SELECT si.invoice_number, si.invoice_date as date,
                   si.total_amount as total, si.amount_paid as paid,
                   (si.total_amount - si.amount_paid) as balance,
                   si.status
            FROM sales_invoices si
            WHERE si.customer_id = :cid AND si.invoice_date BETWEEN :start AND :end
            ORDER BY si.invoice_date ASC
        """, {"cid": customer_id, "start": start, "end": end})

        grand_total = sum(float(r['total'] or 0) for r in rows)
        grand_paid = sum(float(r['paid'] or 0) for r in rows)

        data = [{
            "invoice": r['invoice_number'], "date": str(r['date'])[:10],
            "total": round(float(r['total'] or 0), 3),
            "paid": round(float(r['paid'] or 0), 3),
            "balance": round(float(r['balance'] or 0), 3),
            "status": r['status'],
        } for r in rows]

        return {
            "customer": {"id": cust['id'], "code": cust['code'], "name": cust['name']},
            "period": {"from": start, "to": end},
            "data": data,
            "grand_total": round(grand_total, 3),
            "grand_paid": round(grand_paid, 3),
            "grand_balance": round(grand_total - grand_paid, 3),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to load ledger: {str(e)}")


# ── Journal Entries ──

@router.get("/journal-entries")
async def list_journal_entries(from_date: Optional[str] = None, to_date: Optional[str] = None,
                                reference_type: Optional[str] = None, search: Optional[str] = None,
                                current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    where = ["DATE(je.entry_date) BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end}
    if reference_type:
        where.append("je.reference_type = :rtype")
        params["rtype"] = reference_type
    if search:
        where.append("(je.entry_number LIKE :q OR je.description LIKE :q)")
        params["q"] = f"%{search}%"
    try:
        rows = run_q(f"""
            SELECT je.id, je.entry_number, je.entry_date, je.description,
                   je.reference_type, je.reference_id, je.is_posted, je.created_at,
                   COALESCE(SUM(jel.debit_amount), 0) as total_debit,
                   COALESCE(SUM(jel.credit_amount), 0) as total_credit
            FROM journal_entries je
            LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
            WHERE {" AND ".join(where)}
            GROUP BY je.id, je.entry_number, je.entry_date, je.description,
                     je.reference_type, je.reference_id, je.is_posted, je.created_at
            ORDER BY je.entry_date DESC, je.id DESC
        """, params)
        return [{
            "id": r["id"], "entry_number": r["entry_number"],
            "entry_date": str(r["entry_date"])[:10],
            "description": r["description"] or "",
            "reference_type": r["reference_type"] or "",
            "reference_id": r["reference_id"],
            "is_posted": r["is_posted"] or "posted",
            "total_debit": round(float(r["total_debit"] or 0), 3),
            "total_credit": round(float(r["total_credit"] or 0), 3),
        } for r in rows]
    except Exception:
        return []


@router.get("/journal-entries/{entry_id}/lines")
async def journal_entry_lines(entry_id: int,
                               current_user: User = Depends(get_current_user)):
    try:
        rows = run_q("""
            SELECT id, account_code, account_name, debit_amount, credit_amount, description
            FROM journal_entry_lines
            WHERE journal_entry_id = :eid
            ORDER BY id
        """, {"eid": entry_id})
        return [{
            "id": r["id"], "account_code": r["account_code"],
            "account_name": r["account_name"] or "",
            "debit": round(float(r["debit_amount"] or 0), 3),
            "credit": round(float(r["credit_amount"] or 0), 3),
            "description": r["description"] or "",
        } for r in rows]
    except Exception:
        return []


@router.post("/accounts/recalculate-balances")
async def recalculate_account_balances(current_user: User = Depends(get_current_user)):
    """Recalculate every account balance from journal entry lines"""
    try:
        with engine.begin() as conn:
            # Get all accounts
            accounts = conn.execute(text("SELECT id, code, account_type FROM accounts")).fetchall()
            updated = 0
            for acct in accounts:
                aid, code, atype = acct[0], acct[1], acct[2]
                row = conn.execute(text("""
                    SELECT COALESCE(SUM(debit_amount), 0) as debits,
                           COALESCE(SUM(credit_amount), 0) as credits
                    FROM journal_entry_lines WHERE account_code = :code
                """), {"code": code}).fetchone()
                debits = float(row[0])
                credits = float(row[1])
                # Assets and expenses: balance = debits - credits
                # Liabilities, equity, income: balance = credits - debits
                if atype in ("Asset", "Expense", "COGS"):
                    balance = debits - credits
                else:
                    balance = credits - debits
                conn.execute(text("UPDATE accounts SET balance = :bal, updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
                             {"bal": round(balance, 3), "id": aid})
                updated += 1
        return {"message": f"Recalculated balances for {updated} accounts"}
    except Exception as e:
        raise HTTPException(500, f"Failed to recalculate: {str(e)}")


# ── Bank Reconciliation ──

@router.get("/bank-recon/system-records")
async def bank_recon_system_records(from_date: str, to_date: str,
                                     current_user: User = Depends(get_current_user)):
    """Get all payments from the system for bank reconciliation matching."""
    records = []

    # Sales payments received
    try:
        rows = run_q("""
            SELECT p.id, p.payment_date as date, 'SALES_PAYMENT' as type,
                   COALESCE(si.invoice_number, 'SI-' || p.reference_id) as reference,
                   'Payment from ' || COALESCE(c.name, 'Customer') as description,
                   p.amount, p.bank_reference, p.payment_method
            FROM payments p
            LEFT JOIN sales_invoices si ON p.reference_id = si.id AND p.reference_type = 'sales_invoice'
            LEFT JOIN customers c ON si.customer_id = c.id
            WHERE p.reference_type = 'sales_invoice'
              AND p.payment_date BETWEEN :s AND :e
            ORDER BY p.payment_date DESC
        """, {"s": from_date, "e": to_date})
        records.extend(rows)
    except Exception:
        pass

    # Purchase payments made
    try:
        rows = run_q("""
            SELECT p.id, p.payment_date as date, 'PURCHASE_PAYMENT' as type,
                   COALESCE(pi.invoice_number, 'PI-' || p.reference_id) as reference,
                   'Payment to ' || COALESCE(s.name, 'Supplier') as description,
                   p.amount, p.bank_reference, p.payment_method
            FROM payments p
            LEFT JOIN purchase_invoices pi ON p.reference_id = pi.id AND p.reference_type = 'purchase_invoice'
            LEFT JOIN suppliers s ON pi.supplier_id = s.id
            WHERE p.reference_type = 'purchase_invoice'
              AND p.payment_date BETWEEN :s AND :e
            ORDER BY p.payment_date DESC
        """, {"s": from_date, "e": to_date})
        records.extend(rows)
    except Exception:
        pass

    # Money transfers
    try:
        rows = run_q("""
            SELECT mt.id, DATE(mt.transfer_date) as date, 'TRANSFER' as type,
                   COALESCE(mt.reference, 'MT-' || mt.id) as reference,
                   COALESCE(fa.name, 'Account') || ' -> ' || COALESCE(ta.name, 'Account') as description,
                   mt.amount, mt.reference as bank_reference, 'transfer' as payment_method
            FROM money_transfers mt
            LEFT JOIN accounts fa ON mt.from_account_id = fa.id
            LEFT JOIN accounts ta ON mt.to_account_id = ta.id
            WHERE DATE(mt.transfer_date) BETWEEN :s AND :e
            ORDER BY mt.transfer_date DESC
        """, {"s": from_date, "e": to_date})
        records.extend(rows)
    except Exception:
        pass

    return records


class ReconSaveRequest(BaseModel):
    reconciliation_date: str
    opening_balance: float = 0
    closing_balance: float = 0
    matched_pairs: list = []
    notes: Optional[str] = None

@router.post("/bank-recon/save")
async def save_bank_reconciliation(data: ReconSaveRequest,
                                    current_user: User = Depends(get_current_user)):
    """Save a bank reconciliation session."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                INSERT INTO bank_reconciliations
                (reconciliation_date, bank_statement_date, opening_balance, closing_balance, status, notes, created_by)
                VALUES (:rd, :bsd, :ob, :cb, :status, :notes, :uid)
                RETURNING id
            """), {
                "rd": data.reconciliation_date,
                "bsd": data.reconciliation_date,
                "ob": data.opening_balance,
                "cb": data.closing_balance,
                "status": "completed",
                "notes": data.notes or f"Matched {len(data.matched_pairs)} transactions",
                "uid": current_user.id,
            })
            recon_id = result.fetchone()[0]
            conn.commit()
        return {"id": recon_id, "message": f"Reconciliation saved with {len(data.matched_pairs)} matched pairs"}
    except Exception as e:
        raise HTTPException(500, f"Failed to save reconciliation: {str(e)}")

@router.get("/bank-recon/history")
async def bank_recon_history(current_user: User = Depends(get_current_user)):
    """List past reconciliation sessions."""
    try:
        rows = run_q("""
            SELECT br.id, br.reconciliation_date, br.opening_balance, br.closing_balance,
                   br.status, br.notes, br.created_at,
                   u.username as created_by_name
            FROM bank_reconciliations br
            LEFT JOIN users u ON br.created_by = u.id
            ORDER BY br.created_at DESC
            LIMIT 50
        """)
        return rows
    except Exception:
        return []
