"""
Variation Templates API — Phase 31
CRUD for variation templates and values.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import text
from app.core.database import engine

router = APIRouter()


def run_q(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


class VariationCreate(BaseModel):
    name: str
    values: List[str] = []
    status: str = "active"


class VariationUpdate(BaseModel):
    name: Optional[str] = None
    values: Optional[List[str]] = None
    status: Optional[str] = None


@router.get("/variations")
def list_variations():
    try:
        templates = run_q("""
            SELECT id, name, status, created_at FROM variation_templates ORDER BY name
        """)
        for t in templates:
            vals = run_q("""
                SELECT id, value, sort_order FROM variation_values
                WHERE template_id = :tid ORDER BY sort_order, id
            """, {"tid": t["id"]})
            t["values"] = [v["value"] for v in vals]
        return {"variations": templates, "total": len(templates)}
    except Exception:
        return {"variations": [], "total": 0}


@router.post("/variations")
def create_variation(data: VariationCreate):
    if not data.name.strip():
        raise HTTPException(400, "Template name is required")
    with engine.begin() as conn:
        try:
            result = conn.execute(text("""
                INSERT INTO variation_templates (name, status) VALUES (:name, :status)
                RETURNING id
            """), {"name": data.name.strip(), "status": data.status})
            tid = result.fetchone()[0]
        except Exception:
            raise HTTPException(400, "Template name already exists")
        for i, val in enumerate(data.values):
            if val.strip():
                conn.execute(text("""
                    INSERT INTO variation_values (template_id, value, sort_order)
                    VALUES (:tid, :val, :sort)
                """), {"tid": tid, "val": val.strip(), "sort": i})
    return {"message": f"Variation '{data.name}' created", "id": tid}


@router.put("/variations/{variation_id}")
def update_variation(variation_id: int, data: VariationUpdate):
    rows = run_q("SELECT * FROM variation_templates WHERE id = :id", {"id": variation_id})
    if not rows:
        raise HTTPException(404, "Variation template not found")
    with engine.begin() as conn:
        sets, params = [], {"id": variation_id}
        if data.name is not None:
            sets.append("name = :name")
            params["name"] = data.name.strip()
        if data.status is not None:
            sets.append("status = :status")
            params["status"] = data.status
        if sets:
            conn.execute(text(f"UPDATE variation_templates SET {', '.join(sets)} WHERE id = :id"), params)
        if data.values is not None:
            conn.execute(text("DELETE FROM variation_values WHERE template_id = :id"), {"id": variation_id})
            for i, val in enumerate(data.values):
                if val.strip():
                    conn.execute(text("""
                        INSERT INTO variation_values (template_id, value, sort_order)
                        VALUES (:tid, :val, :sort)
                    """), {"tid": variation_id, "val": val.strip(), "sort": i})
    return {"message": "Variation updated"}


@router.delete("/variations/{variation_id}")
def delete_variation(variation_id: int):
    rows = run_q("SELECT * FROM variation_templates WHERE id = :id", {"id": variation_id})
    if not rows:
        raise HTTPException(404, "Variation template not found")
    with engine.begin() as conn:
        conn.execute(text("UPDATE variation_templates SET status = 'inactive' WHERE id = :id"), {"id": variation_id})
    return {"message": "Variation deactivated"}
