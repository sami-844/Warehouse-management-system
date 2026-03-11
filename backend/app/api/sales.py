"""Sales API — SO workflow, deliveries, invoices, pricing, payments"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import date, datetime, timedelta
from pydantic import BaseModel
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.business_partner import Customer
from app.models.inventory import Warehouse, InventoryTransaction, StockLevel, TransactionType
from app.models.sales import (
    SalesOrder, SalesOrderItem, Delivery, SalesInvoice, PricingRule, Payment
)

router = APIRouter()

# ===== Schemas =====
class SOItemCreate(BaseModel):
    product_id: int
    quantity_ordered: int
    unit_price: float
    discount_percent: float = 0

class SOCreate(BaseModel):
    customer_id: int
    order_date: date
    required_date: Optional[date] = None
    delivery_address: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle: Optional[str] = None
    route_area: Optional[str] = None
    tax_rate: float = 5.0  # Oman VAT
    notes: Optional[str] = None
    items: List[SOItemCreate]

class SOUpdate(BaseModel):
    required_date: Optional[date] = None
    delivery_address: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle: Optional[str] = None
    route_area: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class DeliveryComplete(BaseModel):
    actual_delivery_date: date
    delivery_notes: Optional[str] = None
    signature_image: Optional[str] = None
    items_delivered: Optional[str] = None

class PaymentCreate(BaseModel):
    amount: float
    payment_method: str = "cash"
    payment_date: date
    bank_reference: Optional[str] = None
    notes: Optional[str] = None

class PricingRuleCreate(BaseModel):
    rule_name: Optional[str] = None
    product_id: Optional[int] = None
    customer_id: Optional[int] = None
    min_quantity: int = 1
    discount_percent: float = 0
    special_price: Optional[float] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None

# ===== Helpers =====
def next_so_number(db):
    last = db.query(SalesOrder).order_by(SalesOrder.id.desc()).first()
    num = (last.id + 1) if last else 1
    return f"SO-{datetime.now().strftime('%Y')}-{num:04d}"

def next_inv_number(db):
    last = db.query(SalesInvoice).order_by(SalesInvoice.id.desc()).first()
    num = (last.id + 1) if last else 1
    return f"INV-{datetime.now().strftime('%Y')}-{num:04d}"

def get_customer_price(db, product_id: int, customer_id: int, quantity: int):
    """Get best price for customer — checks pricing rules"""
    today = date.today()
    rules = db.query(PricingRule).filter(
        PricingRule.is_active == True,
        PricingRule.product_id == product_id,
        PricingRule.min_quantity <= quantity,
        (PricingRule.customer_id == customer_id) | (PricingRule.customer_id == None),
        (PricingRule.valid_from == None) | (PricingRule.valid_from <= today),
        (PricingRule.valid_to == None) | (PricingRule.valid_to >= today),
    ).order_by(PricingRule.customer_id.desc(), PricingRule.discount_percent.desc()).all()
    if rules:
        rule = rules[0]
        if rule.special_price:
            return float(rule.special_price), float(rule.discount_percent or 0), rule.rule_name
        return None, float(rule.discount_percent or 0), rule.rule_name
    return None, 0, None

# ===== SALES ORDERS =====
@router.get("/orders")
async def list_orders(status: Optional[str] = None, customer_id: Optional[int] = None,
                      area: Optional[str] = None, from_date: Optional[str] = None,
                      db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(SalesOrder, Customer.name.label('cname'), Customer.area
    ).join(Customer, SalesOrder.customer_id == Customer.id)
    if status: query = query.filter(SalesOrder.status == status)
    if customer_id: query = query.filter(SalesOrder.customer_id == customer_id)
    if area: query = query.filter(Customer.area.ilike(f"%{area}%"))
    if from_date: query = query.filter(SalesOrder.order_date >= from_date)
    return [{
        "id": o.id, "order_number": o.order_number, "customer_id": o.customer_id,
        "customer_name": cn, "area": ca, "order_date": str(o.order_date),
        "required_date": str(o.required_date) if o.required_date else None,
        "status": o.status, "subtotal": float(o.subtotal or 0),
        "tax_amount": float(o.tax_amount or 0), "discount_amount": float(o.discount_amount or 0),
        "total_amount": float(o.total_amount or 0),
        "driver_name": o.driver_name, "vehicle": o.vehicle, "route_area": o.route_area,
    } for o, cn, ca in query.order_by(SalesOrder.order_date.desc()).all()]

@router.get("/orders/{so_id}")
async def get_order(so_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so: raise HTTPException(status_code=404, detail="SO not found")
    customer = db.query(Customer).filter(Customer.id == so.customer_id).first()
    items = db.query(SalesOrderItem, Product.name.label('pname'), Product.sku
    ).join(Product, SalesOrderItem.product_id == Product.id
    ).filter(SalesOrderItem.sales_order_id == so_id).all()
    delivery = db.query(Delivery).filter(Delivery.sales_order_id == so_id).first()
    invoice = db.query(SalesInvoice).filter(SalesInvoice.sales_order_id == so_id).first()
    return {
        "id": so.id, "order_number": so.order_number,
        "customer": {"id": customer.id, "name": customer.name, "code": customer.code, "area": customer.area, "payment_terms_days": customer.payment_terms_days} if customer else None,
        "order_date": str(so.order_date), "required_date": str(so.required_date) if so.required_date else None,
        "status": so.status, "subtotal": float(so.subtotal or 0),
        "tax_amount": float(so.tax_amount or 0), "discount_amount": float(so.discount_amount or 0),
        "total_amount": float(so.total_amount or 0),
        "delivery_address": so.delivery_address, "driver_name": so.driver_name,
        "vehicle": so.vehicle, "route_area": so.route_area, "notes": so.notes,
        "items": [{
            "id": i.id, "product_id": i.product_id, "product_name": pn, "sku": sku,
            "quantity_ordered": i.quantity_ordered, "quantity_shipped": i.quantity_shipped or 0,
            "unit_price": float(i.unit_price), "discount_percent": float(i.discount_percent or 0),
            "total_price": float(i.total_price or 0),
        } for i, pn, sku in items],
        "delivery": {
            "id": delivery.id, "status": delivery.status, "driver": delivery.driver_name,
            "vehicle": delivery.vehicle, "scheduled": str(delivery.scheduled_date) if delivery.scheduled_date else None,
            "actual": str(delivery.actual_delivery_date) if delivery.actual_delivery_date else None,
        } if delivery else None,
        "invoice": {
            "id": invoice.id, "number": invoice.invoice_number,
            "total": float(invoice.total_amount), "paid": float(invoice.amount_paid), "status": invoice.status
        } if invoice else None,
    }

@router.post("/orders", status_code=201)
async def create_order(data: SOCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not customer: raise HTTPException(status_code=404, detail="Customer not found")

    subtotal = 0
    total_discount = 0
    item_data = []
    for item in data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product: continue
        price = item.unit_price
        disc = item.discount_percent
        line_total = item.quantity_ordered * price * (1 - disc / 100)
        line_discount = item.quantity_ordered * price * (disc / 100)
        subtotal += item.quantity_ordered * price
        total_discount += line_discount
        item_data.append((item, product, price, disc, line_total))

    net_subtotal = subtotal - total_discount
    tax = net_subtotal * (data.tax_rate / 100)
    order_total = net_subtotal + tax

    # Credit limit check
    if customer.credit_limit and float(customer.credit_limit) > 0:
        current_bal = float(customer.current_balance or 0)
        if (current_bal + order_total) > float(customer.credit_limit):
            raise HTTPException(
                status_code=400,
                detail=f"Order would exceed credit limit of {float(customer.credit_limit):.3f} OMR. "
                       f"Current balance: {current_bal:.3f}, Order total: {order_total:.3f}"
            )

    so = SalesOrder(
        order_number=next_so_number(db), customer_id=data.customer_id,
        order_date=data.order_date, required_date=data.required_date,
        delivery_address=data.delivery_address or customer.address_line1,
        driver_name=data.driver_name, vehicle=data.vehicle,
        route_area=data.route_area or customer.area,
        subtotal=subtotal, discount_amount=total_discount,
        tax_amount=tax, total_amount=net_subtotal + tax,
        status='draft', notes=data.notes, created_by=current_user.id
    )
    try:
        db.add(so)
        db.flush()

        for item, product, price, disc, line_total in item_data:
            db.add(SalesOrderItem(
                sales_order_id=so.id, product_id=item.product_id,
                quantity_ordered=item.quantity_ordered, quantity_shipped=0,
                unit_price=price, unit_cost=float(product.cost_price) if product.cost_price else 0,
                discount_percent=disc, total_price=line_total
            ))

        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to create order — database constraint error")
    db.refresh(so)
    return {"id": so.id, "order_number": so.order_number, "total_amount": float(so.total_amount), "status": so.status}

@router.put("/orders/{so_id}")
async def update_order(so_id: int, data: SOUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so: raise HTTPException(status_code=404, detail="SO not found")
    for field, value in data.dict(exclude_unset=True).items():
        setattr(so, field, value)
    db.commit()
    return {"id": so.id, "order_number": so.order_number, "status": so.status}

@router.post("/orders/{so_id}/confirm")
async def confirm_order(so_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so: raise HTTPException(status_code=404, detail="SO not found")
    if so.status != 'draft': raise HTTPException(status_code=400, detail=f"Cannot confirm from '{so.status}'")

    # Check stock availability
    items = db.query(SalesOrderItem).filter(SalesOrderItem.sales_order_id == so_id).all()
    warnings = []
    for item in items:
        total_stock = db.query(func.sum(StockLevel.quantity_on_hand)).filter(StockLevel.product_id == item.product_id).scalar() or 0
        if total_stock < item.quantity_ordered:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            warnings.append(f"{product.name}: need {item.quantity_ordered}, have {int(total_stock)}")

    so.status = 'confirmed'
    # Create delivery record
    customer = db.query(Customer).filter(Customer.id == so.customer_id).first()
    delivery = Delivery(
        sales_order_id=so_id, vehicle=so.vehicle, driver_name=so.driver_name,
        status='scheduled', scheduled_date=so.required_date or so.order_date,
        route_area=so.route_area or (customer.area if customer else None),
        customer_name=customer.name if customer else None
    )
    db.add(delivery)
    db.commit()
    return {"message": "Order confirmed", "status": "confirmed", "stock_warnings": warnings}

@router.post("/orders/{so_id}/ship")
async def ship_order(so_id: int, warehouse_id: int = Query(default=1),
                     db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so: raise HTTPException(status_code=404, detail="SO not found")
    if so.status not in ('confirmed',): raise HTTPException(status_code=400, detail=f"Cannot ship from '{so.status}'")

    items = db.query(SalesOrderItem, Product.name).join(Product, SalesOrderItem.product_id == Product.id
    ).filter(SalesOrderItem.sales_order_id == so_id).all()

    shipped_items = []
    for item, pname in items:
        stock = db.query(StockLevel).filter(StockLevel.product_id == item.product_id, StockLevel.warehouse_id == warehouse_id).first()
        qty_to_ship = item.quantity_ordered
        if stock and stock.quantity_on_hand >= qty_to_ship:
            stock.quantity_on_hand -= qty_to_ship
            item.quantity_shipped = qty_to_ship
            db.add(InventoryTransaction(
                product_id=item.product_id, warehouse_id=warehouse_id,
                transaction_type=TransactionType.ISSUE, quantity=-qty_to_ship,
                unit_cost=float(item.unit_cost or 0), total_cost=float(item.unit_cost or 0) * qty_to_ship,
                reference_type='sales_order', reference_id=so_id,
                reference_number=so.order_number, notes=f"Shipped to customer",
                created_by=current_user.id
            ))
            shipped_items.append({"product": pname, "qty": qty_to_ship})
        else:
            avail = int(stock.quantity_on_hand) if stock else 0
            ship_qty = min(qty_to_ship, avail)
            if ship_qty > 0:
                stock.quantity_on_hand -= ship_qty
                item.quantity_shipped = ship_qty
                db.add(InventoryTransaction(
                    product_id=item.product_id, warehouse_id=warehouse_id,
                    transaction_type=TransactionType.ISSUE, quantity=-ship_qty,
                    unit_cost=float(item.unit_cost or 0), total_cost=float(item.unit_cost or 0) * ship_qty,
                    reference_type='sales_order', reference_id=so_id,
                    reference_number=so.order_number, notes=f"Partial ship - only {ship_qty} available",
                    created_by=current_user.id
                ))
            shipped_items.append({"product": pname, "qty": ship_qty, "short": qty_to_ship - ship_qty})

    so.status = 'shipped'
    so.shipped_date = date.today()
    delivery = db.query(Delivery).filter(Delivery.sales_order_id == so_id).first()
    if delivery: delivery.status = 'in_transit'
    db.commit()
    return {"message": "Order shipped", "status": "shipped", "items": shipped_items}

@router.post("/orders/{so_id}/deliver")
async def deliver_order(so_id: int, data: DeliveryComplete, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so: raise HTTPException(status_code=404, detail="SO not found")
    so.status = 'delivered'
    so.delivered_date = data.actual_delivery_date
    delivery = db.query(Delivery).filter(Delivery.sales_order_id == so_id).first()
    if delivery:
        delivery.status = 'delivered'
        delivery.actual_delivery_date = data.actual_delivery_date
        delivery.delivery_notes = data.delivery_notes
        delivery.signature_image = data.signature_image
        delivery.items_delivered = data.items_delivered
    db.commit()
    return {"message": "Delivery recorded", "status": "delivered"}

@router.post("/orders/{so_id}/invoice")
async def invoice_order(so_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so: raise HTTPException(status_code=404, detail="SO not found")
    if so.status not in ('delivered', 'shipped'):
        raise HTTPException(status_code=400, detail=f"Cannot invoice from '{so.status}'")
    existing = db.query(SalesInvoice).filter(SalesInvoice.sales_order_id == so_id).first()
    if existing: raise HTTPException(status_code=400, detail=f"Invoice {existing.invoice_number} already exists")
    customer = db.query(Customer).filter(Customer.id == so.customer_id).first()
    due_date = date.today() + timedelta(days=customer.payment_terms_days or 7)
    inv = SalesInvoice(
        invoice_number=next_inv_number(db), sales_order_id=so_id,
        customer_id=so.customer_id, invoice_date=date.today(), due_date=due_date,
        subtotal=float(so.subtotal or 0), tax_amount=float(so.tax_amount or 0),
        discount_amount=float(so.discount_amount or 0), total_amount=float(so.total_amount or 0),
        status='pending', created_by=current_user.id
    )
    db.add(inv)
    so.status = 'invoiced'
    db.commit()
    db.refresh(inv)
    # Auto-post journal entry
    try:
        from app.services.journal import post_sales_invoice
        post_sales_invoice(db, inv.id, customer.name if customer else "Unknown",
                           float(inv.subtotal or 0), float(inv.tax_amount or 0),
                           float(inv.total_amount or 0), current_user.id)
    except Exception:
        pass  # Don't block invoice creation if journal posting fails
    return {"invoice_id": inv.id, "invoice_number": inv.invoice_number, "total": float(inv.total_amount), "due_date": str(inv.due_date)}

# ===== DELIVERIES =====
@router.get("/deliveries")
async def list_deliveries(status: Optional[str] = None, from_date: Optional[str] = None,
                          db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Delivery, SalesOrder.order_number, SalesOrder.total_amount
    ).outerjoin(SalesOrder, Delivery.sales_order_id == SalesOrder.id)
    if status: query = query.filter(Delivery.status == status)
    if from_date: query = query.filter(Delivery.scheduled_date >= from_date)
    return [{
        "id": d.id, "order_number": on, "customer_name": d.customer_name,
        "driver": d.driver_name, "vehicle": d.vehicle, "area": d.route_area,
        "status": d.status, "scheduled_date": str(d.scheduled_date) if d.scheduled_date else None,
        "actual_date": str(d.actual_delivery_date) if d.actual_delivery_date else None,
        "total": float(ta or 0),
        "has_pod_photo": bool(d.pod_photo_base64),
        "pod_latitude": float(d.delivery_latitude) if d.delivery_latitude else None,
        "pod_longitude": float(d.delivery_longitude) if d.delivery_longitude else None,
        "pod_captured_at": str(d.pod_captured_at) if d.pod_captured_at else None,
    } for d, on, ta in query.order_by(Delivery.scheduled_date.desc()).all()]

@router.get("/deliveries/{delivery_id}/pod")
async def get_delivery_pod(delivery_id: int, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    d = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not d: raise HTTPException(status_code=404, detail="Delivery not found")
    return {
        "id": d.id, "status": d.status,
        "pod_photo_base64": d.pod_photo_base64,
        "signature_image": d.signature_image,
        "delivery_latitude": float(d.delivery_latitude) if d.delivery_latitude else None,
        "delivery_longitude": float(d.delivery_longitude) if d.delivery_longitude else None,
        "pod_captured_at": str(d.pod_captured_at) if d.pod_captured_at else None,
        "actual_delivery_date": str(d.actual_delivery_date) if d.actual_delivery_date else None,
        "delivery_notes": d.delivery_notes,
    }

@router.get("/deliveries/today")
async def today_deliveries(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    deliveries = db.query(Delivery, SalesOrder.order_number, SalesOrder.total_amount, Customer.name, Customer.area, Customer.address_line1
    ).outerjoin(SalesOrder, Delivery.sales_order_id == SalesOrder.id
    ).outerjoin(Customer, SalesOrder.customer_id == Customer.id
    ).filter(Delivery.scheduled_date == today).order_by(Delivery.route_area, Customer.name).all()
    by_area = {}
    for d, on, ta, cname, area, addr in deliveries:
        a = area or d.route_area or 'Unassigned'
        if a not in by_area: by_area[a] = []
        by_area[a].append({
            "id": d.id, "order_number": on, "customer": cname or d.customer_name,
            "address": addr, "driver": d.driver_name, "vehicle": d.vehicle,
            "status": d.status, "total": float(ta or 0),
        })
    return {"date": str(today), "total_deliveries": len(deliveries), "by_area": by_area}

@router.get("/deliveries/route/{area}")
async def deliveries_by_area(area: str, delivery_date: Optional[str] = None,
                             db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Delivery, SalesOrder.order_number, SalesOrder.total_amount, Customer.name, Customer.address_line1
    ).outerjoin(SalesOrder, Delivery.sales_order_id == SalesOrder.id
    ).outerjoin(Customer, SalesOrder.customer_id == Customer.id
    ).filter(Delivery.route_area.ilike(f"%{area}%"))
    if delivery_date: query = query.filter(Delivery.scheduled_date == delivery_date)
    else: query = query.filter(Delivery.status.in_(['scheduled', 'in_transit']))
    return [{
        "id": d.id, "order_number": on, "customer": cn, "address": addr,
        "driver": d.driver_name, "status": d.status, "total": float(ta or 0),
    } for d, on, ta, cn, addr in query.all()]

@router.post("/deliveries/{delivery_id}/complete")
async def complete_delivery(delivery_id: int, data: DeliveryComplete,
                            db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    d = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not d: raise HTTPException(status_code=404, detail="Delivery not found")
    d.status = 'delivered'
    d.actual_delivery_date = data.actual_delivery_date
    d.delivery_notes = data.delivery_notes
    d.signature_image = data.signature_image
    d.items_delivered = data.items_delivered
    if d.sales_order_id:
        so = db.query(SalesOrder).filter(SalesOrder.id == d.sales_order_id).first()
        if so: so.status = 'delivered'; so.delivered_date = data.actual_delivery_date
    db.commit()
    return {"message": "Delivery completed", "status": "delivered"}

# ===== SALES INVOICES =====
@router.get("/invoices")
async def list_invoices(status: Optional[str] = None, customer_id: Optional[int] = None,
                        db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(SalesInvoice, Customer.name.label('cname'), Customer.area
    ).join(Customer, SalesInvoice.customer_id == Customer.id)
    if status: query = query.filter(SalesInvoice.status == status)
    if customer_id: query = query.filter(SalesInvoice.customer_id == customer_id)
    return [{
        "id": inv.id, "invoice_number": inv.invoice_number, "so_id": inv.sales_order_id,
        "customer_id": inv.customer_id, "customer_name": cn, "area": ca,
        "invoice_date": str(inv.invoice_date), "due_date": str(inv.due_date),
        "subtotal": float(inv.subtotal or 0), "tax_amount": float(inv.tax_amount or 0),
        "discount_amount": float(inv.discount_amount or 0),
        "total_amount": float(inv.total_amount), "amount_paid": float(inv.amount_paid),
        "balance": round(float(inv.total_amount) - float(inv.amount_paid), 3),
        "status": inv.status,
        "days_overdue": max((date.today() - inv.due_date).days, 0) if inv.status != 'paid' and inv.due_date < date.today() else 0,
    } for inv, cn, ca in query.order_by(SalesInvoice.due_date.asc()).all()]

@router.get("/invoices/overdue")
async def overdue_invoices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    invoices = db.query(SalesInvoice, Customer.name, Customer.phone, Customer.area
    ).join(Customer, SalesInvoice.customer_id == Customer.id
    ).filter(SalesInvoice.status != 'paid', SalesInvoice.due_date < today
    ).order_by(SalesInvoice.due_date.asc()).all()
    total = sum(float(inv.total_amount) - float(inv.amount_paid) for inv, _, _, _ in invoices)
    return {
        "total_overdue": round(total, 3), "count": len(invoices),
        "invoices": [{
            "id": inv.id, "number": inv.invoice_number, "customer": cn, "phone": ph, "area": area,
            "total": float(inv.total_amount), "paid": float(inv.amount_paid),
            "balance": round(float(inv.total_amount) - float(inv.amount_paid), 3),
            "due_date": str(inv.due_date), "days_overdue": (today - inv.due_date).days,
        } for inv, cn, ph, area in invoices]
    }

@router.post("/invoices/{invoice_id}/payment")
async def record_payment(invoice_id: int, data: PaymentCreate,
                         db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inv = db.query(SalesInvoice).filter(SalesInvoice.id == invoice_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Invoice not found")
    balance = float(inv.total_amount) - float(inv.amount_paid)
    if data.amount > balance + 0.01:
        raise HTTPException(status_code=400, detail=f"Payment {data.amount} exceeds balance {balance:.3f}")
    db.add(Payment(
        payment_type='customer', reference_type='sales_invoice', reference_id=invoice_id,
        amount=data.amount, payment_method=data.payment_method, payment_date=data.payment_date,
        bank_reference=data.bank_reference, notes=data.notes, recorded_by=current_user.id
    ))
    inv.amount_paid = float(inv.amount_paid) + data.amount
    inv.status = 'paid' if abs(float(inv.total_amount) - float(inv.amount_paid)) < 0.01 else 'partial'
    # Update customer balance
    customer = db.query(Customer).filter(Customer.id == inv.customer_id).first()
    if customer:
        customer.current_balance = max(0, float(customer.current_balance or 0) - data.amount)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to record payment")
    # Auto-post journal entry
    try:
        from app.services.journal import post_sales_payment
        cust_name = customer.name if customer else "Unknown"
        post_sales_payment(db, invoice_id, cust_name, float(data.amount),
                           data.payment_method or "bank", current_user.id)
    except Exception:
        pass
    return {"invoice_number": inv.invoice_number, "payment": data.amount, "new_balance": round(float(inv.total_amount) - float(inv.amount_paid), 3), "status": inv.status}

# ===== SALES AGING =====
@router.get("/aging-report")
async def sales_aging(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invoices = db.query(SalesInvoice, Customer.name).join(Customer, SalesInvoice.customer_id == Customer.id
    ).filter(SalesInvoice.status != 'paid').all()
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    items = []
    for inv, cname in invoices:
        balance = float(inv.total_amount) - float(inv.amount_paid)
        days = (date.today() - inv.due_date).days
        if days <= 0: buckets["current"] += balance
        elif days <= 30: buckets["1_30"] += balance
        elif days <= 60: buckets["31_60"] += balance
        elif days <= 90: buckets["61_90"] += balance
        else: buckets["over_90"] += balance
        items.append({"invoice": inv.invoice_number, "customer": cname, "due_date": str(inv.due_date), "total": float(inv.total_amount), "paid": float(inv.amount_paid), "balance": round(balance, 3), "days_overdue": max(days, 0)})
    return {"buckets": {k: round(v, 3) for k, v in buckets.items()}, "total_outstanding": round(sum(buckets.values()), 3), "items": items}

# ===== PRICING RULES =====
@router.get("/pricing/rules")
async def list_pricing_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rules = db.query(PricingRule, Product.name.label('pname'), Customer.name.label('cname')
    ).outerjoin(Product, PricingRule.product_id == Product.id
    ).outerjoin(Customer, PricingRule.customer_id == Customer.id).all()
    return [{
        "id": r.id, "rule_name": r.rule_name,
        "product_id": r.product_id, "product_name": pn,
        "customer_id": r.customer_id, "customer_name": cn or "All Customers",
        "min_quantity": r.min_quantity, "discount_percent": float(r.discount_percent or 0),
        "special_price": float(r.special_price) if r.special_price else None,
        "valid_from": str(r.valid_from) if r.valid_from else None,
        "valid_to": str(r.valid_to) if r.valid_to else None,
        "is_active": r.is_active,
    } for r, pn, cn in rules]

@router.post("/pricing/rules", status_code=201)
async def create_pricing_rule(data: PricingRuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = PricingRule(**data.dict(), created_by=current_user.id)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "message": "Pricing rule created"}

@router.get("/pricing/customer/{customer_id}")
async def customer_prices(customer_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    products = db.query(Product).filter(Product.is_active == True, Product.is_deleted != True).order_by(Product.name).all()
    today = date.today()
    result = []
    for p in products:
        base_price = float(p.selling_price) if p.selling_price else 0
        special_price, discount, rule_name = get_customer_price(db, p.id, customer_id, 1)
        effective = special_price if special_price else base_price * (1 - discount / 100)
        result.append({
            "product_id": p.id, "name": p.name, "sku": p.sku,
            "base_price": round(base_price, 3), "discount_percent": discount,
            "special_price": round(special_price, 3) if special_price else None,
            "effective_price": round(effective, 3), "rule": rule_name,
        })
    return result

@router.delete("/pricing/rules/{rule_id}")
async def delete_pricing_rule(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule: raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"message": "Rule deleted"}


# ===== Fawtara E-Invoicing =====

@router.get("/invoices/{invoice_id}/fawtara-xml")
async def download_fawtara_xml(invoice_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generate and download UBL 2.1 XML invoice for Fawtara submission"""
    from fastapi.responses import Response
    from app.services.fawtara import generate_invoice_xml
    from sqlalchemy import text as sql_text

    inv = db.query(SalesInvoice).filter(SalesInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")

    customer = db.query(Customer).filter(Customer.id == inv.customer_id).first()

    # Get line items via sales order
    items_rows = db.execute(sql_text("""
        SELECT soi.quantity_ordered, soi.unit_price, soi.discount_percent,
               p.name as product_name
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.sales_order_id = :so_id
    """), {"so_id": inv.sales_order_id}).fetchall()

    items = []
    for r in items_rows:
        qty = float(r.quantity_ordered)
        price = float(r.unit_price)
        disc = float(r.discount_percent or 0)
        line_total = qty * price * (1 - disc / 100)
        items.append({
            "description": r.product_name,
            "quantity": qty, "unit_price": price,
            "tax_rate": 5, "line_total": line_total,
        })

    subtotal = sum(i["line_total"] for i in items)
    vat_amount = sum(i["line_total"] * i["tax_rate"] / 100 for i in items)
    total_amount = subtotal + vat_amount

    # Company info from company_settings
    try:
        settings_rows = db.execute(sql_text("SELECT setting_key, setting_value FROM company_settings")).fetchall()
        settings = {r.setting_key: r.setting_value for r in settings_rows}
    except Exception:
        settings = {}

    invoice_data = {
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date,
        "due_date": inv.due_date,
        "customer_name": customer.name if customer else "Unknown",
        "customer_vat": getattr(customer, "tax_id", "") or "",
        "customer_address": getattr(customer, "address_line1", "") or "",
        "customer_city": getattr(customer, "area", "") or "",
        "items": items,
        "subtotal": subtotal,
        "vat_amount": vat_amount,
        "total_amount": total_amount,
    }

    company_data = {
        "name": settings.get("company_name", "AK Al Mumayza Trading"),
        "vat_number": settings.get("company_tax_id", ""),
        "address": settings.get("company_address", "Muscat, Oman"),
        "city": "Muscat",
    }

    xml_content = generate_invoice_xml(invoice_data, company_data)
    filename = f"invoice_{inv.invoice_number}_fawtara.xml"

    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
