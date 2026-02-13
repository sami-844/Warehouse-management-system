"""Reports API — All business reports"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date, timedelta
from app.api.auth import get_current_user
from app.models.user import User
import sqlite3

router = APIRouter()

def get_db():
    conn = sqlite3.connect("warehouse.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

@router.get("/sales-by-customer")
async def sales_by_customer(from_date: Optional[str] = None, to_date: Optional[str] = None,
                            current_user: User = Depends(get_current_user)):
    conn = get_db()
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = conn.execute("""
        SELECT c.code, c.name, c.area, COUNT(so.id) as orders,
               COALESCE(SUM(so.total_amount), 0) as revenue,
               COALESCE(SUM(so.discount_amount), 0) as discounts,
               COALESCE(SUM(so.tax_amount), 0) as tax
        FROM customers c LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.order_date BETWEEN ? AND ?
        WHERE c.is_active = 1 GROUP BY c.id ORDER BY revenue DESC
    """, (start, end)).fetchall()
    conn.close()
    total_rev = sum(r['revenue'] for r in rows)
    return {"period": {"from": start, "to": end}, "total_revenue": round(total_rev, 3),
            "data": [{"code": r['code'], "name": r['name'], "area": r['area'], "orders": r['orders'],
                      "revenue": round(r['revenue'], 3), "discounts": round(r['discounts'], 3),
                      "pct_of_total": round(r['revenue'] / total_rev * 100, 1) if total_rev > 0 else 0} for r in rows]}

@router.get("/sales-by-product")
async def sales_by_product(from_date: Optional[str] = None, to_date: Optional[str] = None,
                           current_user: User = Depends(get_current_user)):
    conn = get_db()
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = conn.execute("""
        SELECT p.sku, p.name, COALESCE(SUM(soi.quantity_ordered), 0) as qty_sold,
               COALESCE(SUM(soi.total_price), 0) as revenue,
               COALESCE(SUM(soi.quantity_ordered * COALESCE(soi.unit_cost, 0)), 0) as cost,
               COALESCE(p.selling_price, 0) as sell_price, COALESCE(p.cost_price, 0) as cost_price
        FROM products p LEFT JOIN sales_order_items soi ON p.id = soi.product_id
        LEFT JOIN sales_orders so ON soi.sales_order_id = so.id AND so.order_date BETWEEN ? AND ?
        WHERE p.is_active = 1 GROUP BY p.id ORDER BY revenue DESC
    """, (start, end)).fetchall()
    conn.close()
    return {"period": {"from": start, "to": end},
            "data": [{"sku": r['sku'], "name": r['name'], "qty_sold": r['qty_sold'],
                      "revenue": round(r['revenue'], 3), "cost": round(r['cost'], 3),
                      "profit": round(r['revenue'] - r['cost'], 3),
                      "margin_pct": round((r['revenue'] - r['cost']) / r['revenue'] * 100, 1) if r['revenue'] > 0 else 0} for r in rows]}

@router.get("/purchase-by-supplier")
async def purchase_by_supplier(from_date: Optional[str] = None, to_date: Optional[str] = None,
                               current_user: User = Depends(get_current_user)):
    conn = get_db()
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = conn.execute("""
        SELECT s.code, s.name, COUNT(po.id) as orders,
               COALESCE(SUM(po.total_amount), 0) as total,
               COALESCE(SUM(po.shipping_cost), 0) as freight
        FROM suppliers s LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.order_date BETWEEN ? AND ?
        WHERE s.is_active = 1 GROUP BY s.id ORDER BY total DESC
    """, (start, end)).fetchall()
    conn.close()
    return {"period": {"from": start, "to": end},
            "data": [{"code": r['code'], "name": r['name'], "orders": r['orders'],
                      "total": round(r['total'], 3), "freight": round(r['freight'], 3)} for r in rows]}

@router.get("/stock-valuation")
async def stock_valuation(current_user: User = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("""
        SELECT p.sku, p.name, p.unit_of_measure, COALESCE(p.cost_price, p.standard_cost, 0) as unit_cost,
               COALESCE(p.selling_price, 0) as sell_price,
               COALESCE(SUM(sl.quantity_on_hand), 0) as qty_on_hand,
               COALESCE(SUM(sl.quantity_on_hand), 0) * COALESCE(p.cost_price, p.standard_cost, 0) as stock_value,
               COALESCE(SUM(sl.quantity_on_hand), 0) * COALESCE(p.selling_price, 0) as retail_value
        FROM products p LEFT JOIN stock_levels sl ON p.id = sl.product_id
        WHERE p.is_active = 1 GROUP BY p.id ORDER BY stock_value DESC
    """).fetchall()
    conn.close()
    total_cost = sum(r['stock_value'] for r in rows)
    total_retail = sum(r['retail_value'] for r in rows)
    return {"total_cost_value": round(total_cost, 3), "total_retail_value": round(total_retail, 3),
            "potential_profit": round(total_retail - total_cost, 3),
            "data": [{"sku": r['sku'], "name": r['name'], "unit": r['unit_of_measure'],
                      "unit_cost": round(r['unit_cost'], 3), "sell_price": round(r['sell_price'], 3),
                      "qty": r['qty_on_hand'], "stock_value": round(r['stock_value'], 3),
                      "retail_value": round(r['retail_value'], 3)} for r in rows]}

@router.get("/inventory-movements")
async def inventory_movements(from_date: Optional[str] = None, to_date: Optional[str] = None,
                              product_id: Optional[int] = None,
                              current_user: User = Depends(get_current_user)):
    conn = get_db()
    today = date.today()
    start = from_date or (today - timedelta(days=30)).isoformat()
    end = to_date or today.isoformat()
    query = """
        SELECT it.transaction_date, it.transaction_type, it.quantity, it.reference_number, it.notes,
               p.name as product, w.name as warehouse
        FROM inventory_transactions it
        JOIN products p ON it.product_id = p.id
        JOIN warehouses w ON it.warehouse_id = w.id
        WHERE it.transaction_date BETWEEN ? AND ?
    """
    params = [start, end]
    if product_id:
        query += " AND it.product_id = ?"
        params.append(product_id)
    query += " ORDER BY it.transaction_date DESC LIMIT 500"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return {"period": {"from": start, "to": end}, "count": len(rows),
            "data": [{"date": r['transaction_date'], "type": r['transaction_type'], "qty": r['quantity'],
                      "product": r['product'], "warehouse": r['warehouse'],
                      "reference": r['reference_number'], "notes": r['notes']} for r in rows]}

@router.get("/dead-stock")
async def dead_stock(days: int = 90, current_user: User = Depends(get_current_user)):
    conn = get_db()
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    rows = conn.execute("""
        SELECT p.sku, p.name, COALESCE(SUM(sl.quantity_on_hand), 0) as qty,
               COALESCE(SUM(sl.quantity_on_hand), 0) * COALESCE(p.cost_price, 0) as value,
               MAX(it.transaction_date) as last_movement
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        LEFT JOIN inventory_transactions it ON p.id = it.product_id AND it.transaction_type = 'ISSUE'
        WHERE p.is_active = 1
        GROUP BY p.id
        HAVING qty > 0 AND (last_movement IS NULL OR last_movement < ?)
        ORDER BY value DESC
    """, (cutoff,)).fetchall()
    conn.close()
    total = sum(r['value'] for r in rows)
    return {"threshold_days": days, "total_dead_stock_value": round(total, 3), "count": len(rows),
            "data": [{"sku": r['sku'], "name": r['name'], "qty": r['qty'],
                      "value": round(r['value'], 3), "last_sold": r['last_movement'] or "Never"} for r in rows]}

@router.get("/delivery-performance")
async def delivery_performance(from_date: Optional[str] = None, to_date: Optional[str] = None,
                               current_user: User = Depends(get_current_user)):
    conn = get_db()
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = conn.execute("""
        SELECT d.driver_name, d.vehicle, COUNT(*) as total,
               SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
               SUM(CASE WHEN d.status = 'scheduled' THEN 1 ELSE 0 END) as pending,
               d.route_area
        FROM deliveries d
        WHERE d.scheduled_date BETWEEN ? AND ?
        GROUP BY d.driver_name, d.vehicle
        ORDER BY total DESC
    """, (start, end)).fetchall()
    conn.close()
    return {"period": {"from": start, "to": end},
            "data": [{"driver": r['driver_name'] or 'Unassigned', "vehicle": r['vehicle'] or '-',
                      "total": r['total'], "delivered": r['delivered'], "pending": r['pending'],
                      "completion_pct": round(r['delivered'] / r['total'] * 100, 1) if r['total'] > 0 else 0} for r in rows]}

@router.get("/receivables-aging")
async def receivables_aging(current_user: User = Depends(get_current_user)):
    conn = get_db()
    today = date.today()
    rows = conn.execute("""
        SELECT si.invoice_number, c.name, c.area, c.phone, si.invoice_date, si.due_date,
               si.total_amount, si.amount_paid, (si.total_amount - si.amount_paid) as balance
        FROM sales_invoices si JOIN customers c ON si.customer_id = c.id
        WHERE si.status != 'paid' ORDER BY si.due_date ASC
    """).fetchall()
    conn.close()
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    items = []
    for r in rows:
        bal = r['balance']
        days = (today - date.fromisoformat(r['due_date'])).days
        if days <= 0: buckets["current"] += bal
        elif days <= 30: buckets["1_30"] += bal
        elif days <= 60: buckets["31_60"] += bal
        elif days <= 90: buckets["61_90"] += bal
        else: buckets["over_90"] += bal
        items.append({"invoice": r['invoice_number'], "customer": r['name'], "area": r['area'],
                      "phone": r['phone'], "due_date": r['due_date'], "total": round(r['total_amount'], 3),
                      "paid": round(r['amount_paid'], 3), "balance": round(bal, 3), "days_overdue": max(days, 0)})
    return {"buckets": {k: round(v, 3) for k, v in buckets.items()}, "total": round(sum(buckets.values()), 3), "items": items}

@router.get("/payables-aging")
async def payables_aging(current_user: User = Depends(get_current_user)):
    conn = get_db()
    today = date.today()
    rows = conn.execute("""
        SELECT pi.invoice_number, s.name, pi.invoice_date, pi.due_date,
               pi.total_amount, pi.amount_paid, (pi.total_amount - pi.amount_paid) as balance
        FROM purchase_invoices pi JOIN suppliers s ON pi.supplier_id = s.id
        WHERE pi.status != 'paid' ORDER BY pi.due_date ASC
    """).fetchall()
    conn.close()
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    items = []
    for r in rows:
        bal = r['balance']
        days = (today - date.fromisoformat(r['due_date'])).days
        if days <= 0: buckets["current"] += bal
        elif days <= 30: buckets["1_30"] += bal
        elif days <= 60: buckets["31_60"] += bal
        elif days <= 90: buckets["61_90"] += bal
        else: buckets["over_90"] += bal
        items.append({"invoice": r['invoice_number'], "supplier": r['name'], "due_date": r['due_date'],
                      "total": round(r['total_amount'], 3), "paid": round(r['amount_paid'], 3),
                      "balance": round(bal, 3), "days_overdue": max(days, 0)})
    return {"buckets": {k: round(v, 3) for k, v in buckets.items()}, "total": round(sum(buckets.values()), 3), "items": items}

@router.get("/expiry-report")
async def expiry_report(days: int = 90, current_user: User = Depends(get_current_user)):
    conn = get_db()
    cutoff = (date.today() + timedelta(days=days)).isoformat()
    today_str = date.today().isoformat()
    rows = conn.execute("""
        SELECT p.sku, p.name, it.batch_number, it.expiry_date, it.quantity,
               COALESCE(p.cost_price, 0) as unit_cost, w.name as warehouse
        FROM inventory_transactions it
        JOIN products p ON it.product_id = p.id
        JOIN warehouses w ON it.warehouse_id = w.id
        WHERE it.expiry_date IS NOT NULL AND it.expiry_date <= ? AND it.quantity > 0
        ORDER BY it.expiry_date ASC
    """, (cutoff,)).fetchall()
    conn.close()
    expired = [r for r in rows if r['expiry_date'] <= today_str]
    expiring = [r for r in rows if r['expiry_date'] > today_str]
    def fmt(r):
        return {"sku": r['sku'], "name": r['name'], "batch": r['batch_number'], "expiry": r['expiry_date'],
                "qty": r['quantity'], "value": round(r['quantity'] * r['unit_cost'], 3), "warehouse": r['warehouse']}
    return {"expired_count": len(expired), "expiring_count": len(expiring), "threshold_days": days,
            "expired_value": round(sum(r['quantity'] * r['unit_cost'] for r in expired), 3),
            "expired": [fmt(r) for r in expired], "expiring_soon": [fmt(r) for r in expiring]}
