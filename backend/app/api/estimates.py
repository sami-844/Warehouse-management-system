"""Estimates / Quotations API — CRUD + convert to Sales Order"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.business_partner import Customer
from app.models.sales import Estimate, EstimateItem, SalesOrder, SalesOrderItem

router = APIRouter()


# ===== Schemas =====
class EstItemCreate(BaseModel):
    product_id: Optional[int] = None
    description: Optional[str] = None
    quantity: float = 1
    unit_price: float = 0
    discount: float = 0
    tax_rate: float = 5


class EstCreate(BaseModel):
    customer_id: int
    estimate_date: date
    valid_until: Optional[date] = None
    po_number: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[EstItemCreate]


class EstUpdate(BaseModel):
    customer_id: Optional[int] = None
    estimate_date: Optional[date] = None
    valid_until: Optional[date] = None
    po_number: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    status: Optional[str] = None
    items: Optional[List[EstItemCreate]] = None


# ===== Helpers =====
def next_est_number(db: Session) -> str:
    last = db.query(Estimate).order_by(Estimate.id.desc()).first()
    num = (last.id + 1) if last else 1
    return f"EST-{datetime.now().strftime('%Y')}-{num:04d}"


def calc_line(item: EstItemCreate) -> float:
    """Calculate line total after discount"""
    gross = float(item.quantity) * float(item.unit_price)
    return gross * (1 - float(item.discount) / 100)


# ===== ENDPOINTS =====

@router.get("/")
async def list_estimates(
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Estimate, Customer.name.label("cname"), Customer.area).outerjoin(
        Customer, Estimate.customer_id == Customer.id
    )
    if status:
        query = query.filter(Estimate.status == status)
    if customer_id:
        query = query.filter(Estimate.customer_id == customer_id)
    if search:
        query = query.filter(
            Estimate.estimate_number.ilike(f"%{search}%")
            | Customer.name.ilike(f"%{search}%")
        )
    rows = query.order_by(Estimate.estimate_date.desc()).all()
    return [
        {
            "id": e.id,
            "estimate_number": e.estimate_number,
            "customer_id": e.customer_id,
            "customer_name": cn or "Unknown",
            "area": ca or "",
            "estimate_date": str(e.estimate_date),
            "valid_until": str(e.valid_until) if e.valid_until else None,
            "po_number": e.po_number,
            "subtotal": float(e.subtotal or 0),
            "discount_amount": float(e.discount_amount or 0),
            "tax_amount": float(e.tax_amount or 0),
            "total_amount": float(e.total_amount or 0),
            "status": e.status,
        }
        for e, cn, ca in rows
    ]


@router.get("/{est_id}")
async def get_estimate(
    est_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    est = db.query(Estimate).filter(Estimate.id == est_id).first()
    if not est:
        raise HTTPException(404, "Estimate not found")
    customer = db.query(Customer).filter(Customer.id == est.customer_id).first()
    items = (
        db.query(EstimateItem, Product.name.label("pname"), Product.sku)
        .outerjoin(Product, EstimateItem.product_id == Product.id)
        .filter(EstimateItem.estimate_id == est_id)
        .all()
    )
    return {
        "id": est.id,
        "estimate_number": est.estimate_number,
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "code": customer.code,
            "area": customer.area,
        }
        if customer
        else None,
        "estimate_date": str(est.estimate_date),
        "valid_until": str(est.valid_until) if est.valid_until else None,
        "po_number": est.po_number,
        "notes": est.notes,
        "terms": est.terms,
        "subtotal": float(est.subtotal or 0),
        "discount_amount": float(est.discount_amount or 0),
        "tax_amount": float(est.tax_amount or 0),
        "total_amount": float(est.total_amount or 0),
        "status": est.status,
        "items": [
            {
                "id": ei.id,
                "product_id": ei.product_id,
                "product_name": pn or ei.description or "",
                "sku": sku or "",
                "description": ei.description or "",
                "quantity": float(ei.quantity or 0),
                "unit_price": float(ei.unit_price or 0),
                "discount": float(ei.discount or 0),
                "tax_rate": float(ei.tax_rate or 0),
                "line_total": float(ei.line_total or 0),
            }
            for ei, pn, sku in items
        ],
    }


@router.post("/", status_code=201)
async def create_estimate(
    data: EstCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")

    subtotal = 0.0
    total_discount = 0.0
    total_tax = 0.0
    item_rows = []
    for item in data.items:
        gross = float(item.quantity) * float(item.unit_price)
        disc_amt = gross * float(item.discount) / 100
        net = gross - disc_amt
        tax = net * float(item.tax_rate) / 100
        subtotal += gross
        total_discount += disc_amt
        total_tax += tax
        item_rows.append((item, net, disc_amt))

    net_subtotal = subtotal - total_discount
    grand_total = net_subtotal + total_tax

    est = Estimate(
        estimate_number=next_est_number(db),
        estimate_date=data.estimate_date,
        valid_until=data.valid_until,
        customer_id=data.customer_id,
        po_number=data.po_number,
        notes=data.notes,
        terms=data.terms,
        subtotal=Decimal(str(round(subtotal, 3))),
        discount_amount=Decimal(str(round(total_discount, 3))),
        tax_amount=Decimal(str(round(total_tax, 3))),
        total_amount=Decimal(str(round(grand_total, 3))),
        status="draft",
        created_by=current_user.id,
    )
    try:
        db.add(est)
        db.flush()
        for item, net, disc_amt in item_rows:
            product = None
            desc = item.description or ""
            if item.product_id:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product and not desc:
                    desc = product.name
            db.add(
                EstimateItem(
                    estimate_id=est.id,
                    product_id=item.product_id,
                    description=desc,
                    quantity=Decimal(str(item.quantity)),
                    unit_price=Decimal(str(item.unit_price)),
                    discount=Decimal(str(item.discount)),
                    tax_rate=Decimal(str(item.tax_rate)),
                    line_total=Decimal(str(round(net, 3))),
                )
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Failed to create estimate")

    db.refresh(est)
    return {
        "id": est.id,
        "estimate_number": est.estimate_number,
        "total_amount": float(est.total_amount),
        "status": est.status,
    }


@router.put("/{est_id}")
async def update_estimate(
    est_id: int,
    data: EstUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    est = db.query(Estimate).filter(Estimate.id == est_id).first()
    if not est:
        raise HTTPException(404, "Estimate not found")

    # Update scalar fields
    if data.customer_id is not None:
        est.customer_id = data.customer_id
    if data.estimate_date is not None:
        est.estimate_date = data.estimate_date
    if data.valid_until is not None:
        est.valid_until = data.valid_until
    if data.po_number is not None:
        est.po_number = data.po_number
    if data.notes is not None:
        est.notes = data.notes
    if data.terms is not None:
        est.terms = data.terms
    if data.status is not None:
        est.status = data.status

    # Replace items if provided
    if data.items is not None:
        db.query(EstimateItem).filter(EstimateItem.estimate_id == est_id).delete()
        subtotal = 0.0
        total_discount = 0.0
        total_tax = 0.0
        for item in data.items:
            gross = float(item.quantity) * float(item.unit_price)
            disc_amt = gross * float(item.discount) / 100
            net = gross - disc_amt
            tax = net * float(item.tax_rate) / 100
            subtotal += gross
            total_discount += disc_amt
            total_tax += tax
            desc = item.description or ""
            if item.product_id:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product and not desc:
                    desc = product.name
            db.add(
                EstimateItem(
                    estimate_id=est_id,
                    product_id=item.product_id,
                    description=desc,
                    quantity=Decimal(str(item.quantity)),
                    unit_price=Decimal(str(item.unit_price)),
                    discount=Decimal(str(item.discount)),
                    tax_rate=Decimal(str(item.tax_rate)),
                    line_total=Decimal(str(round(net, 3))),
                )
            )
        est.subtotal = Decimal(str(round(subtotal, 3)))
        est.discount_amount = Decimal(str(round(total_discount, 3)))
        est.tax_amount = Decimal(str(round(total_tax, 3)))
        est.total_amount = Decimal(str(round(subtotal - total_discount + total_tax, 3)))

    db.commit()
    db.refresh(est)
    return {"id": est.id, "estimate_number": est.estimate_number, "status": est.status}


@router.delete("/{est_id}")
async def delete_estimate(
    est_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    est = db.query(Estimate).filter(Estimate.id == est_id).first()
    if not est:
        raise HTTPException(404, "Estimate not found")
    if est.status not in ("draft", "declined", "expired"):
        raise HTTPException(400, "Only draft/declined/expired estimates can be deleted")
    db.query(EstimateItem).filter(EstimateItem.estimate_id == est_id).delete()
    db.delete(est)
    db.commit()
    return {"message": "Estimate deleted"}


@router.post("/{est_id}/convert")
async def convert_to_order(
    est_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert an estimate into a Sales Order"""
    est = db.query(Estimate).filter(Estimate.id == est_id).first()
    if not est:
        raise HTTPException(404, "Estimate not found")
    if est.status == "accepted":
        raise HTTPException(400, "Estimate already converted")

    customer = db.query(Customer).filter(Customer.id == est.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")

    items = db.query(EstimateItem).filter(EstimateItem.estimate_id == est_id).all()
    if not items:
        raise HTTPException(400, "Estimate has no items")

    # Build SO number
    last_so = db.query(SalesOrder).order_by(SalesOrder.id.desc()).first()
    so_num = (last_so.id + 1) if last_so else 1
    order_number = f"SO-{datetime.now().strftime('%Y')}-{so_num:04d}"

    subtotal = 0.0
    total_discount = 0.0
    total_tax = 0.0
    so_items = []
    for ei in items:
        gross = float(ei.quantity or 0) * float(ei.unit_price or 0)
        disc_amt = gross * float(ei.discount or 0) / 100
        net = gross - disc_amt
        tax = net * float(ei.tax_rate or 0) / 100
        subtotal += gross
        total_discount += disc_amt
        total_tax += tax
        so_items.append(
            SalesOrderItem(
                product_id=ei.product_id,
                quantity_ordered=int(float(ei.quantity or 0)),
                quantity_shipped=0,
                unit_price=Decimal(str(float(ei.unit_price or 0))),
                unit_cost=Decimal(str(float(ei.unit_price or 0))),
                discount_percent=Decimal(str(float(ei.discount or 0))),
                total_price=Decimal(str(round(net, 3))),
            )
        )

    net_subtotal = subtotal - total_discount
    so = SalesOrder(
        order_number=order_number,
        customer_id=est.customer_id,
        order_date=date.today(),
        subtotal=Decimal(str(round(subtotal, 3))),
        discount_amount=Decimal(str(round(total_discount, 3))),
        tax_amount=Decimal(str(round(total_tax, 3))),
        total_amount=Decimal(str(round(net_subtotal + total_tax, 3))),
        route_area=customer.area,
        delivery_address=customer.address_line1,
        notes=est.notes,
        status="draft",
        created_by=current_user.id,
    )
    try:
        db.add(so)
        db.flush()
        for soi in so_items:
            soi.sales_order_id = so.id
            db.add(soi)
        est.status = "accepted"
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Failed to create sales order from estimate")

    db.refresh(so)
    return {
        "id": so.id,
        "order_number": so.order_number,
        "total_amount": float(so.total_amount),
        "estimate_number": est.estimate_number,
        "message": f"Sales Order {so.order_number} created from {est.estimate_number}",
    }
