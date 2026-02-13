"""Warehouse Management API — CRUD + stock overview"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.inventory import Warehouse, StockLevel
from app.models.product import Product

router = APIRouter()

class WarehouseCreate(BaseModel):
    code: str
    name: str
    location_type: str = "main"
    parent_id: Optional[int] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    location_type: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("")
async def list_warehouses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    warehouses = db.query(Warehouse).filter(Warehouse.is_active == True).all()
    result = []
    for w in warehouses:
        product_count = db.query(func.count(StockLevel.id)).filter(StockLevel.warehouse_id == w.id, StockLevel.quantity_on_hand > 0).scalar() or 0
        total_units = db.query(func.sum(StockLevel.quantity_on_hand)).filter(StockLevel.warehouse_id == w.id).scalar() or 0
        total_value = db.query(func.sum(StockLevel.quantity_on_hand * Product.standard_cost)).join(Product, StockLevel.product_id == Product.id).filter(StockLevel.warehouse_id == w.id).scalar() or 0
        result.append({
            "id": w.id, "code": w.code, "name": w.name, "location_type": w.location_type,
            "parent_id": w.parent_id, "address_line1": w.address_line1, "city": w.city,
            "is_active": w.is_active, "product_count": product_count,
            "total_units": float(total_units), "total_value": round(float(total_value), 3)
        })
    return result

@router.get("/{warehouse_id}")
async def get_warehouse(warehouse_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    w = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not w: raise HTTPException(status_code=404, detail="Warehouse not found")
    stocks = db.query(StockLevel, Product.name, Product.sku, Product.unit_of_measure).join(Product, StockLevel.product_id == Product.id).filter(StockLevel.warehouse_id == warehouse_id, StockLevel.quantity_on_hand > 0).all()
    return {
        "id": w.id, "code": w.code, "name": w.name, "location_type": w.location_type,
        "address_line1": w.address_line1, "city": w.city,
        "products": [{"product_name": pn, "sku": sku, "quantity": float(sl.quantity_on_hand), "unit": uom} for sl, pn, sku, uom in stocks]
    }

@router.post("", status_code=201)
async def create_warehouse(data: WarehouseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Warehouse).filter(Warehouse.code == data.code).first()
    if existing: raise HTTPException(status_code=400, detail="Warehouse code already exists")
    w = Warehouse(code=data.code, name=data.name, location_type=data.location_type, parent_id=data.parent_id, address_line1=data.address_line1, city=data.city)
    db.add(w)
    db.commit()
    db.refresh(w)
    return {"id": w.id, "code": w.code, "name": w.name, "message": "Warehouse created"}

@router.put("/{warehouse_id}")
async def update_warehouse(warehouse_id: int, data: WarehouseUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    w = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not w: raise HTTPException(status_code=404, detail="Warehouse not found")
    for field, value in data.dict(exclude_unset=True).items():
        setattr(w, field, value)
    db.commit()
    return {"id": w.id, "name": w.name, "message": "Warehouse updated"}
