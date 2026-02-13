"""
Multi-Currency API — Phase 5c
Provides financial dashboard data in multiple currencies.
OMR is base currency. Rates stored in company_settings.
"""
from fastapi import APIRouter, HTTPException, Query
import sqlite3, os

router = APIRouter()
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "warehouse.db")

# Default exchange rates (OMR → X). OMR is pegged to USD at ~2.6008
DEFAULT_RATES = {
    "OMR": 1.0,
    "USD": 2.6008,
    "EUR": 2.3800,
    "GBP": 2.0700,
    "INR": 217.50,
    "AED": 9.5500,
    "SAR": 9.7500,
}


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def get_rates(conn):
    """Get exchange rates from settings, falling back to defaults."""
    rates = dict(DEFAULT_RATES)
    try:
        rows = conn.execute(
            "SELECT setting_key, setting_value FROM company_settings WHERE setting_key LIKE 'rate_%'"
        ).fetchall()
        for r in rows:
            currency = r["setting_key"].replace("rate_", "").upper()
            try:
                rates[currency] = float(r["setting_value"])
            except:
                pass
    except:
        pass
    return rates


def convert(amount_omr, rate):
    return round((amount_omr or 0) * rate, 3)


# ── Get Exchange Rates ──
@router.get("/rates")
def get_exchange_rates():
    conn = get_db()
    rates = get_rates(conn)
    conn.close()
    return {"base_currency": "OMR", "rates": rates}


# ── Update Exchange Rate ──
@router.put("/rates/{currency}")
def update_rate(currency: str, rate: float = Query(..., gt=0)):
    currency = currency.upper()
    conn = get_db()
    key = f"rate_{currency}"
    conn.execute("""
        INSERT INTO company_settings (setting_key, setting_value, setting_type, updated_at)
        VALUES (?, ?, 'number', CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value=?, updated_at=CURRENT_TIMESTAMP
    """, (key, str(rate), str(rate)))
    conn.commit()
    conn.close()
    return {"message": f"Rate updated: 1 OMR = {rate} {currency}"}


# ── Multi-Currency Financial Dashboard ──
@router.get("/dashboard")
def multicurrency_dashboard(currencies: str = Query(default="OMR,USD")):
    """Financial dashboard with data in multiple currencies."""
    conn = get_db()
    rates = get_rates(conn)
    requested = [c.strip().upper() for c in currencies.split(",")]

    # Get base OMR figures
    try:
        total_sales = conn.execute(
            "SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE status NOT IN ('cancelled', 'draft')"
        ).fetchone()[0]
    except:
        total_sales = 0

    try:
        total_purchases = conn.execute(
            "SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE status NOT IN ('cancelled', 'draft')"
        ).fetchone()[0]
    except:
        total_purchases = 0

    try:
        total_receivables = conn.execute(
            "SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, 0)), 0) FROM sales_invoices WHERE status NOT IN ('paid', 'cancelled')"
        ).fetchone()[0]
    except:
        total_receivables = 0

    try:
        total_payables = conn.execute(
            "SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, 0)), 0) FROM purchase_invoices WHERE status NOT IN ('paid', 'cancelled')"
        ).fetchone()[0]
    except:
        total_payables = 0

    try:
        stock_value = conn.execute(
            "SELECT COALESCE(SUM(quantity_remaining * cost_price), 0) FROM batch_inventory WHERE status='active'"
        ).fetchone()[0]
    except:
        stock_value = 0

    try:
        credit_notes_value = conn.execute(
            "SELECT COALESCE(SUM(total_amount), 0) FROM credit_notes WHERE status='issued'"
        ).fetchone()[0]
    except:
        credit_notes_value = 0

    conn.close()

    gross_profit = total_sales - total_purchases
    base = {
        "total_sales": round(total_sales, 3),
        "total_purchases": round(total_purchases, 3),
        "gross_profit": round(gross_profit, 3),
        "total_receivables": round(total_receivables, 3),
        "total_payables": round(total_payables, 3),
        "net_receivables": round(total_receivables - total_payables, 3),
        "stock_value": round(stock_value, 3),
        "open_credit_notes": round(credit_notes_value, 3),
    }

    # Convert to all requested currencies
    multi = {}
    for curr in requested:
        rate = rates.get(curr, 1.0)
        multi[curr] = {
            "rate": rate,
            "total_sales": convert(base["total_sales"], rate),
            "total_purchases": convert(base["total_purchases"], rate),
            "gross_profit": convert(base["gross_profit"], rate),
            "total_receivables": convert(base["total_receivables"], rate),
            "total_payables": convert(base["total_payables"], rate),
            "net_receivables": convert(base["net_receivables"], rate),
            "stock_value": convert(base["stock_value"], rate),
            "open_credit_notes": convert(base["open_credit_notes"], rate),
        }

    return {
        "base_currency": "OMR",
        "base_figures": base,
        "currencies": multi,
        "available_rates": rates,
    }
