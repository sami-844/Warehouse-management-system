"""Customers CRUD API with statements"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import Optional
from pydantic import BaseModel
from datetime import date
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.business_partner import Customer
from app.models.sales import SalesOrder, SalesInvoice, Payment

router = APIRouter()

class CustomerCreate(BaseModel):
    code: str
    name: str
    business_type: Optional[str] = "Grocery"
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    payment_terms_days: int = 7
    credit_limit: Optional[float] = None
    preferred_delivery_day: Optional[str] = None
    delivery_instructions: Optional[str] = None
    notes: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    payment_terms_days: Optional[int] = None
    credit_limit: Optional[float] = None
    preferred_delivery_day: Optional[str] = None
    delivery_instructions: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("")
async def list_customers(area: Optional[str] = None, active_only: bool = False,
                         db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Customer)
    if active_only:
        query = query.filter(Customer.is_active == True)
    if area:
        query = query.filter(Customer.area.ilike(f"%{area}%"))
    customers = query.order_by(Customer.name).all()
    result = []
    for c in customers:
        order_count = db.query(func.count(SalesOrder.id)).filter(SalesOrder.customer_id == c.id).scalar() or 0
        total_sold = db.query(func.sum(SalesOrder.total_amount)).filter(SalesOrder.customer_id == c.id).scalar() or 0
        outstanding = db.query(func.sum(SalesInvoice.total_amount - SalesInvoice.amount_paid)).filter(
            SalesInvoice.customer_id == c.id, SalesInvoice.status != 'paid'
        ).scalar() or 0
        result.append({
            "id": c.id, "code": c.code, "name": c.name,
            "business_type": c.business_type,
            "contact_person": c.contact_person, "email": c.email,
            "phone": c.phone, "mobile": c.mobile,
            "address_line1": c.address_line1, "city": c.city, "area": c.area,
            "latitude": float(c.latitude) if c.latitude else None,
            "longitude": float(c.longitude) if c.longitude else None,
            "payment_terms_days": c.payment_terms_days,
            "credit_limit": float(c.credit_limit) if c.credit_limit else None,
            "current_balance": float(c.current_balance) if c.current_balance else 0,
            "preferred_delivery_day": c.preferred_delivery_day,
            "delivery_instructions": c.delivery_instructions,
            "notes": c.notes, "is_active": c.is_active,
            "total_orders": order_count,
            "total_sales_value": round(float(total_sold), 3),
            "outstanding_balance": round(float(outstanding), 3),
        })
    return result

@router.get("/areas")
async def list_areas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    areas = db.query(Customer.area, func.count(Customer.id)).filter(Customer.area != None).group_by(Customer.area).all()
    return [{"area": a, "customer_count": cnt} for a, cnt in areas if a]

@router.get("/{customer_id}")
async def get_customer(customer_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    orders = db.query(SalesOrder).filter(SalesOrder.customer_id == customer_id).order_by(SalesOrder.order_date.desc()).limit(20).all()
    invoices = db.query(SalesInvoice).filter(SalesInvoice.customer_id == customer_id).order_by(SalesInvoice.invoice_date.desc()).limit(20).all()
    return {
        "id": c.id, "code": c.code, "name": c.name,
        "business_type": c.business_type,
        "contact_person": c.contact_person, "email": c.email,
        "phone": c.phone, "mobile": c.mobile,
        "address_line1": c.address_line1, "address_line2": c.address_line2,
        "city": c.city, "area": c.area, "postal_code": c.postal_code,
        "latitude": float(c.latitude) if c.latitude else None,
        "longitude": float(c.longitude) if c.longitude else None,
        "payment_terms_days": c.payment_terms_days,
        "credit_limit": float(c.credit_limit) if c.credit_limit else None,
        "current_balance": float(c.current_balance) if c.current_balance else 0,
        "preferred_delivery_day": c.preferred_delivery_day,
        "delivery_instructions": c.delivery_instructions,
        "notes": c.notes, "is_active": c.is_active,
        "orders": [{"id": o.id, "number": o.order_number, "date": str(o.order_date), "status": o.status, "total": float(o.total_amount) if o.total_amount else 0} for o in orders],
        "invoices": [{"id": i.id, "number": i.invoice_number, "date": str(i.invoice_date), "total": float(i.total_amount), "paid": float(i.amount_paid), "status": i.status} for i in invoices],
    }

@router.get("/{customer_id}/statement")
async def customer_statement(customer_id: int, from_date: Optional[str] = None, to_date: Optional[str] = None,
                             db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    inv_query = db.query(SalesInvoice).filter(SalesInvoice.customer_id == customer_id)
    if from_date: inv_query = inv_query.filter(SalesInvoice.invoice_date >= from_date)
    if to_date: inv_query = inv_query.filter(SalesInvoice.invoice_date <= to_date)
    invoices = inv_query.order_by(SalesInvoice.invoice_date.asc()).all()

    entries = []
    running_balance = 0
    for inv in invoices:
        amt = float(inv.total_amount)
        running_balance += amt
        entries.append({"date": str(inv.invoice_date), "type": "invoice", "reference": inv.invoice_number, "debit": round(amt, 3), "credit": 0, "balance": round(running_balance, 3)})
        # Get payments for this invoice
        payments = db.query(Payment).filter(Payment.reference_type == 'sales_invoice', Payment.reference_id == inv.id).order_by(Payment.payment_date.asc()).all()
        for p in payments:
            pamt = float(p.amount)
            running_balance -= pamt
            entries.append({"date": str(p.payment_date), "type": "payment", "reference": f"{p.payment_method} - {p.bank_reference or ''}", "debit": 0, "credit": round(pamt, 3), "balance": round(running_balance, 3)})

    total_invoiced = sum(float(i.total_amount) for i in invoices)
    total_paid = sum(float(i.amount_paid) for i in invoices)
    return {
        "customer": {"id": c.id, "code": c.code, "name": c.name},
        "period": {"from": from_date, "to": to_date},
        "summary": {"total_invoiced": round(total_invoiced, 3), "total_paid": round(total_paid, 3), "balance": round(total_invoiced - total_paid, 3)},
        "entries": entries
    }

@router.post("", status_code=201)
async def create_customer(data: CustomerCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(Customer).filter(Customer.code == data.code).first():
        raise HTTPException(status_code=400, detail="Customer code already exists")
    c = Customer(**data.dict(), created_by=current_user.id, is_active=True, current_balance=0)
    db.add(c)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Customer code already exists")
    db.refresh(c)
    return {"id": c.id, "code": c.code, "name": c.name, "message": "Customer created"}

@router.put("/{customer_id}")
async def update_customer(customer_id: int, data: CustomerUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in data.dict(exclude_unset=True).items():
        setattr(c, field, value)
    c.updated_by = current_user.id
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Update failed — constraint violation")
    return {"id": c.id, "name": c.name, "message": "Customer updated"}
