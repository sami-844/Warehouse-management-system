"""
Stock Alerts & Auto-Reorder Router — Phase 42
Monitors stock levels and creates draft POs for low-stock products.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from app.core.database import get_db
from app.api.auth import get_current_user
from datetime import datetime

router = APIRouter(tags=["Stock Alerts"])


@router.get('/stock')
async def get_stock_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Return all products at or below reorder level.
    Categorised into: out_of_stock, critical, low.
    """
    rows = db.execute(sql_text("""
        SELECT p.id, p.sku, p.name, p.stock_quantity,
               p.reorder_level, p.minimum_stock,
               p.auto_reorder, p.preferred_supplier_id,
               p.reorder_quantity, p.standard_cost,
               s.name as supplier_name
        FROM products p
        LEFT JOIN suppliers s ON s.id = p.preferred_supplier_id
        WHERE p.is_active = 1
          AND COALESCE(p.is_deleted, 0) = 0
          AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.reorder_level, 0)
          AND COALESCE(p.reorder_level, 0) > 0
        ORDER BY p.stock_quantity ASC
    """)).fetchall()

    out_of_stock = []
    critical = []
    low = []

    for r in rows:
        p = dict(r._mapping)
        qty = float(p.get('stock_quantity') or 0)
        min_stock = float(p.get('minimum_stock') or 0)
        reorder = float(p.get('reorder_level') or 0)

        item = {
            'id': p['id'],
            'sku': p.get('sku') or '',
            'name': p.get('name') or '',
            'current_stock': round(qty, 3),
            'reorder_level': round(reorder, 3),
            'minimum_stock': round(min_stock, 3),
            'auto_reorder': bool(p.get('auto_reorder', 1)),
            'preferred_supplier_id': p.get('preferred_supplier_id'),
            'supplier_name': p.get('supplier_name') or 'No supplier set',
            'reorder_quantity': float(p.get('reorder_quantity') or 0),
            'suggested_order': round(max((reorder * 2) - qty, float(p.get('reorder_quantity') or 0) or reorder * 2), 3),
            'unit_cost': round(float(p.get('standard_cost') or 0), 3),
        }

        if qty <= 0:
            item['alert_type'] = 'out_of_stock'
            out_of_stock.append(item)
        elif min_stock > 0 and qty <= min_stock:
            item['alert_type'] = 'critical'
            critical.append(item)
        else:
            item['alert_type'] = 'low'
            low.append(item)

    return {
        'total_alerts': len(rows),
        'out_of_stock': out_of_stock,
        'critical': critical,
        'low': low,
        'summary': {
            'out_of_stock_count': len(out_of_stock),
            'critical_count': len(critical),
            'low_count': len(low),
        }
    }


@router.post('/auto-reorder')
async def create_auto_reorder_po(
    data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Create Draft Purchase Orders for selected products.
    Groups by supplier — one PO per supplier.
    data = { product_ids: [1, 2, 3], quantities: {"1": 50, "2": 100} }
    """
    product_ids = data.get('product_ids', [])
    custom_quantities = data.get('quantities', {})

    if not product_ids:
        raise HTTPException(400, 'No products specified')

    # Group products by supplier
    supplier_groups = {}
    for pid in product_ids:
        row = db.execute(sql_text(
            "SELECT * FROM products WHERE id = :pid"
        ), {"pid": pid}).fetchone()
        if not row:
            continue
        product = dict(row._mapping)

        supplier_id = product.get('preferred_supplier_id')
        if not supplier_id:
            continue

        if supplier_id not in supplier_groups:
            supplier_groups[supplier_id] = []
        supplier_groups[supplier_id].append(product)

    created_pos = []

    for supplier_id, products in supplier_groups.items():
        supplier_row = db.execute(sql_text(
            "SELECT * FROM suppliers WHERE id = :sid"
        ), {"sid": supplier_id}).fetchone()
        if not supplier_row:
            continue
        supplier = dict(supplier_row._mapping)

        # Generate PO number
        count_row = db.execute(sql_text("SELECT COUNT(*) as c FROM purchase_orders")).fetchone()
        count = count_row.c if count_row else 0
        po_number = f"PO-AUTO-{str(count + 1).zfill(4)}"

        total = 0
        items_data = []
        for product in products:
            qty = float(custom_quantities.get(str(product['id'])) or
                        product.get('reorder_quantity') or
                        (float(product.get('reorder_level', 0)) * 2))
            cost = float(product.get('standard_cost') or 0)
            line_total = round(qty * cost, 3)
            total += line_total
            items_data.append({
                'product_id': product['id'],
                'quantity': qty,
                'unit_price': cost,
                'line_total': line_total,
            })

        # Create the PO
        result = db.execute(sql_text("""
            INSERT INTO purchase_orders
               (po_number, supplier_id, status, total_amount, currency, notes, created_by)
            VALUES (:po, :sid, 'draft', :total, 'OMR', 'Auto-generated from stock alert', :uid)
        """), {"po": po_number, "sid": supplier_id, "total": round(total, 3), "uid": current_user.id})

        # Get the new PO id
        po_id_row = db.execute(sql_text("SELECT id FROM purchase_orders WHERE po_number = :po"), {"po": po_number}).fetchone()
        po_id = po_id_row.id if po_id_row else None

        if po_id:
            for item in items_data:
                db.execute(sql_text("""
                    INSERT INTO purchase_order_items
                       (purchase_order_id, product_id, quantity, unit_price, total_price)
                    VALUES (:po_id, :pid, :qty, :price, :total)
                """), {"po_id": po_id, "pid": item['product_id'], "qty": item['quantity'],
                       "price": item['unit_price'], "total": item['line_total']})

        created_pos.append({
            'po_id': po_id,
            'po_number': po_number,
            'supplier': supplier.get('name'),
            'items': len(items_data),
            'total': round(total, 3),
        })

    db.commit()

    return {
        'created': len(created_pos),
        'purchase_orders': created_pos,
        'message': f'{len(created_pos)} draft purchase order(s) created'
    }


@router.post('/acknowledge/{product_id}')
async def acknowledge_alert(
    product_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Mark a stock alert as acknowledged."""
    db.execute(sql_text("""
        INSERT INTO stock_alerts
           (product_id, status, acknowledged_by, acknowledged_at)
        VALUES (:pid, 'acknowledged', :uid, :ts)
    """), {"pid": product_id, "uid": current_user.id, "ts": datetime.utcnow().isoformat()})
    db.commit()
    return {'message': 'Alert acknowledged'}
