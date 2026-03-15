"""
Product Brands API — Phase 31
CRUD for product brands.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text
from app.core.database import engine

router = APIRouter()


def run_q(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


class BrandCreate(BaseModel):
    name: str
    status: str = "active"


class BrandUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None


@router.get("/brands")
def list_brands():
    try:
        rows = run_q("""
            SELECT b.id, b.name, b.status, b.created_at,
                   (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.is_active = true) as product_count
            FROM product_brands b
            ORDER BY b.name
        """)
        return {"brands": rows, "total": len(rows)}
    except Exception:
        return {"brands": [], "total": 0}


@router.post("/brands")
def create_brand(data: BrandCreate):
    if not data.name.strip():
        raise HTTPException(400, "Brand name is required")
    with engine.begin() as conn:
        try:
            result = conn.execute(text("""
                INSERT INTO product_brands (name, status) VALUES (:name, :status)
                RETURNING id
            """), {"name": data.name.strip(), "status": data.status})
            brand_id = result.fetchone()[0]
        except Exception:
            raise HTTPException(400, "Brand name already exists")
    return {"message": f"Brand '{data.name}' created", "id": brand_id}


@router.put("/brands/{brand_id}")
def update_brand(brand_id: int, data: BrandUpdate):
    rows = run_q("SELECT * FROM product_brands WHERE id = :id", {"id": brand_id})
    if not rows:
        raise HTTPException(404, "Brand not found")
    sets, params = [], {"id": brand_id}
    if data.name is not None:
        sets.append("name = :name")
        params["name"] = data.name.strip()
    if data.status is not None:
        sets.append("status = :status")
        params["status"] = data.status
    if not sets:
        return {"message": "Nothing to update"}
    with engine.begin() as conn:
        conn.execute(text(f"UPDATE product_brands SET {', '.join(sets)} WHERE id = :id"), params)
    return {"message": "Brand updated"}


@router.delete("/brands/{brand_id}")
def delete_brand(brand_id: int):
    rows = run_q("SELECT * FROM product_brands WHERE id = :id", {"id": brand_id})
    if not rows:
        raise HTTPException(404, "Brand not found")
    with engine.begin() as conn:
        conn.execute(text("UPDATE product_brands SET status = 'inactive' WHERE id = :id"), {"id": brand_id})
    return {"message": "Brand deactivated"}
