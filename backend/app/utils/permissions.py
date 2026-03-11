# backend/app/utils/permissions.py
import json
from fastapi import HTTPException


def get_user_permissions(user, db) -> list:
    """Get list of permission strings for a user based on their role."""
    from app.models.role import Role as RoleModel
    from sqlalchemy import func
    role_name = user.role.value if hasattr(user.role, 'value') else user.role
    role = db.query(RoleModel).filter(
        func.upper(RoleModel.name) == role_name.upper()
    ).first()
    if not role or not role.permissions_json:
        return []
    try:
        return json.loads(role.permissions_json)
    except Exception:
        return []


def has_permission(user, permission: str, db) -> bool:
    """Check if user has a specific permission. Admin always returns True."""
    role_name = user.role.value if hasattr(user.role, 'value') else user.role
    if role_name.upper() == 'ADMIN':
        return True
    return permission in get_user_permissions(user, db)


def require_permission(user, permission: str, db):
    """Raise 403 if user does not have the permission."""
    if not has_permission(user, permission, db):
        raise HTTPException(
            status_code=403,
            detail=f'Permission denied: {permission}'
        )


# How to use in any router:
# from app.utils.permissions import require_permission
# require_permission(current_user, 'inventory.products.delete', db)
