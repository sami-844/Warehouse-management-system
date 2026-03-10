"""Suppliers CRUD API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from pydantic import BaseModel
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.business_partner import Supplier
from app.models.purchase import PurchaseOrder, PurchaseInvoice

router = APIRouter()

class SupplierCreate(BaseModel):
    code: str
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    payment_terms_days: int = 30
    credit_limit: Optional[float] = None
    tax_id: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    notes: Optional[str] = None
    opening_balance: Optional[float] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    payment_terms_days: Optional[int] = None
    credit_limit: Optional[float] = None
    tax_id: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("")
async def list_suppliers(active_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Supplier)
    if active_only:
        query = query.filter(Supplier.is_active == True)
    suppliers = query.order_by(Supplier.name).all()
    result = []
    for s in suppliers:
        po_count = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.supplier_id == s.id).scalar() or 0
        total_ordered = db.query(func.sum(PurchaseOrder.total_amount)).filter(PurchaseOrder.supplier_id == s.id).scalar() or 0
        outstanding = db.query(func.sum(PurchaseInvoice.total_amount - PurchaseInvoice.amount_paid)).filter(
            PurchaseInvoice.supplier_id == s.id, PurchaseInvoice.status != 'paid'
        ).scalar() or 0
        result.append({
            "id": s.id, "code": s.code, "name": s.name,
            "contact_person": s.contact_person, "email": s.email,
            "phone": s.phone, "mobile": s.mobile,
            "address_line1": s.address_line1, "city": s.city, "country": s.country,
            "payment_terms_days": s.payment_terms_days,
            "credit_limit": float(s.credit_limit) if s.credit_limit else None,
            "tax_id": s.tax_id, "bank_name": s.bank_name, "bank_account": s.bank_account,
            "notes": s.notes, "is_active": s.is_active,
            "total_orders": po_count,
            "total_ordered_value": round(float(total_ordered), 3),
            "outstanding_balance": round(float(outstanding), 3),
        })
    return result

@router.get("/{supplier_id}")
async def get_supplier(supplier_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    orders = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == supplier_id).order_by(PurchaseOrder.order_date.desc()).limit(20).all()
    invoices = db.query(PurchaseInvoice).filter(PurchaseInvoice.supplier_id == supplier_id).order_by(PurchaseInvoice.invoice_date.desc()).limit(20).all()
    return {
        "id": s.id, "code": s.code, "name": s.name,
        "contact_person": s.contact_person, "email": s.email,
        "phone": s.phone, "mobile": s.mobile,
        "address_line1": s.address_line1, "address_line2": s.address_line2,
        "city": s.city, "country": s.country, "postal_code": s.postal_code,
        "payment_terms_days": s.payment_terms_days,
        "credit_limit": float(s.credit_limit) if s.credit_limit else None,
        "tax_id": s.tax_id, "bank_name": s.bank_name, "bank_account": s.bank_account,
        "notes": s.notes, "is_active": s.is_active,
        "orders": [{"id": o.id, "po_number": o.po_number, "date": str(o.order_date), "status": o.status, "total": float(o.total_amount) if o.total_amount else 0} for o in orders],
        "invoices": [{"id": i.id, "number": i.invoice_number, "date": str(i.invoice_date), "total": float(i.total_amount), "paid": float(i.amount_paid), "status": i.status} for i in invoices],
    }

@router.post("", status_code=201)
async def create_supplier(data: SupplierCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(Supplier).filter(Supplier.code == data.code).first():
        raise HTTPException(status_code=400, detail="Supplier code already exists")
    opening_bal = float(data.opening_balance or 0)
    fields = data.dict(exclude={'opening_balance'})
    if opening_bal > 0:
        existing_notes = fields.get('notes') or ''
        fields['notes'] = f"[Opening Balance: {opening_bal:.3f} OMR]\n{existing_notes}".strip()
    s = Supplier(**fields, created_by=current_user.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "code": s.code, "name": s.name, "opening_balance": opening_bal, "message": "Supplier created"}

@router.put("/{supplier_id}")
async def update_supplier(supplier_id: int, data: SupplierUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for field, value in data.dict(exclude_unset=True).items():
        setattr(s, field, value)
    s.updated_by = current_user.id
    db.commit()
    return {"id": s.id, "name": s.name, "message": "Supplier updated"}


@router.post("/import", status_code=201)
async def import_suppliers(rows: List[dict], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Bulk import suppliers from CSV rows. Skips rows with duplicate code."""
    from sqlalchemy.exc import IntegrityError
    created, skipped, errors = 0, 0, []
    for i, row in enumerate(rows):
        try:
            code = str(row.get('code', '') or '').strip()
            name = str(row.get('name', '') or '').strip()
            if not code or not name:
                skipped += 1
                continue
            if db.query(Supplier).filter(Supplier.code == code).first():
                skipped += 1
                continue
            s = Supplier(
                code=code, name=name,
                contact_person=str(row.get('contact_person', '') or '').strip() or None,
                phone=str(row.get('phone', '') or '').strip() or None,
                email=str(row.get('email', '') or '').strip() or None,
                city=str(row.get('city', '') or '').strip() or None,
                payment_terms_days=int(row.get('payment_terms_days', 30) or 30),
                is_active=True, created_by=current_user.id
            )
            db.add(s)
            created += 1
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            skipped += 1
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Import failed — database constraint error")
    return {"created": created, "skipped": skipped, "errors": errors[:10]}
