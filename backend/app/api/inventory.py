"""
Inventory Management API — PHASE 1 COMPLETE
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import date, datetime, timedelta
from pydantic import BaseModel
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.inventory import InventoryTransaction, StockLevel, TransactionType, Warehouse
from app.models.product import Product, ProductCategory

router = APIRouter()

# ===== Schemas =====
class ReceiptItem(BaseModel):
    product_id: int
    quantity: float
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    unit_cost: Optional[float] = None
    notes: Optional[str] = None

class BatchReceiptRequest(BaseModel):
    warehouse_id: int
    reference_number: Optional[str] = None
    container_reference: Optional[str] = None
    notes: Optional[str] = None
    items: List[ReceiptItem]

class StockTakeItem(BaseModel):
    product_id: int
    counted_quantity: float
    notes: Optional[str] = None

class StockTakeRequest(BaseModel):
    warehouse_id: int
    reference_number: Optional[str] = None
    items: List[StockTakeItem]

# ===== Receipt =====
@router.post("/receipt")
async def record_receipt(
    product_id: int, warehouse_id: int, quantity: float,
    batch_number: Optional[str] = None, expiry_date: Optional[date] = None,
    unit_cost: Optional[float] = None, reference_number: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    transaction = InventoryTransaction(
        product_id=product_id, warehouse_id=warehouse_id,
        transaction_type=TransactionType.RECEIPT, quantity=quantity,
        batch_number=batch_number, expiry_date=expiry_date,
        unit_cost=unit_cost, total_cost=quantity * unit_cost if unit_cost else None,
        reference_number=reference_number, notes=notes, created_by=current_user.id
    )
    db.add(transaction)
    stock = db.query(StockLevel).filter(StockLevel.product_id == product_id, StockLevel.warehouse_id == warehouse_id).first()
    if stock:
        stock.quantity_on_hand += quantity
    else:
        stock = StockLevel(product_id=product_id, warehouse_id=warehouse_id, quantity_on_hand=quantity)
        db.add(stock)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to record receipt")
    return {"transaction_id": transaction.id, "product_name": product.name, "quantity": quantity, "new_stock_level": float(stock.quantity_on_hand)}

# ===== Issue =====
@router.post("/issue")
async def record_issue(
    product_id: int, warehouse_id: int, quantity: float,
    reference_number: Optional[str] = None, customer_name: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    stock = db.query(StockLevel).filter(StockLevel.product_id == product_id, StockLevel.warehouse_id == warehouse_id).first()
    available = float(stock.quantity_on_hand) if stock else 0
    if available < quantity:
        raise HTTPException(status_code=400, detail=f"Insufficient stock. Available: {available}")
    full_notes = f"Customer: {customer_name}. {notes or ''}".strip() if customer_name else notes
    transaction = InventoryTransaction(
        product_id=product_id, warehouse_id=warehouse_id,
        transaction_type=TransactionType.ISSUE, quantity=quantity,
        reference_number=reference_number, notes=full_notes, created_by=current_user.id
    )
    db.add(transaction)
    stock.quantity_on_hand -= quantity
    db.commit()
    product = db.query(Product).filter(Product.id == product_id).first()
    return {"transaction_id": transaction.id, "product_name": product.name if product else "", "quantity_issued": quantity, "remaining_stock": float(stock.quantity_on_hand)}

# ===== Transfer =====
@router.post("/transfer")
async def record_transfer(
    product_id: int, from_warehouse_id: int, to_warehouse_id: int, quantity: float,
    reference_number: Optional[str] = None, notes: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    from_stock = db.query(StockLevel).filter(StockLevel.product_id == product_id, StockLevel.warehouse_id == from_warehouse_id).first()
    if not from_stock or float(from_stock.quantity_on_hand) < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock at source")
    db.add(InventoryTransaction(product_id=product_id, warehouse_id=from_warehouse_id, transaction_type=TransactionType.TRANSFER_OUT, quantity=quantity, reference_number=reference_number, notes=notes, created_by=current_user.id))
    from_stock.quantity_on_hand -= quantity
    db.add(InventoryTransaction(product_id=product_id, warehouse_id=to_warehouse_id, transaction_type=TransactionType.TRANSFER_IN, quantity=quantity, reference_number=reference_number, notes=notes, created_by=current_user.id))
    to_stock = db.query(StockLevel).filter(StockLevel.product_id == product_id, StockLevel.warehouse_id == to_warehouse_id).first()
    if to_stock:
        to_stock.quantity_on_hand += quantity
    else:
        to_stock = StockLevel(product_id=product_id, warehouse_id=to_warehouse_id, quantity_on_hand=quantity)
        db.add(to_stock)
    db.commit()
    return {"quantity_transferred": quantity, "from_stock": float(from_stock.quantity_on_hand), "to_stock": float(to_stock.quantity_on_hand)}

# ===== Adjustment =====
@router.post("/adjustment")
async def record_adjustment(
    product_id: int, warehouse_id: int, quantity: float, reason: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    db.add(InventoryTransaction(product_id=product_id, warehouse_id=warehouse_id, transaction_type=TransactionType.ADJUSTMENT, quantity=quantity, notes=reason, created_by=current_user.id))
    stock = db.query(StockLevel).filter(StockLevel.product_id == product_id, StockLevel.warehouse_id == warehouse_id).first()
    old = float(stock.quantity_on_hand) if stock else 0
    if stock:
        stock.quantity_on_hand = quantity
    else:
        stock = StockLevel(product_id=product_id, warehouse_id=warehouse_id, quantity_on_hand=quantity)
        db.add(stock)
    db.commit()
    return {"old_quantity": old, "new_quantity": quantity, "difference": quantity - old}

# ===== Stock Levels =====
@router.get("/stock-levels")
async def get_stock_levels(
    product_id: Optional[int] = None, warehouse_id: Optional[int] = None, low_stock_only: bool = False,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    query = db.query(StockLevel, Product.name.label('pname'), Product.sku, Product.unit_of_measure, Product.reorder_level, Product.selling_price, Product.standard_cost, Warehouse.name.label('wname')
    ).join(Product, StockLevel.product_id == Product.id).join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
    if product_id: query = query.filter(StockLevel.product_id == product_id)
    if warehouse_id: query = query.filter(StockLevel.warehouse_id == warehouse_id)
    if low_stock_only: query = query.filter(StockLevel.quantity_on_hand <= Product.reorder_level)
    return [{
        "product_id": sl.product_id, "product_name": pn, "sku": sku, "warehouse_id": sl.warehouse_id,
        "warehouse_name": wn, "quantity_on_hand": float(sl.quantity_on_hand), "reorder_level": rl or 0,
        "unit_of_measure": uom, "selling_price": float(sp) if sp else 0, "standard_cost": float(sc) if sc else 0,
        "stock_value": round(float(sl.quantity_on_hand) * (float(sc) if sc else 0), 3),
        "needs_reorder": float(sl.quantity_on_hand) <= (rl or 0)
    } for sl, pn, sku, uom, rl, sp, sc, wn in query.all()]

# ===== Movements =====
@router.get("/movements")
async def get_movements(
    product_id: Optional[int] = None, warehouse_id: Optional[int] = None,
    transaction_type: Optional[str] = None, limit: int = 50,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    query = db.query(InventoryTransaction, Product.name.label('pname'), Product.sku, Warehouse.name.label('wname')
    ).join(Product, InventoryTransaction.product_id == Product.id).join(Warehouse, InventoryTransaction.warehouse_id == Warehouse.id)
    if product_id: query = query.filter(InventoryTransaction.product_id == product_id)
    if warehouse_id: query = query.filter(InventoryTransaction.warehouse_id == warehouse_id)
    if transaction_type: query = query.filter(InventoryTransaction.transaction_type == transaction_type)
    return [{
        "id": t.id, "product_id": t.product_id, "product_name": pn, "sku": sku,
        "warehouse_name": wn, "transaction_type": t.transaction_type.value if hasattr(t.transaction_type, 'value') else str(t.transaction_type),
        "quantity": float(t.quantity), "batch_number": t.batch_number,
        "expiry_date": str(t.expiry_date) if t.expiry_date else None,
        "unit_cost": float(t.unit_cost) if t.unit_cost else None,
        "reference_number": t.reference_number, "notes": t.notes, "date": str(t.transaction_date)
    } for t, pn, sku, wn in query.order_by(InventoryTransaction.transaction_date.desc()).limit(limit).all()]

# ===== Low Stock =====
@router.get("/low-stock")
async def get_low_stock(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    results = db.query(StockLevel, Product.name, Product.sku, Product.reorder_level, Warehouse.name.label('wn')
    ).join(Product, StockLevel.product_id == Product.id).join(Warehouse, StockLevel.warehouse_id == Warehouse.id
    ).filter(StockLevel.quantity_on_hand <= Product.reorder_level).all()
    items = [{"product_id": sl.product_id, "product_name": pn, "sku": sku, "warehouse_name": wn,
              "quantity_on_hand": float(sl.quantity_on_hand), "reorder_level": rl or 0,
              "shortage": (rl or 0) - float(sl.quantity_on_hand),
              "urgency": "CRITICAL" if float(sl.quantity_on_hand) == 0 else "WARNING"
    } for sl, pn, sku, rl, wn in results]
    return {"total_items": len(items), "items": items}

# ===== Summary =====
@router.get("/summary")
async def get_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total_products = db.query(StockLevel).filter(StockLevel.quantity_on_hand > 0).count()
    val = db.query(func.sum(StockLevel.quantity_on_hand * Product.standard_cost)).join(Product, StockLevel.product_id == Product.id).filter(StockLevel.quantity_on_hand > 0).scalar()
    low = db.query(StockLevel).join(Product, StockLevel.product_id == Product.id).filter(StockLevel.quantity_on_hand <= Product.reorder_level, StockLevel.quantity_on_hand > 0).count()
    oos = db.query(StockLevel).filter(StockLevel.quantity_on_hand == 0).count()
    by_wh = db.query(Warehouse.name, func.count(StockLevel.id), func.sum(StockLevel.quantity_on_hand)).join(Warehouse, StockLevel.warehouse_id == Warehouse.id).group_by(Warehouse.id).all()
    return {"total_products_in_stock": total_products, "total_stock_value": round(float(val) if val else 0, 3),
            "low_stock_items": low, "out_of_stock_items": oos,
            "stock_by_warehouse": [{"warehouse": w, "product_count": c, "total_units": float(u or 0)} for w, c, u in by_wh]}

# ===== NEW: Batch Receipt =====
@router.post("/batch-receipt")
async def batch_receipt(request: BatchReceiptRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    warehouse = db.query(Warehouse).filter(Warehouse.id == request.warehouse_id).first()
    if not warehouse: raise HTTPException(status_code=404, detail="Warehouse not found")
    results, total_qty = [], 0
    for item in request.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            results.append({"product_id": item.product_id, "status": "error", "message": "Not found"})
            continue
        db.add(InventoryTransaction(product_id=item.product_id, warehouse_id=request.warehouse_id, transaction_type=TransactionType.RECEIPT, quantity=item.quantity, batch_number=item.batch_number, expiry_date=item.expiry_date, unit_cost=item.unit_cost, total_cost=item.quantity * item.unit_cost if item.unit_cost else None, reference_number=request.reference_number, notes=f"Container: {request.container_reference}" if request.container_reference else item.notes, created_by=current_user.id))
        stock = db.query(StockLevel).filter(StockLevel.product_id == item.product_id, StockLevel.warehouse_id == request.warehouse_id).first()
        if stock: stock.quantity_on_hand += item.quantity
        else:
            stock = StockLevel(product_id=item.product_id, warehouse_id=request.warehouse_id, quantity_on_hand=item.quantity)
            db.add(stock)
        total_qty += item.quantity
        results.append({"product_id": item.product_id, "product_name": product.name, "quantity": item.quantity, "new_stock": float(stock.quantity_on_hand), "status": "success"})
    db.commit()
    return {"total_items_received": len([r for r in results if r.get("status") == "success"]), "total_quantity": total_qty, "container_reference": request.container_reference, "items": results}

# ===== NEW: Expiry Alerts =====
@router.get("/expiry-alerts")
async def get_expiry_alerts(days: int = Query(90), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cutoff = date.today() + timedelta(days=days)
    results = db.query(InventoryTransaction.product_id, InventoryTransaction.batch_number, InventoryTransaction.expiry_date, InventoryTransaction.quantity, Product.name.label('pn'), Product.sku, Warehouse.name.label('wn')
    ).join(Product, InventoryTransaction.product_id == Product.id).join(Warehouse, InventoryTransaction.warehouse_id == Warehouse.id
    ).filter(InventoryTransaction.expiry_date.isnot(None), InventoryTransaction.expiry_date <= cutoff, InventoryTransaction.transaction_type == TransactionType.RECEIPT
    ).order_by(InventoryTransaction.expiry_date.asc()).all()
    items = []
    for pid, batch, exp, qty, pn, sku, wn in results:
        d = (exp - date.today()).days
        urgency = "EXPIRED" if d < 0 else "CRITICAL" if d <= 30 else "WARNING" if d <= 60 else "INFO"
        items.append({"product_id": pid, "product_name": pn, "sku": sku, "batch_number": batch, "expiry_date": str(exp), "days_until_expiry": d, "quantity": float(qty), "warehouse_name": wn, "urgency": urgency})
    return {"summary": {"expired": len([i for i in items if i["urgency"]=="EXPIRED"]), "critical": len([i for i in items if i["urgency"]=="CRITICAL"]), "warning": len([i for i in items if i["urgency"]=="WARNING"]), "info": len([i for i in items if i["urgency"]=="INFO"])}, "items": items}

# ===== NEW: Valuation =====
@router.get("/valuation")
async def get_valuation(warehouse_id: Optional[int] = None, category_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Product.id, Product.name, Product.sku, Product.standard_cost, Product.selling_price, ProductCategory.name.label('cat'), StockLevel.quantity_on_hand, Warehouse.name.label('wn')
    ).join(StockLevel, StockLevel.product_id == Product.id).join(Warehouse, StockLevel.warehouse_id == Warehouse.id).outerjoin(ProductCategory, Product.category_id == ProductCategory.id).filter(StockLevel.quantity_on_hand > 0)
    if warehouse_id: query = query.filter(StockLevel.warehouse_id == warehouse_id)
    if category_id: query = query.filter(Product.category_id == category_id)
    items, tc, tr = [], 0, 0
    for pid, name, sku, cost, price, cat, qty, wn in query.all():
        cv = float(qty) * (float(cost) if cost else 0)
        rv = float(qty) * (float(price) if price else 0)
        tc += cv; tr += rv
        items.append({"product_id": pid, "product_name": name, "sku": sku, "category": cat or "Uncategorized", "warehouse_name": wn, "quantity": float(qty), "unit_cost": float(cost) if cost else 0, "unit_price": float(price) if price else 0, "cost_value": round(cv, 3), "retail_value": round(rv, 3)})
    return {"total_cost_value": round(tc, 3), "total_retail_value": round(tr, 3), "total_potential_profit": round(tr-tc, 3), "items": items}

# ===== NEW: Stock Take =====
@router.post("/stock-take")
async def record_stock_take(request: StockTakeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    warehouse = db.query(Warehouse).filter(Warehouse.id == request.warehouse_id).first()
    if not warehouse: raise HTTPException(status_code=404, detail="Warehouse not found")
    results, adj = [], 0
    for item in request.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product: continue
        stock = db.query(StockLevel).filter(StockLevel.product_id == item.product_id, StockLevel.warehouse_id == request.warehouse_id).first()
        sys_qty = float(stock.quantity_on_hand) if stock else 0
        diff = item.counted_quantity - sys_qty
        if abs(diff) > 0.001:
            db.add(InventoryTransaction(product_id=item.product_id, warehouse_id=request.warehouse_id, transaction_type=TransactionType.ADJUSTMENT, quantity=item.counted_quantity, reference_number=request.reference_number or f"TAKE-{datetime.now().strftime('%Y%m%d')}", notes=f"Stock take: System={sys_qty}, Counted={item.counted_quantity}, Diff={diff:+.1f}", created_by=current_user.id))
            if stock: stock.quantity_on_hand = item.counted_quantity
            else: db.add(StockLevel(product_id=item.product_id, warehouse_id=request.warehouse_id, quantity_on_hand=item.counted_quantity))
            adj += 1
        results.append({"product_id": item.product_id, "product_name": product.name, "system_quantity": sys_qty, "counted_quantity": item.counted_quantity, "difference": round(diff, 3), "adjusted": abs(diff) > 0.001})
    db.commit()
    return {"warehouse": warehouse.name, "total_counted": len(request.items), "adjustments_made": adj, "items": results}

# ===== NEW: Product History =====
@router.get("/product/{product_id}/history")
async def get_product_history(product_id: int, limit: int = Query(100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product: raise HTTPException(status_code=404, detail="Product not found")
    txns = db.query(InventoryTransaction, Warehouse.name.label('wn')).join(Warehouse, InventoryTransaction.warehouse_id == Warehouse.id).filter(InventoryTransaction.product_id == product_id).order_by(InventoryTransaction.transaction_date.desc()).limit(limit).all()
    stocks = db.query(StockLevel, Warehouse.name.label('wn')).join(Warehouse, StockLevel.warehouse_id == Warehouse.id).filter(StockLevel.product_id == product_id).all()
    return {
        "product": {"id": product.id, "name": product.name, "sku": product.sku, "barcode": product.barcode, "reorder_level": product.reorder_level},
        "current_stock": [{"warehouse": wn, "quantity": float(sl.quantity_on_hand)} for sl, wn in stocks],
        "total_stock": sum(float(sl.quantity_on_hand) for sl, _ in stocks),
        "transactions": [{"id": t.id, "type": t.transaction_type.value if hasattr(t.transaction_type, 'value') else str(t.transaction_type), "quantity": float(t.quantity), "warehouse": wn, "batch_number": t.batch_number, "expiry_date": str(t.expiry_date) if t.expiry_date else None, "reference": t.reference_number, "notes": t.notes, "date": str(t.transaction_date)} for t, wn in txns]
    }

# ===== NEW: Products for Stocktake =====
@router.get("/products-for-stocktake")
async def get_products_for_stocktake(warehouse_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    products = db.query(Product).filter(Product.is_active == True).all()
    return [{"product_id": p.id, "product_name": p.name, "sku": p.sku, "barcode": p.barcode, "unit_of_measure": p.unit_of_measure,
             "system_quantity": float((db.query(StockLevel).filter(StockLevel.product_id == p.id, StockLevel.warehouse_id == warehouse_id).first() or StockLevel(quantity_on_hand=0)).quantity_on_hand)
    } for p in products]
