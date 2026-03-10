"""Reports API — All business reports"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date, timedelta
from sqlalchemy import text
from app.core.database import engine
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter()


def run_q(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


@router.get("/sales-by-customer")
async def sales_by_customer(from_date: Optional[str] = None, to_date: Optional[str] = None,
                            current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = run_q("""
        SELECT c.code, c.name, c.area, COUNT(so.id) as orders,
               COALESCE(SUM(so.total_amount), 0) as revenue,
               COALESCE(SUM(so.discount_amount), 0) as discounts,
               COALESCE(SUM(so.tax_amount), 0) as tax
        FROM customers c
        LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.order_date BETWEEN :start AND :end
        WHERE c.is_active = true
        GROUP BY c.id, c.code, c.name, c.area
        ORDER BY revenue DESC
    """, {"start": start, "end": end})
    total_rev = sum(float(r['revenue'] or 0) for r in rows)
    return {
        "period": {"from": start, "to": end},
        "total_revenue": round(total_rev, 3),
        "data": [{
            "code": r['code'], "name": r['name'], "area": r['area'],
            "orders": r['orders'],
            "revenue": round(float(r['revenue'] or 0), 3),
            "discounts": round(float(r['discounts'] or 0), 3),
            "pct_of_total": round(float(r['revenue'] or 0) / total_rev * 100, 1) if total_rev > 0 else 0,
        } for r in rows],
    }


@router.get("/sales-by-product")
async def sales_by_product(from_date: Optional[str] = None, to_date: Optional[str] = None,
                           current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = run_q("""
        SELECT p.sku, p.name,
               COALESCE(SUM(soi.quantity_ordered), 0) as qty_sold,
               COALESCE(SUM(soi.total_price), 0) as revenue,
               COALESCE(SUM(soi.quantity_ordered * COALESCE(soi.unit_cost, 0)), 0) as cost
        FROM products p
        LEFT JOIN sales_order_items soi ON p.id = soi.product_id
        LEFT JOIN sales_orders so ON soi.sales_order_id = so.id AND so.order_date BETWEEN :start AND :end
        WHERE p.is_active = true
        GROUP BY p.id, p.sku, p.name
        ORDER BY revenue DESC
    """, {"start": start, "end": end})
    return {
        "period": {"from": start, "to": end},
        "data": [{
            "sku": r['sku'], "name": r['name'], "qty_sold": r['qty_sold'],
            "revenue": round(float(r['revenue'] or 0), 3),
            "cost": round(float(r['cost'] or 0), 3),
            "profit": round(float(r['revenue'] or 0) - float(r['cost'] or 0), 3),
            "margin_pct": round(
                (float(r['revenue'] or 0) - float(r['cost'] or 0)) / float(r['revenue']) * 100, 1
            ) if float(r['revenue'] or 0) > 0 else 0,
        } for r in rows],
    }


@router.get("/purchase-by-supplier")
async def purchase_by_supplier(from_date: Optional[str] = None, to_date: Optional[str] = None,
                               current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = run_q("""
        SELECT s.code, s.name, COUNT(po.id) as orders,
               COALESCE(SUM(po.total_amount), 0) as total,
               COALESCE(SUM(po.shipping_cost), 0) as freight
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.order_date BETWEEN :start AND :end
        WHERE s.is_active = true
        GROUP BY s.id, s.code, s.name
        ORDER BY total DESC
    """, {"start": start, "end": end})
    return {
        "period": {"from": start, "to": end},
        "data": [{
            "code": r['code'], "name": r['name'], "orders": r['orders'],
            "total": round(float(r['total'] or 0), 3),
            "freight": round(float(r['freight'] or 0), 3),
        } for r in rows],
    }


@router.get("/stock-valuation")
async def stock_valuation(current_user: User = Depends(get_current_user)):
    rows = run_q("""
        SELECT p.sku, p.name, p.unit_of_measure,
               COALESCE(p.standard_cost, 0) as unit_cost,
               COALESCE(p.selling_price, 0) as sell_price,
               COALESCE(SUM(sl.quantity_on_hand), 0) as qty_on_hand,
               COALESCE(SUM(sl.quantity_on_hand), 0) * COALESCE(p.standard_cost, 0) as stock_value,
               COALESCE(SUM(sl.quantity_on_hand), 0) * COALESCE(p.selling_price, 0) as retail_value
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        WHERE p.is_active = true
        GROUP BY p.id, p.sku, p.name, p.unit_of_measure, p.standard_cost, p.selling_price
        ORDER BY stock_value DESC
    """)
    total_cost = sum(float(r['stock_value'] or 0) for r in rows)
    total_retail = sum(float(r['retail_value'] or 0) for r in rows)
    return {
        "total_cost_value": round(total_cost, 3),
        "total_retail_value": round(total_retail, 3),
        "potential_profit": round(total_retail - total_cost, 3),
        "data": [{
            "sku": r['sku'], "name": r['name'], "unit": r['unit_of_measure'],
            "unit_cost": round(float(r['unit_cost'] or 0), 3),
            "sell_price": round(float(r['sell_price'] or 0), 3),
            "qty": r['qty_on_hand'],
            "stock_value": round(float(r['stock_value'] or 0), 3),
            "retail_value": round(float(r['retail_value'] or 0), 3),
        } for r in rows],
    }


@router.get("/inventory-movements")
async def inventory_movements(from_date: Optional[str] = None, to_date: Optional[str] = None,
                              product_id: Optional[int] = None,
                              current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or (today - timedelta(days=30)).isoformat()
    end = to_date or today.isoformat()
    where = ["it.transaction_date BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end, "limit": 500}
    if product_id:
        where.append("it.product_id = :product_id")
        params["product_id"] = product_id
    rows = run_q(f"""
        SELECT it.transaction_date, it.transaction_type, it.quantity,
               it.reference_number, it.notes,
               p.name as product, w.name as warehouse
        FROM inventory_transactions it
        JOIN products p ON it.product_id = p.id
        JOIN warehouses w ON it.warehouse_id = w.id
        WHERE {" AND ".join(where)}
        ORDER BY it.transaction_date DESC LIMIT :limit
    """, params)
    return {
        "period": {"from": start, "to": end},
        "count": len(rows),
        "data": [{
            "date": str(r['transaction_date']), "type": r['transaction_type'],
            "qty": r['quantity'], "product": r['product'], "warehouse": r['warehouse'],
            "reference": r['reference_number'], "notes": r['notes'],
        } for r in rows],
    }


@router.get("/dead-stock")
async def dead_stock(days: int = 90, current_user: User = Depends(get_current_user)):
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    rows = run_q("""
        SELECT p.sku, p.name,
               COALESCE(SUM(sl.quantity_on_hand), 0) as qty,
               COALESCE(SUM(sl.quantity_on_hand), 0) * COALESCE(p.standard_cost, 0) as value,
               MAX(it.transaction_date) as last_movement
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        LEFT JOIN inventory_transactions it ON p.id = it.product_id AND it.transaction_type = 'issue'
        WHERE p.is_active = true
        GROUP BY p.id, p.sku, p.name, p.standard_cost
        HAVING COALESCE(SUM(sl.quantity_on_hand), 0) > 0
           AND (MAX(it.transaction_date) IS NULL OR MAX(it.transaction_date) < :cutoff)
        ORDER BY value DESC
    """, {"cutoff": cutoff})
    total = sum(float(r['value'] or 0) for r in rows)
    return {
        "threshold_days": days,
        "total_dead_stock_value": round(total, 3),
        "count": len(rows),
        "data": [{
            "sku": r['sku'], "name": r['name'], "qty": r['qty'],
            "value": round(float(r['value'] or 0), 3),
            "last_sold": str(r['last_movement']) if r['last_movement'] else "Never",
        } for r in rows],
    }


@router.get("/delivery-performance")
async def delivery_performance(from_date: Optional[str] = None, to_date: Optional[str] = None,
                               current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT d.driver_name, d.vehicle, COUNT(*) as total,
                   SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                   SUM(CASE WHEN d.status IN ('pending', 'scheduled') THEN 1 ELSE 0 END) as pending
            FROM deliveries d
            WHERE d.scheduled_date BETWEEN :start AND :end
            GROUP BY d.driver_name, d.vehicle
            ORDER BY total DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []
    return {
        "period": {"from": start, "to": end},
        "data": [{
            "driver": r['driver_name'] or 'Unassigned', "vehicle": r['vehicle'] or '-',
            "total": r['total'], "delivered": r['delivered'], "pending": r['pending'],
            "completion_pct": round(r['delivered'] / r['total'] * 100, 1) if r['total'] > 0 else 0,
        } for r in rows],
    }


@router.get("/receivables-aging")
async def receivables_aging(current_user: User = Depends(get_current_user)):
    today = date.today()
    try:
        rows = run_q("""
            SELECT si.invoice_number, c.name, c.area, c.phone,
                   si.invoice_date, si.due_date,
                   si.total_amount, si.amount_paid,
                   (si.total_amount - si.amount_paid) as balance
            FROM sales_invoices si
            JOIN customers c ON si.customer_id = c.id
            WHERE si.status != 'paid'
            ORDER BY si.due_date ASC
        """)
    except Exception:
        rows = []
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    items = []
    for r in rows:
        bal = float(r['balance'] or 0)
        try:
            days = (today - date.fromisoformat(str(r['due_date'])[:10])).days
        except Exception:
            days = 0
        if days <= 0:
            buckets["current"] += bal
        elif days <= 30:
            buckets["1_30"] += bal
        elif days <= 60:
            buckets["31_60"] += bal
        elif days <= 90:
            buckets["61_90"] += bal
        else:
            buckets["over_90"] += bal
        items.append({
            "invoice": r['invoice_number'], "customer": r['name'],
            "area": r.get('area'), "phone": r['phone'],
            "due_date": str(r['due_date']),
            "total": round(float(r['total_amount'] or 0), 3),
            "paid": round(float(r['amount_paid'] or 0), 3),
            "balance": round(bal, 3), "days_overdue": max(days, 0),
        })
    return {"buckets": {k: round(v, 3) for k, v in buckets.items()},
            "total": round(sum(buckets.values()), 3), "items": items}


@router.get("/payables-aging")
async def payables_aging(current_user: User = Depends(get_current_user)):
    today = date.today()
    try:
        rows = run_q("""
            SELECT pi.invoice_number, s.name, pi.invoice_date, pi.due_date,
                   pi.total_amount, pi.amount_paid,
                   (pi.total_amount - pi.amount_paid) as balance
            FROM purchase_invoices pi
            JOIN suppliers s ON pi.supplier_id = s.id
            WHERE pi.status != 'paid'
            ORDER BY pi.due_date ASC
        """)
    except Exception:
        rows = []
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    items = []
    for r in rows:
        bal = float(r['balance'] or 0)
        try:
            days = (today - date.fromisoformat(str(r['due_date'])[:10])).days
        except Exception:
            days = 0
        if days <= 0:
            buckets["current"] += bal
        elif days <= 30:
            buckets["1_30"] += bal
        elif days <= 60:
            buckets["31_60"] += bal
        elif days <= 90:
            buckets["61_90"] += bal
        else:
            buckets["over_90"] += bal
        items.append({
            "invoice": r['invoice_number'], "supplier": r['name'],
            "due_date": str(r['due_date']),
            "total": round(float(r['total_amount'] or 0), 3),
            "paid": round(float(r['amount_paid'] or 0), 3),
            "balance": round(bal, 3), "days_overdue": max(days, 0),
        })
    return {"buckets": {k: round(v, 3) for k, v in buckets.items()},
            "total": round(sum(buckets.values()), 3), "items": items}


@router.get("/expiry-report")
async def expiry_report(days: int = 90, current_user: User = Depends(get_current_user)):
    cutoff = (date.today() + timedelta(days=days)).isoformat()
    today_str = date.today().isoformat()
    try:
        rows = run_q("""
            SELECT p.sku, p.name, bi.batch_number, bi.expiry_date,
                   bi.quantity_remaining as quantity,
                   COALESCE(p.standard_cost, 0) as unit_cost,
                   w.name as warehouse
            FROM batch_inventory bi
            JOIN products p ON bi.product_id = p.id
            LEFT JOIN warehouses w ON bi.warehouse_id = w.id
            WHERE bi.expiry_date IS NOT NULL AND bi.expiry_date <= :cutoff
              AND bi.quantity_remaining > 0 AND bi.status = 'active'
            ORDER BY bi.expiry_date ASC
        """, {"cutoff": cutoff})
    except Exception:
        rows = []
    expired = [r for r in rows if str(r['expiry_date'])[:10] <= today_str]
    expiring = [r for r in rows if str(r['expiry_date'])[:10] > today_str]

    def fmt(r):
        return {
            "sku": r['sku'], "name": r['name'],
            "batch": r['batch_number'], "expiry": str(r['expiry_date']),
            "qty": r['quantity'],
            "value": round(float(r['quantity'] or 0) * float(r['unit_cost'] or 0), 3),
            "warehouse": r.get('warehouse'),
        }

    return {
        "expired_count": len(expired), "expiring_count": len(expiring),
        "threshold_days": days,
        "expired_value": round(
            sum(float(r['quantity'] or 0) * float(r['unit_cost'] or 0) for r in expired), 3
        ),
        "expired": [fmt(r) for r in expired],
        "expiring_soon": [fmt(r) for r in expiring],
    }


@router.get("/sales-payments")
async def sales_payments(from_date: Optional[str] = None, to_date: Optional[str] = None,
                         current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT p.payment_date as date, c.name as customer,
                   si.invoice_number as invoice, p.payment_method as method,
                   p.bank_reference as reference, p.amount
            FROM payments p
            JOIN sales_invoices si ON p.reference_id = si.id AND p.reference_type = 'sales_invoice'
            JOIN customers c ON si.customer_id = c.id
            WHERE p.payment_date BETWEEN :start AND :end
            ORDER BY p.payment_date DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []
    total = sum(float(r['amount'] or 0) for r in rows)
    data = [{
        "date": str(r['date']), "customer": r['customer'], "invoice": r['invoice'],
        "method": r['method'], "reference": r['reference'] or '',
        "amount": round(float(r['amount'] or 0), 3),
    } for r in rows]
    return {"data": data, "total": round(total, 3), "count": len(data),
            "period": {"from": start, "to": end}}


@router.get("/purchase-payments")
async def purchase_payments(from_date: Optional[str] = None, to_date: Optional[str] = None,
                            current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT p.payment_date as date, s.name as supplier,
                   pi.invoice_number as invoice, p.payment_method as method,
                   p.bank_reference as reference, p.amount
            FROM payments p
            JOIN purchase_invoices pi ON p.reference_id = pi.id AND p.reference_type = 'purchase_invoice'
            JOIN suppliers s ON pi.supplier_id = s.id
            WHERE p.payment_date BETWEEN :start AND :end
            ORDER BY p.payment_date DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []
    total = sum(float(r['amount'] or 0) for r in rows)
    data = [{
        "date": str(r['date']), "supplier": r['supplier'], "invoice": r['invoice'],
        "method": r['method'], "reference": r['reference'] or '',
        "amount": round(float(r['amount'] or 0), 3),
    } for r in rows]
    return {"data": data, "total": round(total, 3), "count": len(data),
            "period": {"from": start, "to": end}}


@router.get("/customer-orders")
async def customer_orders_report(from_date: Optional[str] = None, to_date: Optional[str] = None,
                                 current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT c.code, c.name, c.area,
                   COUNT(so.id) as orders,
                   COALESCE(SUM(so.total_amount), 0) as total,
                   MAX(so.order_date) as last_order
            FROM customers c
            LEFT JOIN sales_orders so ON so.customer_id = c.id
                AND so.order_date BETWEEN :start AND :end
            GROUP BY c.id, c.code, c.name, c.area
            HAVING COUNT(so.id) > 0
            ORDER BY total DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []
    data = [{
        "code": r['code'], "name": r['name'], "area": r['area'] or '',
        "orders": r['orders'], "total": round(float(r['total'] or 0), 3),
        "last_order": str(r['last_order'])[:10] if r['last_order'] else '-',
    } for r in rows]
    return {"data": data, "count": len(data), "period": {"from": start, "to": end}}


@router.get("/sales-by-item")
async def sales_by_item(from_date: Optional[str] = None, to_date: Optional[str] = None,
                        category_id: Optional[int] = None, customer_id: Optional[int] = None,
                        current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    where = ["so.order_date BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end}
    if category_id:
        where.append("p.category_id = :category_id")
        params["category_id"] = category_id
    if customer_id:
        where.append("so.customer_id = :customer_id")
        params["customer_id"] = customer_id
    wc = " AND ".join(where)
    rows = run_q(f"""
        SELECT p.sku, p.name as product, c.name as customer,
               soi.quantity_ordered as qty, soi.unit_price, soi.unit_cost,
               soi.total_price as total,
               so.order_number, so.order_date
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.sales_order_id = so.id
        JOIN products p ON soi.product_id = p.id
        LEFT JOIN customers c ON so.customer_id = c.id
        WHERE {wc}
        ORDER BY so.order_date DESC, so.id DESC
    """, params)
    grand_total = sum(float(r['total'] or 0) for r in rows)
    grand_profit = sum(float(r['total'] or 0) - float(r['qty'] or 0) * float(r['unit_cost'] or 0) for r in rows)
    data = [{
        "sku": r['sku'], "product": r['product'], "customer": r['customer'],
        "order": r['order_number'], "date": str(r['order_date'])[:10],
        "qty": r['qty'], "unit_price": round(float(r['unit_price'] or 0), 3),
        "total": round(float(r['total'] or 0), 3),
        "profit": round(float(r['total'] or 0) - float(r['qty'] or 0) * float(r['unit_cost'] or 0), 3),
    } for r in rows]
    return {"data": data, "count": len(data), "grand_total": round(grand_total, 3),
            "grand_profit": round(grand_profit, 3), "period": {"from": start, "to": end}}


@router.get("/return-items")
async def return_items(from_date: Optional[str] = None, to_date: Optional[str] = None,
                       product_id: Optional[int] = None,
                       current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    where = ["r.return_date BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end}
    if product_id:
        where.append("ri.product_id = :product_id")
        params["product_id"] = product_id
    wc = " AND ".join(where)
    try:
        rows = run_q(f"""
            SELECT r.return_number, r.return_date, r.return_type, r.status,
                   c.name as customer,
                   p.name as product, p.sku,
                   ri.quantity, ri.unit_price, ri.reason, ri.condition,
                   (ri.quantity * ri.unit_price) as amount
            FROM return_items ri
            JOIN returns r ON ri.return_id = r.id
            JOIN products p ON ri.product_id = p.id
            LEFT JOIN customers c ON r.customer_id = c.id
            WHERE {wc}
            ORDER BY r.return_date DESC
        """, params)
    except Exception:
        rows = []
    total_value = sum(float(r['amount'] or 0) for r in rows)
    total_qty = sum(float(r['quantity'] or 0) for r in rows)
    data = [{
        "return_number": r['return_number'], "date": str(r['return_date'])[:10],
        "type": r['return_type'], "status": r['status'],
        "customer": r['customer'], "product": r['product'], "sku": r['sku'],
        "qty": r['quantity'], "unit_price": round(float(r['unit_price'] or 0), 3),
        "amount": round(float(r['amount'] or 0), 3),
        "reason": r['reason'] or '', "condition": r['condition'] or '',
    } for r in rows]
    return {"data": data, "count": len(data), "total_value": round(total_value, 3),
            "total_qty": round(total_qty, 3), "period": {"from": start, "to": end}}


# ── VAT Return Report ──

@router.get("/vat-return")
async def vat_return(start_date: str, end_date: str,
                     current_user: User = Depends(get_current_user)):
    """
    Calculate VAT return figures for the given period.
    Oman VAT return boxes:
      Box 1: Standard-rated sales (5% VAT)
      Box 2: Zero-rated sales (0% VAT)
      Box 3: Output VAT (5% of Box 1)
      Box 4: Standard-rated purchases (input VAT claimable)
      Box 5: Input VAT (5% of Box 4)
      Box 6: Net VAT payable (Box 3 - Box 5)
    """
    # Standard-rated sales (invoices with tax > 0)
    standard_sales = run_q("""
        SELECT COALESCE(SUM(si.subtotal), 0) as total
        FROM sales_invoices si
        WHERE si.invoice_date BETWEEN :s AND :e
          AND si.tax_amount > 0
    """, {"s": start_date, "e": end_date})
    box1 = float(standard_sales[0]["total"]) if standard_sales else 0

    # Zero-rated sales (invoices with tax = 0)
    zero_sales = run_q("""
        SELECT COALESCE(SUM(si.subtotal), 0) as total
        FROM sales_invoices si
        WHERE si.invoice_date BETWEEN :s AND :e
          AND (si.tax_amount = 0 OR si.tax_amount IS NULL)
    """, {"s": start_date, "e": end_date})
    box2 = float(zero_sales[0]["total"]) if zero_sales else 0

    # Output VAT collected
    output_vat = run_q("""
        SELECT COALESCE(SUM(si.tax_amount), 0) as total
        FROM sales_invoices si
        WHERE si.invoice_date BETWEEN :s AND :e
    """, {"s": start_date, "e": end_date})
    box3 = float(output_vat[0]["total"]) if output_vat else 0

    # Standard-rated purchases
    standard_purchases = run_q("""
        SELECT COALESCE(SUM(pi.subtotal), 0) as total
        FROM purchase_invoices pi
        WHERE pi.invoice_date BETWEEN :s AND :e
          AND pi.tax_amount > 0
    """, {"s": start_date, "e": end_date})
    box4 = float(standard_purchases[0]["total"]) if standard_purchases else 0

    # Input VAT on purchases
    input_vat = run_q("""
        SELECT COALESCE(SUM(pi.tax_amount), 0) as total
        FROM purchase_invoices pi
        WHERE pi.invoice_date BETWEEN :s AND :e
    """, {"s": start_date, "e": end_date})
    box5 = float(input_vat[0]["total"]) if input_vat else 0

    box6 = box3 - box5

    return {
        "period_start": start_date,
        "period_end": end_date,
        "box1_standard_sales": round(box1, 3),
        "box2_zero_rated_sales": round(box2, 3),
        "box3_output_vat": round(box3, 3),
        "box4_standard_purchases": round(box4, 3),
        "box5_input_vat": round(box5, 3),
        "box6_net_vat_payable": round(box6, 3),
        "total_sales": round(box1 + box2, 3),
        "total_purchases": round(box4, 3),
    }
