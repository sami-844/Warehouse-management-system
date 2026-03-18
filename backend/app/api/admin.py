"""Admin API — User management, company settings, backup, activity log"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text, String
from typing import Optional
from pydantic import BaseModel
from datetime import date, datetime
from app.core.database import get_db, engine
from app.core.security import get_password_hash
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.admin import ActivityLog, CompanySettings
from app.models.role import Role as RoleModel, UserActivityLog
from app.models.ui_label import UILabel
from app.utils.permissions import require_permission
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
    default_warehouse_id: Optional[int] = None
    warehouse_group: Optional[str] = None

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
        "default_warehouse_id": u.default_warehouse_id,
        "warehouse_group": u.warehouse_group or '',
        "last_active_at": str(u.last_active_at) if u.last_active_at else None,
        "login_count": u.login_count or 0,
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
        "default_warehouse_id": u.default_warehouse_id,
        "warehouse_group": u.warehouse_group or '',
        "last_active_at": str(u.last_active_at) if u.last_active_at else None,
        "login_count": u.login_count or 0,
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


# ===== Roles Management (Phase 37 — Granular Permissions) =====

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = ''
    is_active: Optional[bool] = True
    permissions: Optional[list] = []


@router.get("/roles")
def get_roles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all roles from DB with user counts and granular permissions"""
    roles = db.query(RoleModel).order_by(RoleModel.id).all()
    result = []
    for role in roles:
        perms = []
        if role.permissions_json:
            try:
                perms = json.loads(role.permissions_json)
            except Exception:
                perms = []
        result.append({
            'id': role.id,
            'name': role.name,
            'display_name': role.display_name or role.name,
            'description': role.description or '',
            'is_active': role.is_active if role.is_active is not None else True,
            'role_type': role.role_type or 'custom',
            'permissions': perms,
            'user_count': db.query(User).filter(
                func.upper(func.cast(User.role, String)) == role.name.upper()
            ).count(),
        })
    return result


@router.put("/roles/{role_id}")
def update_role(role_id: int, data: RoleUpdate, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    """Update a role's display name, description, status, and granular permissions"""
    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail='Role not found')
    if data.display_name is not None:
        role.display_name = data.display_name
    if data.description is not None:
        role.description = data.description
    if data.is_active is not None:
        role.is_active = data.is_active
    if data.permissions is not None:
        role.permissions_json = json.dumps(data.permissions)
    db.commit()
    log_activity(db, current_user, "update_role", "role", role.id,
                 f"Updated role {role.name}")
    return {'message': 'Role updated', 'id': role.id}


# ===== UI LABELS (Admin Label Rename) =====

class LabelUpdate(BaseModel):
    label_value: str


@router.get("/labels")
def get_labels(db: Session = Depends(get_db)):
    """Get all UI labels — no auth required so frontend can load on startup"""
    labels = db.query(UILabel).order_by(UILabel.section, UILabel.label_key).all()
    return [{
        "id": l.id, "key": l.label_key,
        "value": l.custom_label if l.custom_label else l.default_label,
        "default": l.default_label, "group": l.section,
    } for l in labels]


@router.put("/labels/{label_id}")
def update_label(label_id: int, data: LabelUpdate, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    """Update a single label value (requires admin.rename_labels permission)"""
    require_permission(current_user, 'admin.rename_labels', db)
    lbl = db.query(UILabel).filter(UILabel.id == label_id).first()
    if not lbl:
        raise HTTPException(status_code=404, detail="Label not found")
    lbl.custom_label = data.label_value.strip()
    lbl.updated_by = current_user.id
    lbl.updated_at = datetime.now()
    db.commit()
    display_value = lbl.custom_label if lbl.custom_label else lbl.default_label
    log_activity(db, current_user, "update_label", "ui_label", lbl.id,
                 f"Changed '{lbl.label_key}' to '{display_value}'")
    return {"id": lbl.id, "key": lbl.label_key, "value": display_value, "message": "Label updated"}


@router.post("/labels/reset")
def reset_labels(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Reset all labels to their default values (requires admin.rename_labels permission)"""
    require_permission(current_user, 'admin.rename_labels', db)
    labels = db.query(UILabel).all()
    for lbl in labels:
        lbl.custom_label = None
        lbl.updated_by = current_user.id
        lbl.updated_at = datetime.now()
    db.commit()
    log_activity(db, current_user, "reset_labels", "ui_label", None, "Reset all labels to defaults")
    return {"message": f"Reset {len(labels)} labels to defaults"}


@router.get("/roles/{role_name}/permissions")
def get_role_permissions(role_name: str, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    """Get granular permissions for a specific role by name"""
    role = db.query(RoleModel).filter(
        func.upper(RoleModel.name) == role_name.upper()
    ).first()
    if not role:
        return {'permissions': []}
    perms = []
    if role.permissions_json:
        try:
            perms = json.loads(role.permissions_json)
        except Exception:
            perms = []
    return {'permissions': perms}


# ── Phase 47: Database Backup ──
@router.post("/backup")
def trigger_backup(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Trigger a database backup. Admin only."""
    require_permission(current_user, 'admin.master_control', db)
    import subprocess
    from datetime import datetime as dt
    timestamp = dt.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"/tmp/wms_backup_{timestamp}.sql"
    try:
        result = subprocess.run(
            ["pg_dump", "-U", "warehouse_user", "-d", "warehouse", "-f", backup_file],
            capture_output=True, text=True, timeout=120,
            env={**__import__('os').environ, "PGPASSWORD": __import__('os').environ.get("DB_PASSWORD", "")}
        )
        if result.returncode == 0:
            size = os.path.getsize(backup_file) if os.path.exists(backup_file) else 0
            log_activity(db, current_user, "database_backup", "system", None,
                         f"Backup created: {backup_file} ({size} bytes)")
            return {"message": "Backup created successfully", "file": backup_file, "size_bytes": size}
        else:
            return {"message": "Backup failed", "error": result.stderr}
    except Exception as e:
        raise HTTPException(500, f"Backup failed: {str(e)}")


# ── Phase 47: Force Password Reset ──
@router.post("/users/{user_id}/force-password-reset")
def force_password_reset(user_id: int, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    """Force a user to change their password on next login. Admin only."""
    require_permission(current_user, 'admin.users.edit', db)
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(404, "User not found")
    try:
        target_user.must_change_password = True
    except Exception:
        db.execute(text(
            "UPDATE users SET must_change_password = true WHERE id = :uid"
        ), {"uid": user_id})
    db.commit()
    log_activity(db, current_user, "force_password_reset", "user", user_id,
                 f"Forced password reset for {target_user.username}")
    return {"message": f"Password reset required for {target_user.username}"}
