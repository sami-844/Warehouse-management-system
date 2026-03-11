"""Main FastAPI Application — Warehouse Management System (Phase 5c Complete)"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import engine, Base
from analytics_router import router as analytics_router
from app.models import *

app = FastAPI(
    title=settings.APP_NAME, version="5.3",
    description="Wholesale Distribution Management System — AK Al Mumayza Trading",
    docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json"
)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RBAC Middleware
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@app.middleware("http")
async def rbac_middleware(request: Request, call_next):
    path = request.url.path
    method = request.method

    from app.api.rbac import PUBLIC_PATHS
    if method == "OPTIONS" or any(path.startswith(p) for p in PUBLIC_PATHS):
        return await call_next(request)

    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        from app.core.security import decode_access_token
        from app.api.rbac import check_permission
        token = auth_header.split(" ", 1)[1]
        payload = decode_access_token(token)
        if payload:
            role = payload.get("role", "")
            if not check_permission(role, path, method):
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"Access denied for role '{role}' on {method} {path}"}
                )

    return await call_next(request)


app.include_router(analytics_router)

@app.on_event("startup")
async def startup_event():
    print(f"Starting {settings.APP_NAME} v5.3")
    from sqlalchemy import text
    from sqlalchemy.exc import ProgrammingError
    # Only run PostgreSQL-specific ENUM creation on PostgreSQL
    if "postgresql" in settings.DATABASE_URL:
        with engine.connect() as conn:
            try:
                conn.execute(text("CREATE TYPE userrole AS ENUM ('ADMIN', 'WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'SALES_STAFF', 'DELIVERY_DRIVER', 'ACCOUNTANT')"))
                conn.commit()
            except ProgrammingError:
                conn.rollback()
    Base.metadata.create_all(bind=engine, checkfirst=True)
    # Ensure soft-delete columns exist on products table (ALTER TABLE for existing DBs)
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT is_deleted FROM products LIMIT 1"))
        except Exception:
            try:
                conn.execute(text("ALTER TABLE products ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE"))
                conn.execute(text("ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE products ADD COLUMN deleted_by INTEGER"))
                conn.execute(text("ALTER TABLE products ADD COLUMN deleted_reason TEXT"))
                conn.commit()
                print("Added soft-delete columns to products table")
            except Exception as e:
                conn.rollback()
                print(f"Soft-delete column migration note: {e}")
    print("Database tables verified — All Phase 5c modules active")

@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down Warehouse Management System")

@app.get("/")
async def root():
    return {"message": "AK Al Mumayza - Warehouse Management System", "version": "5.3", "status": "online"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "app_name": settings.APP_NAME, "version": "5.3"}

# ── Core Routers (Phase 1) ──
from app.api import auth, products, inventory
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(products.router, prefix="/api", tags=["Products"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])

try:
    from app.api.warehouses import router as warehouses_router
    app.include_router(warehouses_router, prefix="/api/warehouses", tags=["Warehouses"])
except ImportError:
    pass

# ── Phase 2: Purchasing ──
try:
    from app.api.suppliers import router as suppliers_router
    from app.api.purchases import router as purchases_router
    app.include_router(suppliers_router, prefix="/api/suppliers", tags=["Suppliers"])
    app.include_router(purchases_router, prefix="/api/purchases", tags=["Purchases"])
except ImportError:
    pass

# ── Phase 3: Sales ──
try:
    from app.api.customers import router as customers_router
    from app.api.sales import router as sales_router
    app.include_router(customers_router, prefix="/api/customers", tags=["Customers"])
    app.include_router(sales_router, prefix="/api/sales", tags=["Sales"])
except ImportError:
    pass

# ── Estimates ──
try:
    from app.api.estimates import router as estimates_router
    app.include_router(estimates_router, prefix="/api/estimates", tags=["Estimates"])
except ImportError:
    pass

# ── Phase 4: Financial & Admin ──
from app.api.financial import router as financial_router
from app.api.reports import router as reports_router
from app.api.admin import router as admin_router
app.include_router(financial_router, prefix="/api/financial", tags=["Financial"])
app.include_router(reports_router, prefix="/api/reports", tags=["Reports"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])

# ── Phase 5b: PDF + FIFO ──
try:
    from app.api.pdf_generator import router as pdf_router
    app.include_router(pdf_router, prefix="/api/pdf", tags=["PDF & Print"])
    print("  ✅ PDF module loaded")
except ImportError as e:
    print(f"  ⚠️  PDF module: {e}")

try:
    from app.api.fifo import router as fifo_router
    app.include_router(fifo_router, prefix="/api/fifo", tags=["FIFO Stock"])
    print("  ✅ FIFO module loaded")
except ImportError as e:
    print(f"  ⚠️  FIFO module: {e}")

# ── Phase 5c: Returns & Credits ──
try:
    from app.api.returns import router as returns_router
    app.include_router(returns_router, prefix="/api/returns", tags=["Returns & Credits"])
    print("  ✅ Returns module loaded")
except ImportError as e:
    print(f"  ⚠️  Returns module: {e}")

# ── Phase 24: Purchase Returns & Debit Notes ──
try:
    from app.api.purchase_returns import router as purchase_returns_router
    app.include_router(purchase_returns_router, prefix="/api/purchase-returns", tags=["Purchase Returns"])
    print("  ✅ Purchase Returns module loaded")
except ImportError as e:
    print(f"  ⚠️  Purchase Returns module: {e}")

# ── Phase 25: Bills ──
try:
    from app.api.bills import router as bills_router
    app.include_router(bills_router, prefix="/api/bills", tags=["Bills"])
    print("  ✅ Bills module loaded")
except ImportError as e:
    print(f"  ⚠️  Bills module: {e}")

# ── Phase 5c: Email Notifications ──
try:
    from app.api.notifications import router as notifications_router
    app.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
    print("  ✅ Notifications module loaded")
except ImportError as e:
    print(f"  ⚠️  Notifications module: {e}")

# ── Phase 5c: Driver API ──
try:
    from app.api.driver_api import router as driver_router
    app.include_router(driver_router, prefix="/api/driver", tags=["Driver App"])
    print("  ✅ Driver API loaded")
except ImportError as e:
    print(f"  ⚠️  Driver API: {e}")

# ── Phase 5c: Barcode Labels ──
try:
    from app.api.barcode_labels import router as barcode_router
    app.include_router(barcode_router, prefix="/api/barcodes", tags=["Barcode Labels"])
    print("  ✅ Barcode module loaded")
except ImportError as e:
    print(f"  ⚠️  Barcode module: {e}")

# ── Phase 5c: Multi-Currency ──
try:
    from app.api.multicurrency import router as currency_router
    app.include_router(currency_router, prefix="/api/currency", tags=["Multi-Currency"])
    print("  ✅ Multi-currency module loaded")
except ImportError as e:
    print(f"  ⚠️  Multi-currency module: {e}")

# ── Phase 9: Accounting ──
try:
    from app.api.accounting import router as accounting_router
    app.include_router(accounting_router, prefix="/api/accounting", tags=["Accounting"])
    print("  ✅ Accounting module loaded")
except ImportError as e:
    print(f"  ⚠️  Accounting module: {e}")

# ── Phase 12: Messaging ──
try:
    from app.api.messaging import router as messaging_router
    app.include_router(messaging_router, prefix="/api/messaging", tags=["Messaging"])
    print("  ✅ Messaging module loaded")
except ImportError as e:
    print(f"  ⚠️  Messaging module: {e}")

# ── Phase 26: Advance Payments ──
try:
    from app.api.advance_payments import router as advance_payments_router
    app.include_router(advance_payments_router, prefix="/api/advance-payments", tags=["Advance Payments"])
    print("  ✅ Advance Payments module loaded")
except ImportError as e:
    print(f"  ⚠️  Advance Payments module: {e}")

try:
    from app.api.bank_accounts import router as bank_accounts_router
    app.include_router(bank_accounts_router, prefix="/api/bank-accounts", tags=["Bank Accounts"])
    print("  ✅ Bank Accounts module loaded")
except ImportError as e:
    print(f"  ⚠️  Bank Accounts module: {e}")

# ── Phase 31: Brands + Variations + Damage Items ──
try:
    from app.api.brands import router as brands_router
    app.include_router(brands_router, prefix="/api", tags=["Brands"])
    print("  ✅ Brands module loaded")
except ImportError as e:
    print(f"  ⚠️  Brands module: {e}")

try:
    from app.api.variations import router as variations_router
    app.include_router(variations_router, prefix="/api", tags=["Variations"])
    print("  ✅ Variations module loaded")
except ImportError as e:
    print(f"  ⚠️  Variations module: {e}")

try:
    from app.api.damage_items import router as damage_items_router
    app.include_router(damage_items_router, prefix="/api", tags=["Damage Items"])
    print("  ✅ Damage Items module loaded")
except ImportError as e:
    print(f"  ⚠️  Damage Items module: {e}")

# ── Phase 32: Dashboard Summary ──
try:
    from app.api.dashboard import router as dashboard_router
    app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
    print("  \u2705 Dashboard Summary module loaded")
except ImportError as e:
    print(f"  \u26a0\ufe0f  Dashboard Summary module: {e}")

# ── RBAC Navigation Helper ──
@app.get("/api/rbac/nav-items")
async def get_nav_items(role: str = "ADMIN"):
    from app.api.rbac import get_role_nav_items
    return get_role_nav_items(role)

@app.get("/api/rbac/permissions")
async def get_permissions():
    from app.api.rbac import ROLE_PERMISSIONS, Role
    return {r.value: ROLE_PERMISSIONS[r] for r in Role}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")