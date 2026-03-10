"""Purchases API — PO workflow, goods receipt, landed cost, invoices, payments"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.business_partner import Supplier
from app.models.inventory import Warehouse, InventoryTransaction, StockLevel, TransactionType
from app.models.purchase import (
    PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem,
    LandedCost, PurchaseInvoice, Payment
)

router = APIRouter()

# ===== Schemas =====
class POItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class POCreate(BaseModel):
    supplier_id: int
    order_date: date
    expected_delivery_date: Optional[date] = None
    container_reference: Optional[str] = None
    currency: str = "OMR"
    exchange_rate: float = 1.0
    tax_rate: float = 0.0
    notes: Optional[str] = None
    items: List[POItemCreate]

class POUpdate(BaseModel):
    expected_delivery_date: Optional[date] = None
    container_reference: Optional[str] = None
    currency: Optional[str] = None
    exchange_rate: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class ReceiptItemCreate(BaseModel):
    purchase_order_item_id: int
    product_id: int
    quantity_received: float
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    quality_status: str = "accepted"
    notes: Optional[str] = None

class ReceiptCreate(BaseModel):
    warehouse_id: int
    received_date: date
    quality_notes: Optional[str] = None
    notes: Optional[str] = None
    items: List[ReceiptItemCreate]

class LandedCostCreate(BaseModel):
    cost_type: str
    description: Optional[str] = None
    amount: float
    allocation_method: str = "by_value"
    notes: Optional[str] = None

class LandedCostRequest(BaseModel):
    costs: List[LandedCostCreate]

class InvoiceCreate(BaseModel):
    invoice_number: str
    purchase_order_id: Optional[int] = None
    supplier_id: int
    invoice_date: date
    due_date: date
    subtotal: float
    tax_amount: float = 0
    total_amount: float
    currency: str = "OMR"
    notes: Optional[str] = None

class PaymentCreate(BaseModel):
    amount: float
    payment_method: str = "bank_transfer"
    payment_date: date
    bank_reference: Optional[str] = None
    notes: Optional[str] = None

# ===== Helper =====
def next_po_number(db):
    last = db.query(PurchaseOrder).order_by(PurchaseOrder.id.desc()).first()
    num = (last.id + 1) if last else 1
    return f"PO-{datetime.now().strftime('%Y')}-{num:04d}"

def next_receipt_number(db):
    last = db.query(PurchaseReceipt).order_by(PurchaseReceipt.id.desc()).first()
    num = (last.id + 1) if last else 1
    return f"GRN-{datetime.now().strftime('%Y')}-{num:04d}"

# ===== PURCHASE ORDERS =====
@router.get("/orders")
async def list_orders(status: Optional[str] = None, supplier_id: Optional[int] = None,
                      db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(PurchaseOrder, Supplier.name.label('supplier_name')
    ).join(Supplier, PurchaseOrder.supplier_id == Supplier.id)
    if status: query = query.filter(PurchaseOrder.status == status)
    if supplier_id: query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    orders = query.order_by(PurchaseOrder.order_date.desc()).all()
    return [{
        "id": o.id, "po_number": o.po_number, "supplier_id": o.supplier_id,
        "supplier_name": sn, "order_date": str(o.order_date),
        "expected_delivery_date": str(o.expected_delivery_date) if o.expected_delivery_date else None,
        "status": o.status, "subtotal": float(o.subtotal or 0), "tax_amount": float(o.tax_amount or 0),
        "total_amount": float(o.total_amount or 0), "container_reference": o.container_reference,
        "currency": o.currency or "OMR",
    } for o, sn in orders]

@router.get("/orders/{po_id}")
async def get_order(po_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po: raise HTTPException(status_code=404, detail="PO not found")
    supplier = db.query(Supplier).filter(Supplier.id == po.supplier_id).first()
    items = db.query(PurchaseOrderItem, Product.name.label('pname'), Product.sku
    ).join(Product, PurchaseOrderItem.product_id == Product.id
    ).filter(PurchaseOrderItem.purchase_order_id == po_id).all()
    receipts = db.query(PurchaseReceipt).filter(PurchaseReceipt.purchase_order_id == po_id).all()
    landed = db.query(LandedCost).filter(LandedCost.purchase_order_id == po_id).all()
    invoices = db.query(PurchaseInvoice).filter(PurchaseInvoice.purchase_order_id == po_id).all()

    return {
        "id": po.id, "po_number": po.po_number,
        "supplier": {"id": supplier.id, "name": supplier.name, "code": supplier.code} if supplier else None,
        "order_date": str(po.order_date),
        "expected_delivery_date": str(po.expected_delivery_date) if po.expected_delivery_date else None,
        "status": po.status, "container_reference": po.container_reference,
        "subtotal": float(po.subtotal or 0), "tax_amount": float(po.tax_amount or 0),
        "shipping_cost": float(po.shipping_cost or 0), "total_amount": float(po.total_amount or 0),
        "freight_cost": float(po.freight_cost or 0), "customs_duty": float(po.customs_duty or 0),
        "handling_cost": float(po.handling_cost or 0), "insurance_cost": float(po.insurance_cost or 0),
        "local_transport_cost": float(po.local_transport_cost or 0),
        "currency": po.currency or "OMR", "exchange_rate": float(po.exchange_rate or 1),
        "notes": po.notes,
        "items": [{
            "id": i.id, "product_id": i.product_id, "product_name": pn, "sku": sku,
            "quantity": i.quantity, "unit_price": float(i.unit_price),
            "total_price": float(i.total_price or 0),
            "received_quantity": i.received_quantity or 0,
            "remaining": i.quantity - (i.received_quantity or 0),
        } for i, pn, sku in items],
        "receipts": [{"id": r.id, "number": r.receipt_number, "date": str(r.received_date)} for r in receipts],
        "landed_costs": [{"id": lc.id, "type": lc.cost_type, "description": lc.description, "amount": float(lc.amount), "method": lc.allocation_method} for lc in landed],
        "invoices": [{"id": inv.id, "number": inv.invoice_number, "total": float(inv.total_amount), "paid": float(inv.amount_paid), "status": inv.status} for inv in invoices],
    }

@router.post("/orders", status_code=201)
async def create_order(data: POCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
    if not supplier: raise HTTPException(status_code=404, detail="Supplier not found")
    subtotal = sum(i.quantity * i.unit_price for i in data.items)
    tax = subtotal * (data.tax_rate / 100)
    po = PurchaseOrder(
        po_number=next_po_number(db), supplier_id=data.supplier_id,
        order_date=data.order_date, expected_delivery_date=data.expected_delivery_date,
        container_reference=data.container_reference, currency=data.currency,
        exchange_rate=data.exchange_rate, subtotal=subtotal, tax_amount=tax,
        total_amount=subtotal + tax, status='draft', notes=data.notes, created_by=current_user.id
    )
    db.add(po)
    db.flush()
    for item in data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product: continue
        db.add(PurchaseOrderItem(
            purchase_order_id=po.id, product_id=item.product_id,
            quantity=item.quantity, unit_price=item.unit_price,
            total_price=item.quantity * item.unit_price, received_quantity=0
        ))
    db.commit()
    db.refresh(po)
    return {"id": po.id, "po_number": po.po_number, "total_amount": float(po.total_amount), "status": po.status}

@router.put("/orders/{po_id}")
async def update_order(po_id: int, data: POUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po: raise HTTPException(status_code=404, detail="PO not found")
    for field, value in data.dict(exclude_unset=True).items():
        setattr(po, field, value)
    db.commit()
    return {"id": po.id, "po_number": po.po_number, "status": po.status, "message": "PO updated"}

@router.post("/orders/{po_id}/send")
async def send_order(po_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po: raise HTTPException(status_code=404, detail="PO not found")
    if po.status not in ('draft',): raise HTTPException(status_code=400, detail=f"Cannot send PO in '{po.status}' status")
    po.status = 'sent'
    db.commit()
    return {"message": "PO sent to supplier", "status": "sent"}

@router.post("/orders/{po_id}/close")
async def close_order(po_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po: raise HTTPException(status_code=404, detail="PO not found")
    po.status = 'closed'
    db.commit()
    return {"message": "PO closed", "status": "closed"}

# ===== GOODS RECEIPT =====
@router.post("/orders/{po_id}/receive")
async def receive_goods(po_id: int, data: ReceiptCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po: raise HTTPException(status_code=404, detail="PO not found")
    if po.status in ('draft', 'closed'): raise HTTPException(status_code=400, detail=f"Cannot receive against '{po.status}' PO")
    warehouse = db.query(Warehouse).filter(Warehouse.id == data.warehouse_id).first()
    if not warehouse: raise HTTPException(status_code=404, detail="Warehouse not found")

    receipt = PurchaseReceipt(
        receipt_number=next_receipt_number(db), purchase_order_id=po_id,
        warehouse_id=data.warehouse_id, received_date=data.received_date,
        quality_notes=data.quality_notes, notes=data.notes, received_by=current_user.id
    )
    db.add(receipt)
    db.flush()

    items_received = []
    for item in data.items:
        po_item = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.id == item.purchase_order_item_id).first()
        if not po_item: continue
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product: continue

        # Record receipt item
        db.add(PurchaseReceiptItem(
            receipt_id=receipt.id, purchase_order_item_id=item.purchase_order_item_id,
            product_id=item.product_id, quantity_received=item.quantity_received,
            batch_number=item.batch_number, expiry_date=item.expiry_date,
            quality_status=item.quality_status, notes=item.notes
        ))

        # Update PO item received quantity
        po_item.received_quantity = (po_item.received_quantity or 0) + int(item.quantity_received)

        # Create inventory transaction
        if item.quality_status == 'accepted':
            db.add(InventoryTransaction(
                product_id=item.product_id, warehouse_id=data.warehouse_id,
                transaction_type=TransactionType.RECEIPT, quantity=item.quantity_received,
                batch_number=item.batch_number, expiry_date=item.expiry_date,
                unit_cost=float(po_item.unit_price), total_cost=float(po_item.unit_price) * item.quantity_received,
                reference_type='purchase_order', reference_id=po_id,
                reference_number=po.po_number, notes=f"GRN: {receipt.receipt_number}",
                created_by=current_user.id
            ))
            # Update stock level
            stock = db.query(StockLevel).filter(StockLevel.product_id == item.product_id, StockLevel.warehouse_id == data.warehouse_id).first()
            if stock: stock.quantity_on_hand += item.quantity_received
            else:
                stock = StockLevel(product_id=item.product_id, warehouse_id=data.warehouse_id, quantity_on_hand=item.quantity_received)
                db.add(stock)

        items_received.append({"product": product.name, "quantity": item.quantity_received, "status": item.quality_status})

    # Update PO status
    all_items = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == po_id).all()
    fully_received = all(i.received_quantity >= i.quantity for i in all_items)
    partially_received = any((i.received_quantity or 0) > 0 for i in all_items)
    po.status = 'fully_received' if fully_received else 'partially_received' if partially_received else po.status
    if fully_received: po.received_date = data.received_date

    db.commit()
    return {
        "receipt_number": receipt.receipt_number, "po_number": po.po_number,
        "status": po.status, "items_received": items_received,
        "fully_received": fully_received
    }

# ===== LANDED COST =====
@router.post("/orders/{po_id}/landed-cost")
async def add_landed_costs(po_id: int, data: LandedCostRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po: raise HTTPException(status_code=404, detail="PO not found")

    total_additional = 0
    for cost in data.costs:
        db.add(LandedCost(
            purchase_order_id=po_id, cost_type=cost.cost_type,
            description=cost.description, amount=cost.amount,
            allocation_method=cost.allocation_method, notes=cost.notes
        ))
        total_additional += cost.amount
        # Update PO cost fields
        if cost.cost_type == 'freight': po.freight_cost = (float(po.freight_cost or 0)) + cost.amount
        elif cost.cost_type == 'customs': po.customs_duty = (float(po.customs_duty or 0)) + cost.amount
        elif cost.cost_type == 'handling': po.handling_cost = (float(po.handling_cost or 0)) + cost.amount
        elif cost.cost_type == 'insurance': po.insurance_cost = (float(po.insurance_cost or 0)) + cost.amount
        elif cost.cost_type == 'transport': po.local_transport_cost = (float(po.local_transport_cost or 0)) + cost.amount

    db.commit()

    # Calculate allocation
    items = db.query(PurchaseOrderItem, Product.name, Product.weight
    ).join(Product, PurchaseOrderItem.product_id == Product.id
    ).filter(PurchaseOrderItem.purchase_order_id == po_id).all()

    subtotal = float(po.subtotal or 0)
    allocation = []
    for item, pname, weight in items:
        item_value = float(item.total_price or 0)
        ratio = item_value / subtotal if subtotal > 0 else 1 / len(items)
        item_landed = item_value + (total_additional * ratio)
        landed_unit_cost = item_landed / item.quantity if item.quantity > 0 else 0
        allocation.append({
            "product": pname, "quantity": item.quantity,
            "product_cost": round(item_value, 3), "additional_cost": round(total_additional * ratio, 3),
            "total_landed": round(item_landed, 3), "landed_unit_cost": round(landed_unit_cost, 3),
        })

    return {
        "po_number": po.po_number, "product_subtotal": round(subtotal, 3),
        "total_additional_costs": round(total_additional, 3),
        "total_landed_cost": round(subtotal + total_additional, 3),
        "allocation": allocation
    }

@router.get("/orders/{po_id}/landed-cost")
async def get_landed_costs(po_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po: raise HTTPException(status_code=404, detail="PO not found")
    costs = db.query(LandedCost).filter(LandedCost.purchase_order_id == po_id).all()
    items = db.query(PurchaseOrderItem, Product.name
    ).join(Product, PurchaseOrderItem.product_id == Product.id
    ).filter(PurchaseOrderItem.purchase_order_id == po_id).all()

    total_additional = sum(float(lc.amount) for lc in costs)
    subtotal = float(po.subtotal or 0)

    allocation = []
    for item, pname in items:
        item_value = float(item.total_price or 0)
        ratio = item_value / subtotal if subtotal > 0 else 1 / max(len(items), 1)
        item_landed = item_value + (total_additional * ratio)
        allocation.append({
            "product": pname, "quantity": item.quantity,
            "product_cost": round(item_value, 3), "additional_cost": round(total_additional * ratio, 3),
            "total_landed": round(item_landed, 3),
            "landed_unit_cost": round(item_landed / item.quantity, 3) if item.quantity else 0,
            "original_unit_cost": round(float(item.unit_price), 3),
        })
    return {
        "costs": [{"id": lc.id, "type": lc.cost_type, "description": lc.description, "amount": float(lc.amount), "method": lc.allocation_method} for lc in costs],
        "total_additional": round(total_additional, 3),
        "product_subtotal": round(subtotal, 3),
        "total_landed": round(subtotal + total_additional, 3),
        "allocation": allocation
    }

# ===== PURCHASE INVOICES =====
@router.get("/invoices")
async def list_invoices(status: Optional[str] = None, supplier_id: Optional[int] = None,
                        db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(PurchaseInvoice, Supplier.name.label('sname')
    ).join(Supplier, PurchaseInvoice.supplier_id == Supplier.id)
    if status: query = query.filter(PurchaseInvoice.status == status)
    if supplier_id: query = query.filter(PurchaseInvoice.supplier_id == supplier_id)
    return [{
        "id": inv.id, "invoice_number": inv.invoice_number, "po_id": inv.purchase_order_id,
        "supplier_id": inv.supplier_id, "supplier_name": sn,
        "invoice_date": str(inv.invoice_date), "due_date": str(inv.due_date),
        "total_amount": float(inv.total_amount), "amount_paid": float(inv.amount_paid),
        "balance": round(float(inv.total_amount) - float(inv.amount_paid), 3),
        "status": inv.status, "currency": inv.currency,
        "days_overdue": (date.today() - inv.due_date).days if inv.status != 'paid' and inv.due_date < date.today() else 0,
    } for inv, sn in query.order_by(PurchaseInvoice.due_date.asc()).all()]

@router.post("/invoices", status_code=201)
async def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(PurchaseInvoice).filter(PurchaseInvoice.invoice_number == data.invoice_number).first():
        raise HTTPException(status_code=400, detail="Invoice number already exists")
    inv = PurchaseInvoice(
        invoice_number=data.invoice_number, purchase_order_id=data.purchase_order_id,
        supplier_id=data.supplier_id, invoice_date=data.invoice_date, due_date=data.due_date,
        subtotal=data.subtotal, tax_amount=data.tax_amount, total_amount=data.total_amount,
        currency=data.currency, notes=data.notes, created_by=current_user.id
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    # Auto-post journal entry
    try:
        from app.services.journal import post_purchase_invoice
        supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
        post_purchase_invoice(db, inv.id, supplier.name if supplier else "Unknown",
                              float(data.subtotal or 0), float(data.tax_amount or 0),
                              float(data.total_amount or 0), current_user.id)
    except Exception:
        pass
    return {"id": inv.id, "invoice_number": inv.invoice_number, "total": float(inv.total_amount)}

@router.post("/invoices/{invoice_id}/payment")
async def record_payment(invoice_id: int, data: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inv = db.query(PurchaseInvoice).filter(PurchaseInvoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    balance = float(inv.total_amount) - float(inv.amount_paid)
    if data.amount > balance + 0.001:
        raise HTTPException(status_code=400, detail=f"Payment {data.amount} exceeds balance {balance:.3f}")
    db.add(Payment(
        payment_type='supplier', reference_type='purchase_invoice', reference_id=invoice_id,
        amount=data.amount, payment_method=data.payment_method, payment_date=data.payment_date,
        bank_reference=data.bank_reference, notes=data.notes, recorded_by=current_user.id
    ))
    inv.amount_paid = float(inv.amount_paid) + data.amount
    inv.status = 'paid' if abs(float(inv.total_amount) - float(inv.amount_paid)) < 0.01 else 'partial'
    db.commit()
    # Auto-post journal entry
    try:
        from app.services.journal import post_purchase_payment
        supplier = db.query(Supplier).filter(Supplier.id == inv.supplier_id).first()
        post_purchase_payment(db, invoice_id, supplier.name if supplier else "Unknown",
                              float(data.amount), data.payment_method or "bank", current_user.id)
    except Exception:
        pass
    return {"invoice_number": inv.invoice_number, "payment": data.amount, "new_balance": round(float(inv.total_amount) - float(inv.amount_paid), 3), "status": inv.status}

# ===== AGING REPORT =====
@router.get("/aging-report")
async def aging_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invoices = db.query(PurchaseInvoice, Supplier.name.label('sname')
    ).join(Supplier, PurchaseInvoice.supplier_id == Supplier.id
    ).filter(PurchaseInvoice.status != 'paid').all()
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    items = []
    for inv, sname in invoices:
        balance = float(inv.total_amount) - float(inv.amount_paid)
        days = (date.today() - inv.due_date).days
        if days <= 0: buckets["current"] += balance
        elif days <= 30: buckets["1_30"] += balance
        elif days <= 60: buckets["31_60"] += balance
        elif days <= 90: buckets["61_90"] += balance
        else: buckets["over_90"] += balance
        items.append({"invoice": inv.invoice_number, "supplier": sname, "due_date": str(inv.due_date), "total": float(inv.total_amount), "paid": float(inv.amount_paid), "balance": round(balance, 3), "days_overdue": max(days, 0)})
    return {"buckets": {k: round(v, 3) for k, v in buckets.items()}, "total_outstanding": round(sum(buckets.values()), 3), "items": items}
