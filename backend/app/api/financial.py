"""Financial Dashboard API — P&L, cash flow, receivables, payables"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from typing import Optional
from datetime import date, timedelta
from app.core.database import engine
from app.api.auth import get_current_user
from app.models.user import User

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


@router.get("/dashboard")
async def financial_dashboard(current_user: User = Depends(get_current_user)):
    today = date.today()
    month_start = today.replace(day=1).isoformat()
    year_start = today.replace(month=1, day=1).isoformat()

    # Receivables (customers owe us)
    total_receivables = 0
    try:
        total_receivables = run_s(
            "SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid,0)), 0) FROM sales_invoices WHERE status != 'paid'"
        )
    except Exception:
        pass

    # Payables (we owe suppliers)
    total_payables = 0
    try:
        total_payables = run_s(
            "SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid,0)), 0) FROM purchase_invoices WHERE status != 'paid'"
        )
    except Exception:
        pass

    # Cash flow this month
    cash_in = cash_out = 0
    try:
        cash_in = run_s(
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_type='customer' AND payment_date >= :ms",
            {"ms": month_start}
        )
        cash_out = run_s(
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_type='supplier' AND payment_date >= :ms",
            {"ms": month_start}
        )
    except Exception:
        pass

    # Sales this month & year
    sales_month = run_s(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE order_date >= :ms",
        {"ms": month_start}
    )
    orders_month = run_s(
        "SELECT COUNT(*) FROM sales_orders WHERE order_date >= :ms",
        {"ms": month_start}
    )
    sales_year = run_s(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE order_date >= :ys",
        {"ys": year_start}
    )
    orders_year = run_s(
        "SELECT COUNT(*) FROM sales_orders WHERE order_date >= :ys",
        {"ys": year_start}
    )

    # Purchases this month
    purchases_month = run_s(
        "SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE order_date >= :ms",
        {"ms": month_start}
    )

    # Stock valuation — use stock_levels.quantity_on_hand * standard_cost
    stock_value = run_s("""
        SELECT COALESCE(SUM(sl.quantity_on_hand * COALESCE(p.standard_cost, 0)), 0)
        FROM stock_levels sl
        JOIN products p ON sl.product_id = p.id
    """)

    # Gross profit estimate this month
    gross_profit_month = 0
    try:
        gross_profit_month = run_s("""
            SELECT COALESCE(SUM(soi.quantity_ordered * (soi.unit_price - COALESCE(soi.unit_cost, 0))), 0)
            FROM sales_order_items soi
            JOIN sales_orders so ON soi.sales_order_id = so.id
            WHERE so.order_date >= :ms
        """, {"ms": month_start})
    except Exception:
        pass

    # Top 10 customers by revenue
    top_customers = []
    try:
        rows = run_q("""
            SELECT c.name, c.area, COALESCE(SUM(so.total_amount), 0) as total,
                   COUNT(so.id) as order_count
            FROM customers c
            LEFT JOIN sales_orders so ON c.id = so.customer_id
            GROUP BY c.id, c.name, c.area
            ORDER BY total DESC LIMIT 10
        """)
        top_customers = [
            {"name": r["name"], "area": r["area"],
             "revenue": round(float(r["total"] or 0), 3), "orders": r["order_count"]}
            for r in rows
        ]
    except Exception:
        pass

    # Top 10 products by profit
    top_products = []
    try:
        rows = run_q("""
            SELECT p.name, p.sku,
                   COALESCE(p.selling_price, 0) as sell,
                   COALESCE(p.standard_cost, 0) as cost,
                   COALESCE(SUM(soi.quantity_ordered), 0) as qty_sold
            FROM products p
            LEFT JOIN sales_order_items soi ON p.id = soi.product_id
            LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
            WHERE p.is_active = true
            GROUP BY p.id, p.name, p.sku, p.selling_price, p.standard_cost
            ORDER BY (COALESCE(p.selling_price,0) - COALESCE(p.standard_cost,0)) *
                     COALESCE(SUM(soi.quantity_ordered),0) DESC
            LIMIT 10
        """)
        for r in rows:
            sell = float(r["sell"] or 0)
            cost = float(r["cost"] or 0)
            qty = float(r["qty_sold"] or 0)
            margin = ((sell - cost) / sell * 100) if sell > 0 else 0
            top_products.append({
                "name": r["name"], "sku": r["sku"],
                "selling_price": round(sell, 3), "cost_price": round(cost, 3),
                "margin_pct": round(margin, 1), "qty_sold": int(qty),
                "profit": round((sell - cost) * qty, 3)
            })
    except Exception:
        pass

    # Monthly sales trend (last 12 months)
    monthly_trend = []
    for i in range(11, -1, -1):
        d = today - timedelta(days=i * 30)
        ms = d.replace(day=1).isoformat()
        if d.month == 12:
            me = d.replace(year=d.year + 1, month=1, day=1).isoformat()
        else:
            me = d.replace(month=d.month + 1, day=1).isoformat()
        sales = run_s(
            "SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE order_date >= :ms AND order_date < :me",
            {"ms": ms, "me": me}
        )
        purchases = run_s(
            "SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE order_date >= :ms AND order_date < :me",
            {"ms": ms, "me": me}
        )
        monthly_trend.append({
            "month": ms[:7],
            "sales": round(float(sales), 3),
            "purchases": round(float(purchases), 3),
            "net": round(float(sales) - float(purchases), 3)
        })

    return {
        "receivables": round(float(total_receivables), 3),
        "payables": round(float(total_payables), 3),
        "net_position": round(float(total_receivables) - float(total_payables), 3),
        "cash_flow": {"month": {
            "in": round(float(cash_in), 3),
            "out": round(float(cash_out), 3),
            "net": round(float(cash_in) - float(cash_out), 3)
        }},
        "sales": {
            "month": round(float(sales_month), 3),
            "year": round(float(sales_year), 3),
            "orders_month": int(orders_month),
            "orders_year": int(orders_year)
        },
        "purchases_month": round(float(purchases_month), 3),
        "gross_profit_month": round(float(gross_profit_month), 3),
        "margin_pct": round(float(gross_profit_month) / float(sales_month) * 100, 1) if sales_month else 0,
        "stock_value": round(float(stock_value), 3),
        "top_customers": top_customers,
        "top_products": top_products,
        "monthly_trend": monthly_trend,
    }


@router.get("/profit-loss")
async def profit_loss(
    period: str = "month",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    today = date.today()
    if from_date and to_date:
        start, end = from_date, to_date
    elif period == "month":
        start = today.replace(day=1).isoformat()
        end = today.isoformat()
    elif period == "quarter":
        q = (today.month - 1) // 3
        start = today.replace(month=q * 3 + 1, day=1).isoformat()
        end = today.isoformat()
    else:  # year
        start = today.replace(month=1, day=1).isoformat()
        end = today.isoformat()

    revenue = run_s(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE order_date BETWEEN :s AND :e",
        {"s": start, "e": end}
    )
    cogs = run_s("""
        SELECT COALESCE(SUM(soi.quantity_ordered * COALESCE(soi.unit_cost, 0)), 0)
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.sales_order_id = so.id
        WHERE so.order_date BETWEEN :s AND :e
    """, {"s": start, "e": end})
    discounts = run_s(
        "SELECT COALESCE(SUM(discount_amount), 0) FROM sales_orders WHERE order_date BETWEEN :s AND :e",
        {"s": start, "e": end}
    )
    tax_collected = run_s(
        "SELECT COALESCE(SUM(tax_amount), 0) FROM sales_orders WHERE order_date BETWEEN :s AND :e",
        {"s": start, "e": end}
    )

    freight = 0
    try:
        freight = run_s("""
            SELECT COALESCE(SUM(
                COALESCE(freight_cost,0) + COALESCE(customs_duty,0) +
                COALESCE(handling_cost,0) + COALESCE(insurance_cost,0) +
                COALESCE(local_transport_cost,0)
            ), 0)
            FROM purchase_orders
            WHERE order_date BETWEEN :s AND :e
        """, {"s": start, "e": end})
    except Exception:
        try:
            freight = run_s(
                "SELECT COALESCE(SUM(shipping_cost), 0) FROM purchase_orders WHERE order_date BETWEEN :s AND :e",
                {"s": start, "e": end}
            )
        except Exception:
            freight = 0

    gross_profit = float(revenue) - float(cogs) - float(discounts)
    net_profit = gross_profit - float(freight)

    return {
        "period": {"from": start, "to": end, "type": period},
        "revenue": round(float(revenue), 3),
        "cost_of_goods_sold": round(float(cogs), 3),
        "discounts_given": round(float(discounts), 3),
        "gross_profit": round(gross_profit, 3),
        "gross_margin_pct": round(gross_profit / float(revenue) * 100, 1) if revenue else 0,
        "operating_expenses": {"freight_customs": round(float(freight), 3)},
        "net_profit": round(net_profit, 3),
        "net_margin_pct": round(net_profit / float(revenue) * 100, 1) if revenue else 0,
        "tax_collected": round(float(tax_collected), 3),
    }
