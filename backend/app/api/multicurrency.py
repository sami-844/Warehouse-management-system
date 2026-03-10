"""
Multi-Currency API — Phase 5c
Provides financial dashboard data in multiple currencies.
OMR is base currency. Rates stored in company_settings.
"""
from fastapi import APIRouter, Query
from sqlalchemy import text
from app.core.database import engine

router = APIRouter()

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


def run_s(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        row = result.fetchone()
        return row[0] if row and row[0] is not None else 0


def get_rates():
    """Get exchange rates from company_settings, falling back to defaults."""
    rates = dict(DEFAULT_RATES)
    try:
        with engine.connect() as conn:
            rows = conn.execute(text(
                "SELECT setting_key, setting_value FROM company_settings WHERE setting_key LIKE 'rate_%'"
            )).fetchall()
            for r in rows:
                currency = r[0].replace("rate_", "").upper()
                try:
                    rates[currency] = float(r[1])
                except Exception:
                    pass
    except Exception:
        pass
    return rates


def convert(amount_omr, rate):
    return round((amount_omr or 0) * rate, 3)


# ── Get Exchange Rates ──
@router.get("/rates")
def get_exchange_rates():
    return {"base_currency": "OMR", "rates": get_rates()}


# ── Update Exchange Rate ──
@router.put("/rates/{currency}")
def update_rate(currency: str, rate: float = Query(..., gt=0)):
    currency = currency.upper()
    key = f"rate_{currency}"
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO company_settings (setting_key, setting_value, setting_type, updated_at)
            VALUES (:key, :val, 'number', CURRENT_TIMESTAMP)
            ON CONFLICT(setting_key) DO UPDATE SET setting_value=:val, updated_at=CURRENT_TIMESTAMP
        """), {"key": key, "val": str(rate)})
    return {"message": f"Rate updated: 1 OMR = {rate} {currency}"}


# ── Multi-Currency Financial Dashboard ──
@router.get("/dashboard")
def multicurrency_dashboard(currencies: str = Query(default="OMR,USD")):
    """Financial dashboard with data in multiple currencies."""
    rates = get_rates()
    requested = [c.strip().upper() for c in currencies.split(",")]

    # Get base OMR figures
    total_sales = 0
    try:
        total_sales = run_s(
            "SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE status NOT IN ('cancelled', 'draft')"
        )
    except Exception:
        pass

    total_purchases = 0
    try:
        total_purchases = run_s(
            "SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE status NOT IN ('cancelled', 'draft')"
        )
    except Exception:
        pass

    total_receivables = 0
    try:
        total_receivables = run_s(
            "SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, 0)), 0) FROM sales_invoices WHERE status NOT IN ('paid', 'cancelled')"
        )
    except Exception:
        pass

    total_payables = 0
    try:
        total_payables = run_s(
            "SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, 0)), 0) FROM purchase_invoices WHERE status NOT IN ('paid', 'cancelled')"
        )
    except Exception:
        pass

    # Stock value — use stock_levels JOIN products (batch_inventory doesn't exist)
    stock_value = 0
    try:
        stock_value = run_s("""
            SELECT COALESCE(SUM(sl.quantity_on_hand * COALESCE(p.standard_cost, 0)), 0)
            FROM stock_levels sl
            JOIN products p ON sl.product_id = p.id
        """)
    except Exception:
        pass

    # Credit notes — graceful if table doesn't exist
    credit_notes_value = 0
    try:
        credit_notes_value = run_s(
            "SELECT COALESCE(SUM(total_amount), 0) FROM credit_notes WHERE status='issued'"
        )
    except Exception:
        pass

    gross_profit = float(total_sales) - float(total_purchases)
    base = {
        "total_sales": round(float(total_sales), 3),
        "total_purchases": round(float(total_purchases), 3),
        "gross_profit": round(gross_profit, 3),
        "total_receivables": round(float(total_receivables), 3),
        "total_payables": round(float(total_payables), 3),
        "net_receivables": round(float(total_receivables) - float(total_payables), 3),
        "stock_value": round(float(stock_value), 3),
        "open_credit_notes": round(float(credit_notes_value), 3),
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
