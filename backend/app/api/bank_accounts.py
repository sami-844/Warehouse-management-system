"""
Bank Accounts API — Phase 28
Manage bank/cash/wallet accounts with balances.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
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


# ── Schemas ──
class BankAccountCreate(BaseModel):
    account_name: str
    account_type: str = "bank"  # cash / bank / credit_card / mobile_wallet
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    iban: Optional[str] = None
    currency: str = "OMR"
    opening_balance: float = 0
    notes: Optional[str] = None


class BankAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    iban: Optional[str] = None
    currency: Optional[str] = None
    opening_balance: Optional[float] = None
    current_balance: Optional[float] = None
    is_default: Optional[bool] = None
    notes: Optional[str] = None


# ── List Bank Accounts ──
@router.get("/bank-accounts")
def list_bank_accounts(include_inactive: bool = False):
    try:
        where = "1=1" if include_inactive else "is_active = true"
        rows = run_q(f"""
            SELECT id, account_name, account_type, bank_name, account_number,
                   iban, currency, opening_balance, current_balance,
                   is_default, is_active, notes, created_at
            FROM bank_accounts
            WHERE {where}
            ORDER BY is_default DESC, account_name
        """)
        return {"accounts": rows, "total": len(rows)}
    except Exception:
        return {"accounts": [], "total": 0}


# ── Get Single Account ──
@router.get("/bank-accounts/{account_id}")
def get_bank_account(account_id: int):
    rows = run_q("SELECT * FROM bank_accounts WHERE id = :id", {"id": account_id})
    if not rows:
        raise HTTPException(404, "Bank account not found")
    return rows[0]


# ── Create Bank Account ──
@router.post("/bank-accounts")
def create_bank_account(data: BankAccountCreate):
    if not data.account_name.strip():
        raise HTTPException(400, "Account name is required")

    valid_types = ("cash", "bank", "credit_card", "mobile_wallet")
    if data.account_type not in valid_types:
        raise HTTPException(400, f"Account type must be one of: {', '.join(valid_types)}")

    opening = round(data.opening_balance, 3)

    with engine.begin() as conn:
        result = conn.execute(text("""
            INSERT INTO bank_accounts
                (account_name, account_type, bank_name, account_number, iban,
                 currency, opening_balance, current_balance, notes)
            VALUES (:name, :type, :bank, :acct_num, :iban,
                    :currency, :opening, :balance, :notes)
            RETURNING id
        """), {
            "name": data.account_name.strip(),
            "type": data.account_type,
            "bank": data.bank_name,
            "acct_num": data.account_number,
            "iban": data.iban,
            "currency": data.currency,
            "opening": opening,
            "balance": opening,
            "notes": data.notes,
        })
        account_id = result.fetchone()[0]

    return {
        "message": f"Bank account '{data.account_name}' created",
        "id": account_id,
    }


# ── Update Bank Account ──
@router.put("/bank-accounts/{account_id}")
def update_bank_account(account_id: int, data: BankAccountUpdate):
    rows = run_q("SELECT * FROM bank_accounts WHERE id = :id", {"id": account_id})
    if not rows:
        raise HTTPException(404, "Bank account not found")

    sets = []
    params = {"id": account_id}

    if data.account_name is not None:
        sets.append("account_name = :account_name")
        params["account_name"] = data.account_name.strip()
    if data.account_type is not None:
        sets.append("account_type = :account_type")
        params["account_type"] = data.account_type
    if data.bank_name is not None:
        sets.append("bank_name = :bank_name")
        params["bank_name"] = data.bank_name
    if data.account_number is not None:
        sets.append("account_number = :account_number")
        params["account_number"] = data.account_number
    if data.iban is not None:
        sets.append("iban = :iban")
        params["iban"] = data.iban
    if data.currency is not None:
        sets.append("currency = :currency")
        params["currency"] = data.currency
    if data.opening_balance is not None:
        sets.append("opening_balance = :opening_balance")
        params["opening_balance"] = round(data.opening_balance, 3)
    if data.current_balance is not None:
        sets.append("current_balance = :current_balance")
        params["current_balance"] = round(data.current_balance, 3)
    if data.is_default is not None:
        # If setting as default, unset all others first
        if data.is_default:
            with engine.begin() as conn:
                conn.execute(text("UPDATE bank_accounts SET is_default = 0"))
        sets.append("is_default = :is_default")
        params["is_default"] = 1 if data.is_default else 0
    if data.notes is not None:
        sets.append("notes = :notes")
        params["notes"] = data.notes

    if not sets:
        return {"message": "Nothing to update"}

    with engine.begin() as conn:
        conn.execute(text(f"UPDATE bank_accounts SET {', '.join(sets)} WHERE id = :id"), params)

    return {"message": "Bank account updated"}


# ── Delete (soft) Bank Account ──
@router.delete("/bank-accounts/{account_id}")
def delete_bank_account(account_id: int):
    rows = run_q("SELECT * FROM bank_accounts WHERE id = :id", {"id": account_id})
    if not rows:
        raise HTTPException(404, "Bank account not found")
    if rows[0]["is_default"]:
        raise HTTPException(400, "Cannot delete the default account")

    with engine.begin() as conn:
        conn.execute(text("UPDATE bank_accounts SET is_active = 0 WHERE id = :id"), {"id": account_id})

    return {"message": "Bank account deactivated"}


# ── Summary ──
@router.get("/summary")
def bank_accounts_summary():
    try:
        total_balance = run_s("SELECT COALESCE(SUM(current_balance), 0) FROM bank_accounts WHERE is_active = true")
        total_accounts = run_s("SELECT COUNT(*) FROM bank_accounts WHERE is_active = true")
        cash_count = run_s("SELECT COUNT(*) FROM bank_accounts WHERE is_active = true AND account_type = 'cash'")
        bank_count = run_s("SELECT COUNT(*) FROM bank_accounts WHERE is_active = true AND account_type = 'bank'")
        cash_balance = run_s("SELECT COALESCE(SUM(current_balance), 0) FROM bank_accounts WHERE is_active = true AND account_type = 'cash'")
        bank_balance = run_s("SELECT COALESCE(SUM(current_balance), 0) FROM bank_accounts WHERE is_active = true AND account_type = 'bank'")
    except Exception:
        total_balance = total_accounts = cash_count = bank_count = cash_balance = bank_balance = 0

    return {
        "total_balance": round(float(total_balance), 3),
        "total_accounts": int(total_accounts),
        "cash_count": int(cash_count),
        "bank_count": int(bank_count),
        "cash_balance": round(float(cash_balance), 3),
        "bank_balance": round(float(bank_balance), 3),
    }
