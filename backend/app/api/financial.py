"""Financial Dashboard API — P&L, cash flow, receivables, payables"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional
from datetime import date, datetime, timedelta
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.business_partner import Customer, Supplier
from app.models.inventory import StockLevel
import sqlite3

router = APIRouter()

def get_raw_db():
    conn = sqlite3.connect("warehouse.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

@router.get("/dashboard")
async def financial_dashboard(current_user: User = Depends(get_current_user)):
    conn = get_raw_db()
    c = conn.cursor()
    today = date.today()
    month_start = today.replace(day=1).isoformat()
    year_start = today.replace(month=1, day=1).isoformat()

    # Receivables (customers owe us)
    total_receivables = 0
    try:
        c.execute("SELECT COALESCE(SUM(total_amount - amount_paid), 0) FROM sales_invoices WHERE status != 'paid'")
        total_receivables = c.fetchone()[0] or 0
    except Exception: pass

    # Payables (we owe suppliers)
    total_payables = 0
    try:
        c.execute("SELECT COALESCE(SUM(total_amount - amount_paid), 0) FROM purchase_invoices WHERE status != 'paid'")
        total_payables = c.fetchone()[0] or 0
    except Exception: pass

    # Cash flow this month (payments in - payments out)
    cash_in = cash_out = 0
    try:
        c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_type='customer' AND payment_date >= ?", (month_start,))
        cash_in = c.fetchone()[0] or 0
        c.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_type='supplier' AND payment_date >= ?", (month_start,))
        cash_out = c.fetchone()[0] or 0
    except Exception: pass

    # Sales this month & year
    c.execute("SELECT COALESCE(SUM(total_amount), 0), COUNT(*) FROM sales_orders WHERE order_date >= ?", (month_start,))
    r = c.fetchone()
    sales_month = r[0] or 0; orders_month = r[1] or 0
    c.execute("SELECT COALESCE(SUM(total_amount), 0), COUNT(*) FROM sales_orders WHERE order_date >= ?", (year_start,))
    r = c.fetchone()
    sales_year = r[0] or 0; orders_year = r[1] or 0

    # Purchases this month
    c.execute("SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE order_date >= ?", (month_start,))
    purchases_month = c.fetchone()[0] or 0

    # Stock valuation
    c.execute("""SELECT COALESCE(SUM(sl.quantity_on_hand * COALESCE(p.cost_price, p.standard_cost, 0)), 0)
                 FROM stock_levels sl JOIN products p ON sl.product_id = p.id""")
    stock_value = c.fetchone()[0] or 0

    # Gross profit estimate this month
    c.execute("""SELECT COALESCE(SUM(soi.quantity_ordered * (soi.unit_price - COALESCE(soi.unit_cost, 0))), 0)
                 FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id
                 WHERE so.order_date >= ?""", (month_start,))
    gross_profit_month = c.fetchone()[0] or 0

    # Top 10 customers by revenue
    c.execute("""SELECT c.name, c.area, COALESCE(SUM(so.total_amount), 0) as total,
                 COUNT(so.id) as order_count
                 FROM customers c LEFT JOIN sales_orders so ON c.id = so.customer_id
                 GROUP BY c.id ORDER BY total DESC LIMIT 10""")
    top_customers = [{"name": r[0], "area": r[1], "revenue": round(r[2], 3), "orders": r[3]} for r in c.fetchall()]

    # Top 10 products by profit margin
    c.execute("""SELECT p.name, p.sku, COALESCE(p.selling_price, 0) as sell,
                 COALESCE(p.cost_price, p.standard_cost, 0) as cost,
                 COALESCE(SUM(soi.quantity_ordered), 0) as qty_sold
                 FROM products p LEFT JOIN sales_order_items soi ON p.id = soi.product_id
                 LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
                 WHERE p.is_active = 1
                 GROUP BY p.id ORDER BY (sell - cost) * qty_sold DESC LIMIT 10""")
    top_products = []
    for r in c.fetchall():
        margin = ((r[2] - r[3]) / r[2] * 100) if r[2] > 0 else 0
        top_products.append({"name": r[0], "sku": r[1], "selling_price": round(r[2], 3), "cost_price": round(r[3], 3), "margin_pct": round(margin, 1), "qty_sold": r[4], "profit": round((r[2] - r[3]) * r[4], 3)})

    # Monthly sales trend (last 12 months)
    monthly_trend = []
    for i in range(11, -1, -1):
        d = today - timedelta(days=i * 30)
        ms = d.replace(day=1).isoformat()
        if d.month == 12:
            me = d.replace(year=d.year + 1, month=1, day=1).isoformat()
        else:
            me = d.replace(month=d.month + 1, day=1).isoformat()
        c.execute("SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE order_date >= ? AND order_date < ?", (ms, me))
        sales = c.fetchone()[0] or 0
        c.execute("SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE order_date >= ? AND order_date < ?", (ms, me))
        purchases = c.fetchone()[0] or 0
        monthly_trend.append({"month": ms[:7], "sales": round(sales, 3), "purchases": round(purchases, 3), "net": round(sales - purchases, 3)})

    conn.close()
    return {
        "receivables": round(total_receivables, 3),
        "payables": round(total_payables, 3),
        "net_position": round(total_receivables - total_payables, 3),
        "cash_flow": {"month": {"in": round(cash_in, 3), "out": round(cash_out, 3), "net": round(cash_in - cash_out, 3)}},
        "sales": {"month": round(sales_month, 3), "year": round(sales_year, 3), "orders_month": orders_month, "orders_year": orders_year},
        "purchases_month": round(purchases_month, 3),
        "gross_profit_month": round(gross_profit_month, 3),
        "margin_pct": round(gross_profit_month / sales_month * 100, 1) if sales_month > 0 else 0,
        "stock_value": round(stock_value, 3),
        "top_customers": top_customers,
        "top_products": top_products,
        "monthly_trend": monthly_trend,
    }

@router.get("/profit-loss")
async def profit_loss(period: str = "month", from_date: Optional[str] = None, to_date: Optional[str] = None,
                      current_user: User = Depends(get_current_user)):
    conn = get_raw_db()
    c = conn.cursor()
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

    # Revenue
    c.execute("SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE order_date BETWEEN ? AND ?", (start, end))
    revenue = c.fetchone()[0] or 0
    # COGS
    c.execute("""SELECT COALESCE(SUM(soi.quantity_ordered * COALESCE(soi.unit_cost, 0)), 0)
                 FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id
                 WHERE so.order_date BETWEEN ? AND ?""", (start, end))
    cogs = c.fetchone()[0] or 0
    # Discounts given
    c.execute("SELECT COALESCE(SUM(discount_amount), 0) FROM sales_orders WHERE order_date BETWEEN ? AND ?", (start, end))
    discounts = c.fetchone()[0] or 0
    # Tax collected
    c.execute("SELECT COALESCE(SUM(tax_amount), 0) FROM sales_orders WHERE order_date BETWEEN ? AND ?", (start, end))
    tax_collected = c.fetchone()[0] or 0
    # Shipping/freight costs (graceful — Phase 2 columns may not exist)
    freight = 0
    try:
        c.execute("SELECT COALESCE(SUM(COALESCE(freight_cost,0) + COALESCE(customs_duty,0) + COALESCE(handling_cost,0) + COALESCE(insurance_cost,0) + COALESCE(local_transport_cost,0)), 0) FROM purchase_orders WHERE order_date BETWEEN ? AND ?", (start, end))
        freight = c.fetchone()[0] or 0
    except Exception:
        c.execute("SELECT COALESCE(SUM(shipping_cost), 0) FROM purchase_orders WHERE order_date BETWEEN ? AND ?", (start, end))
        freight = c.fetchone()[0] or 0

    gross_profit = revenue - cogs - discounts
    net_profit = gross_profit - freight

    conn.close()
    return {
        "period": {"from": start, "to": end, "type": period},
        "revenue": round(revenue, 3),
        "cost_of_goods_sold": round(cogs, 3),
        "discounts_given": round(discounts, 3),
        "gross_profit": round(gross_profit, 3),
        "gross_margin_pct": round(gross_profit / revenue * 100, 1) if revenue > 0 else 0,
        "operating_expenses": {"freight_customs": round(freight, 3)},
        "net_profit": round(net_profit, 3),
        "net_margin_pct": round(net_profit / revenue * 100, 1) if revenue > 0 else 0,
        "tax_collected": round(tax_collected, 3),
    }
