"""
Role-Based Access Control — Phase 5c Updated
6 roles with permission matrix including all new modules.
"""
from enum import Enum


class Role(str, Enum):
    ADMIN = "ADMIN"
    WAREHOUSE_MANAGER = "WAREHOUSE_MANAGER"
    WAREHOUSE_STAFF = "WAREHOUSE_STAFF"
    SALES_STAFF = "SALES_STAFF"
    DELIVERY_DRIVER = "DELIVERY_DRIVER"
    ACCOUNTANT = "ACCOUNTANT"


PUBLIC_PATHS = ["/api/auth", "/api/health", "/api/docs", "/api/redoc", "/api/openapi", "/", "/api/rbac", "/api/admin/labels"]

ROLE_PERMISSIONS = {
    Role.ADMIN: {
        "allowed": ["*"],
        "read_only": [],
    },
    Role.WAREHOUSE_MANAGER: {
        "allowed": [
            "/api/products", "/api/inventory", "/api/warehouses", "/api/fifo",
            "/api/purchases", "/api/suppliers", "/api/reports", "/api/analytics",
            "/api/financial/dashboard", "/api/pdf", "/api/barcodes",
            "/api/returns", "/api/notifications", "/api/dashboard",
        ],
        "read_only": ["/api/sales/orders", "/api/customers", "/api/currency"],
    },
    Role.WAREHOUSE_STAFF: {
        "allowed": [
            "/api/products", "/api/inventory", "/api/warehouses", "/api/fifo",
            "/api/barcodes",
        ],
        "read_only": ["/api/reports", "/api/categories"],
    },
    Role.SALES_STAFF: {
        "allowed": [
            "/api/customers", "/api/sales", "/api/pdf", "/api/reports",
            "/api/returns", "/api/currency",
        ],
        "read_only": ["/api/products", "/api/inventory/stock-levels"],
    },
    Role.DELIVERY_DRIVER: {
        "allowed": [
            "/api/driver", "/api/sales/deliveries",
            "/api/pdf",
        ],
        "read_only": [],
    },
    Role.ACCOUNTANT: {
        "allowed": [
            "/api/financial", "/api/reports", "/api/customers",
            "/api/sales/invoices", "/api/purchases/invoices",
            "/api/returns/credit-notes", "/api/currency",
            "/api/notifications", "/api/dashboard",
        ],
        "read_only": ["/api/products", "/api/sales/orders", "/api/purchases/orders"],
    },
}


def check_permission(role: str, path: str, method: str = "GET") -> bool:
    try:
        r = Role(role.upper())
    except ValueError:
        return False

    perms = ROLE_PERMISSIONS.get(r)
    if not perms:
        return False

    if "*" in perms["allowed"]:
        return True

    for allowed_path in perms["allowed"]:
        if path.startswith(allowed_path):
            return True

    if method == "GET":
        for ro_path in perms.get("read_only", []):
            if path.startswith(ro_path):
                return True

    return False


def get_role_nav_items(role: str) -> dict:
    nav = {
        "dashboard": True, "products": False, "inventory": False,
        "fifo": False, "purchasing": False, "sales": False,
        "deliveries": False, "financial": False, "reports": False,
        "admin": False, "returns": False, "notifications": False,
        "barcodes": False, "currency": False, "driver_app": False,
        "route_optimizer": False,
    }

    try:
        r = Role(role.upper())
    except ValueError:
        return nav

    if r == Role.ADMIN:
        return {k: True for k in nav}

    perms = ROLE_PERMISSIONS.get(r, {})
    all_paths = perms.get("allowed", []) + perms.get("read_only", [])

    mapping = {
        "products": ["/api/products"],
        "inventory": ["/api/inventory", "/api/warehouses"],
        "fifo": ["/api/fifo"],
        "purchasing": ["/api/purchases", "/api/suppliers"],
        "sales": ["/api/sales", "/api/customers"],
        "deliveries": ["/api/sales/deliveries", "/api/driver"],
        "financial": ["/api/financial"],
        "reports": ["/api/reports"],
        "admin": ["/api/admin"],
        "returns": ["/api/returns"],
        "notifications": ["/api/notifications"],
        "barcodes": ["/api/barcodes"],
        "currency": ["/api/currency"],
        "driver_app": ["/api/driver"],
        "route_optimizer": ["/api/driver"],
    }

    for nav_key, api_paths in mapping.items():
        for ap in api_paths:
            if any(ap.startswith(allowed) or allowed.startswith(ap) for allowed in all_paths):
                nav[nav_key] = True
                break

    return nav