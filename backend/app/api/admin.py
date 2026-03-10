"""Admin API — User management, company settings, backup, activity log"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional
from pydantic import BaseModel
from datetime import date, datetime
from app.core.database import get_db, engine
from app.core.security import get_password_hash
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.admin import ActivityLog, CompanySettings
import os, csv, io, json

router = APIRouter()

# ===== Schemas =====
class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    password: str
    role: str = "warehouse_staff"
    phone: Optional[str] = None
    employee_id: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    employee_id: Optional[str] = None
    is_active: Optional[bool] = None

class PasswordChange(BaseModel):
    new_password: str

class SettingUpdate(BaseModel):
    value: str

# ===== Helpers =====
def log_activity(db: Session, user: User, action: str, entity_type: str = None,
                 entity_id: int = None, description: str = None):
    db.add(ActivityLog(
        user_id=user.id, username=user.username, action=action,
        entity_type=entity_type, entity_id=entity_id, description=description
    ))
    db.commit()

# ===== USER MANAGEMENT =====
@router.get("/users")
async def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [{
        "id": u.id, "username": u.username, "email": u.email,
        "full_name": u.full_name, "role": u.role.value if hasattr(u.role, 'value') else u.role,
        "phone": u.phone, "employee_id": u.employee_id,
        "is_active": u.is_active, "is_superuser": u.is_superuser,
        "created_at": str(u.created_at) if u.created_at else None,
        "last_login": str(u.last_login) if hasattr(u, 'last_login') and u.last_login else None,
    } for u in users]

@router.get("/users/{user_id}")
async def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    # Recent activity
    activities = db.query(ActivityLog).filter(ActivityLog.user_id == user_id
    ).order_by(ActivityLog.created_at.desc()).limit(20).all()
    return {
        "id": u.id, "username": u.username, "email": u.email,
        "full_name": u.full_name, "role": u.role.value if hasattr(u.role, 'value') else u.role,
        "phone": u.phone, "employee_id": u.employee_id,
        "is_active": u.is_active, "is_superuser": u.is_superuser,
        "created_at": str(u.created_at) if u.created_at else None,
        "recent_activity": [{
            "action": a.action, "entity_type": a.entity_type,
            "description": a.description, "date": str(a.created_at)
        } for a in activities]
    }

@router.post("/users", status_code=201)
async def create_user(data: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    role_map = {
        "admin": UserRole.ADMIN, "warehouse_manager": UserRole.WAREHOUSE_MANAGER,
        "warehouse_staff": UserRole.WAREHOUSE_STAFF, "sales_staff": UserRole.SALES_STAFF,
        "delivery_driver": UserRole.DELIVERY_DRIVER, "accountant": UserRole.ACCOUNTANT,
    }
    role = role_map.get(data.role, UserRole.WAREHOUSE_STAFF)
    u = User(
        username=data.username, email=data.email, full_name=data.full_name,
        hashed_password=get_password_hash(data.password), role=role,
        phone=data.phone, employee_id=data.employee_id,
        is_active=True, is_superuser=(data.role == "admin"),
        created_by=current_user.id
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    log_activity(db, current_user, "create_user", "user", u.id, f"Created user {data.username}")
    return {"id": u.id, "username": u.username, "message": "User created"}

@router.put("/users/{user_id}")
async def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    role_map = {
        "admin": UserRole.ADMIN, "warehouse_manager": UserRole.WAREHOUSE_MANAGER,
        "warehouse_staff": UserRole.WAREHOUSE_STAFF, "sales_staff": UserRole.SALES_STAFF,
        "delivery_driver": UserRole.DELIVERY_DRIVER, "accountant": UserRole.ACCOUNTANT,
    }
    for field, value in data.dict(exclude_unset=True).items():
        if field == "role":
            setattr(u, field, role_map.get(value, UserRole.WAREHOUSE_STAFF))
        else:
            setattr(u, field, value)
    u.updated_by = current_user.id
    db.commit()
    log_activity(db, current_user, "update_user", "user", user_id, f"Updated user {u.username}")
    return {"id": u.id, "username": u.username, "message": "User updated"}

@router.post("/users/{user_id}/password")
async def change_password(user_id: int, data: PasswordChange, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    u.hashed_password = get_password_hash(data.new_password)
    db.commit()
    log_activity(db, current_user, "change_password", "user", user_id, f"Password changed for {u.username}")
    return {"message": f"Password changed for {u.username}"}

@router.post("/users/{user_id}/deactivate")
async def deactivate_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    u.is_active = not u.is_active
    db.commit()
    status = "activated" if u.is_active else "deactivated"
    log_activity(db, current_user, f"{status}_user", "user", user_id, f"{status.capitalize()} user {u.username}")
    return {"message": f"User {u.username} {status}", "is_active": u.is_active}

# ===== COMPANY SETTINGS =====
@router.get("/settings")
async def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(CompanySettings).order_by(CompanySettings.setting_key).all()
    return {s.setting_key: {"value": s.setting_value, "type": s.setting_type} for s in settings}

@router.put("/settings/{key}")
async def update_setting(key: str, data: SettingUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(CompanySettings).filter(CompanySettings.setting_key == key).first()
    if not s:
        s = CompanySettings(setting_key=key, setting_value=data.value, updated_by=current_user.id)
        db.add(s)
    else:
        s.setting_value = data.value
        s.updated_by = current_user.id
        s.updated_at = datetime.now()
    db.commit()
    log_activity(db, current_user, "update_setting", "setting", None, f"Changed {key} to {data.value}")
    return {"key": key, "value": data.value, "message": "Setting updated"}

@router.post("/settings/bulk")
async def update_settings_bulk(settings: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    for key, value in settings.items():
        s = db.query(CompanySettings).filter(CompanySettings.setting_key == key).first()
        if s:
            s.setting_value = str(value)
            s.updated_by = current_user.id
            s.updated_at = datetime.now()
        else:
            db.add(CompanySettings(setting_key=key, setting_value=str(value), updated_by=current_user.id))
    db.commit()
    log_activity(db, current_user, "update_settings_bulk", "setting", None, f"Bulk updated {len(settings)} settings")
    return {"message": f"Updated {len(settings)} settings"}

# ===== ACTIVITY LOG =====
@router.get("/activity-log")
async def get_activity_log(limit: int = 50, user_id: Optional[int] = None,
                           action: Optional[str] = None,
                           db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(ActivityLog)
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if action:
        query = query.filter(ActivityLog.action.ilike(f"%{action}%"))
    logs = query.order_by(ActivityLog.created_at.desc()).limit(limit).all()
    return [{
        "id": l.id, "user_id": l.user_id, "username": l.username,
        "action": l.action, "entity_type": l.entity_type, "entity_id": l.entity_id,
        "description": l.description, "date": str(l.created_at)
    } for l in logs]

# ===== BACKUP & EXPORT =====
@router.post("/backup")
async def create_backup(current_user: User = Depends(get_current_user)):
    return {
        "message": "PostgreSQL backup must be performed via pg_dump on the server",
        "command": "pg_dump -U warehouse_user warehouse > backup.sql",
        "note": "Use Dokploy or SSH to run pg_dump — file-based backup not available in PostgreSQL mode",
    }

@router.get("/backup/list")
async def list_backups(current_user: User = Depends(get_current_user)):
    return {"backups": [], "note": "SQLite backups not available — database is PostgreSQL"}

@router.get("/export/{table_name}")
async def export_csv(table_name: str, current_user: User = Depends(get_current_user)):
    allowed = ["products", "customers", "suppliers", "sales_orders", "purchase_orders",
               "inventory_transactions", "stock_levels", "users", "sales_invoices",
               "purchase_invoices", "payments", "deliveries", "pricing_rules"]
    if table_name not in allowed:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' not exportable")
    try:
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT * FROM {table_name}"))
            keys = list(result.keys())
            rows = result.fetchall()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Table not found: {e}")
    if not rows:
        return StreamingResponse(io.StringIO("No data"), media_type="text/csv",
                                 headers={"Content-Disposition": f"attachment; filename={table_name}.csv"})
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(keys)
    for row in rows:
        writer.writerow(list(row))
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={table_name}_{date.today().isoformat()}.csv"})

@router.get("/export-all")
async def export_all_tables(current_user: User = Depends(get_current_user)):
    """Returns metadata about all exportable tables"""
    tables = ["products", "customers", "suppliers", "sales_orders", "sales_order_items",
              "purchase_orders", "purchase_order_items", "inventory_transactions",
              "stock_levels", "users", "deliveries"]
    result = []
    for t in tables:
        try:
            with engine.connect() as conn:
                count = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar() or 0
                result.append({"table": t, "rows": count})
        except Exception:
            pass
    return {"tables": result}


@router.get("/export-json")
async def export_json_backup(current_user: User = Depends(get_current_user)):
    """Export key tables as JSON for backup/download"""
    tables = ["products", "customers", "suppliers", "stock_levels", "warehouses",
              "sales_orders", "purchase_orders"]
    backup = {"exported_at": datetime.now().isoformat(), "tables": {}}
    for t in tables:
        try:
            with engine.connect() as conn:
                result = conn.execute(text(f"SELECT * FROM {t} LIMIT 5000"))
                keys = list(result.keys())
                rows = [dict(zip(keys, [str(v) if v is not None else None for v in row])) for row in result.fetchall()]
                backup["tables"][t] = {"count": len(rows), "data": rows}
        except Exception as e:
            backup["tables"][t] = {"count": 0, "data": [], "error": str(e)}
    output = io.StringIO()
    json.dump(backup, output, indent=2, default=str)
    output.seek(0)
    filename = f"wms_backup_{date.today().isoformat()}.json"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
