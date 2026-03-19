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

def run_migrations():
    """Run Alembic migrations with timeout — skip if database is locked."""
    import os
    import threading

    def _run():
        from alembic.config import Config
        from alembic import command as alembic_command
        alembic_ini = os.path.join(os.path.dirname(__file__), "alembic.ini")
        alembic_cfg = Config(alembic_ini)
        alembic_cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "alembic"))
        alembic_command.upgrade(alembic_cfg, "head")

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    thread.join(timeout=15)  # Wait max 15 seconds
    if thread.is_alive():
        print("Alembic migration timed out (database may be locked) — skipping, will retry next restart")
    else:
        print("Alembic migrations: complete")


def seed_ui_labels():
    """Insert default navigation labels if they don't exist yet."""
    from sqlalchemy import text
    _defaults = [
        # Section headers
        ('section.inventory', 'Inventory', 'section'),
        ('section.purchasing', 'Purchasing', 'section'),
        ('section.sales', 'Sales', 'section'),
        ('section.delivery', 'Delivery', 'section'),
        ('section.finance', 'Finance', 'section'),
        ('section.admin', 'Admin', 'section'),
        # Dashboard
        ('nav.dashboard', 'Dashboard', 'navigation'),
        # Inventory
        ('nav.products', 'Products', 'navigation'),
        ('nav.stock-receipt', 'Stock Receipt', 'navigation'),
        ('nav.stock-levels', 'Stock Levels', 'navigation'),
        ('nav.stock-take', 'Stock Take', 'navigation'),
        ('nav.stock-issue', 'Stock Issue', 'navigation'),
        ('nav.stock-alerts', 'Stock Alerts', 'navigation'),
        ('nav.damage-items', 'Damage Items', 'navigation'),
        ('nav.stock-log', 'Stock Log', 'navigation'),
        ('nav.categories', 'Categories', 'navigation'),
        ('nav.expiry-tracker', 'Expiry Tracker', 'navigation'),
        ('nav.fifo-manager', 'FIFO Manager', 'navigation'),
        ('nav.barcode-scanner', 'Barcode Scanner', 'navigation'),
        ('nav.barcode-labels', 'Barcode Labels', 'navigation'),
        ('nav.warehouses', 'Warehouses', 'navigation'),
        ('nav.inventory-dashboard', 'Overview', 'navigation'),
        # Purchasing
        ('nav.suppliers', 'Suppliers', 'navigation'),
        ('nav.purchase-orders', 'Purchase Orders', 'navigation'),
        ('nav.purchase-invoices', 'PO Invoices', 'navigation'),
        ('nav.landed-costs', 'Landed Costs', 'navigation'),
        ('nav.purchase-returns', 'Purchase Returns', 'navigation'),
        ('nav.bills', 'Bills', 'navigation'),
        ('nav.approval-queue', 'Approval Queue', 'navigation'),
        ('nav.supplier-price-lists', 'Supplier Price Lists', 'navigation'),
        # Sales
        ('nav.customers', 'Customers', 'navigation'),
        ('nav.estimates', 'Estimates', 'navigation'),
        ('nav.sales-orders', 'Sales Orders', 'navigation'),
        ('nav.sales-invoices', 'Invoices', 'navigation'),
        ('nav.pricing-rules', 'Pricing Rules', 'navigation'),
        ('nav.deliveries', 'Deliveries', 'navigation'),
        ('nav.returns-manager', 'Returns', 'navigation'),
        ('nav.collections', 'Collections & Aging', 'navigation'),
        # Delivery
        ('nav.van-load-sheet', 'Van Load Sheet', 'navigation'),
        ('nav.van-sales', 'Van Sales', 'navigation'),
        ('nav.van-sales-entry', 'Van Sales Entry', 'navigation'),
        ('nav.driver-due-summary', 'Driver Due Summary', 'navigation'),
        ('nav.driver-settlement', 'Driver Settlement', 'navigation'),
        ('nav.driver-dashboard', 'Driver Dashboard', 'navigation'),
        ('nav.driver-app', 'Driver App', 'navigation'),
        ('nav.route-optimizer', 'Route Optimizer', 'navigation'),
        ('nav.driver-performance', 'Driver Performance', 'navigation'),
        # Inventory (Phase 52)
        ('nav.warehouse-transfer', 'Warehouse Transfer', 'navigation'),
        # Finance
        ('nav.financial', 'Financial Dashboard', 'navigation'),
        ('nav.chart-of-accounts', 'Chart of Accounts', 'navigation'),
        ('nav.bank-accounts', 'Bank Accounts', 'navigation'),
        ('nav.money-transfer', 'Money Transfer', 'navigation'),
        ('nav.journal-entries', 'Journal Entries', 'navigation'),
        ('nav.cash-transactions', 'Cash Transactions', 'navigation'),
        ('nav.multi-currency', 'Multi-Currency', 'navigation'),
        ('nav.reports', 'Reports', 'navigation'),
        ('nav.balance-sheet', 'Balance Sheet', 'navigation'),
        ('nav.profit-loss', 'Profit & Loss', 'navigation'),
        ('nav.trial-balance', 'Trial Balance', 'navigation'),
        ('nav.cash-flow', 'Cash Flow', 'navigation'),
        ('nav.general-ledger', 'General Ledger', 'navigation'),
        ('nav.vendor-ledger', 'Vendor Ledger', 'navigation'),
        ('nav.all-sales-report', 'All Sales Report', 'navigation'),
        ('nav.customer-sales-summary', 'Customer Summary', 'navigation'),
        ('nav.product-sales', 'Product Sales', 'navigation'),
        ('nav.all-purchases-report', 'All Purchases', 'navigation'),
        ('nav.expense-breakdown', 'Expense Breakdown', 'navigation'),
        ('nav.sales-tax', 'Sales Tax', 'navigation'),
        ('nav.vat-return', 'VAT Return', 'navigation'),
        ('nav.fawtara-dashboard', 'Fawtara E-Invoicing', 'navigation'),
        ('nav.bank-recon', 'Bank Reconciliation', 'navigation'),
        ('nav.advance-payments', 'Advance Payments', 'navigation'),
        # Admin
        ('nav.users', 'Users', 'navigation'),
        ('nav.settings', 'Settings', 'navigation'),
        ('nav.settings-lookup', 'Lookup Tables', 'navigation'),
        ('nav.product-brands', 'Product Brands', 'navigation'),
        ('nav.variations', 'Variations', 'navigation'),
        ('nav.notifications', 'Notifications', 'navigation'),
        ('nav.messaging', 'Messaging', 'navigation'),
        ('nav.deleted-items', 'Deleted Items', 'navigation'),
        ('nav.admin-master-panel', 'Master Control', 'navigation'),
        ('nav.label-editor', 'Label Editor', 'navigation'),
    ]
    with engine.connect() as conn:
        for key, default_val, group in _defaults:
            conn.execute(text(
                "INSERT INTO ui_labels (label_key, default_label, section) "
                "VALUES (:key, :val, :grp) "
                "ON CONFLICT (label_key) DO NOTHING"
            ), {"key": key, "val": default_val, "grp": group})
        conn.commit()


@app.on_event("startup")
async def startup_event():
    print(f"Starting {settings.APP_NAME} v5.3")
    # Run Alembic migrations before anything else
    try:
        run_migrations()
    except Exception as e:
        print(f"Alembic migration warning (non-fatal): {e}")
    print("STARTUP: Alembic done, starting column migrations...")
    # Rename ui_labels columns if they have old names (label_value→default_label etc.)
    from sqlalchemy import text as _text, inspect as _inspect
    try:
        with engine.connect() as conn:
            insp = _inspect(engine)
            if 'ui_labels' in insp.get_table_names():
                cols = [c['name'] for c in insp.get_columns('ui_labels')]
                if 'label_value' in cols and 'default_label' not in cols:
                    conn.execute(_text("ALTER TABLE ui_labels RENAME COLUMN label_value TO default_label"))
                    conn.commit()
                if 'default_value' in cols and 'custom_label' not in cols:
                    conn.execute(_text("ALTER TABLE ui_labels RENAME COLUMN default_value TO custom_label"))
                    conn.commit()
                if 'group_name' in cols and 'section' not in cols:
                    conn.execute(_text("ALTER TABLE ui_labels RENAME COLUMN group_name TO section"))
                    conn.commit()
    except Exception as e:
        print(f"UI labels column rename warning: {e}")
    print("STARTUP: UI labels columns verified")
    # Seed default UI labels
    try:
        seed_ui_labels()
    except Exception as e:
        print(f"UI labels seed warning: {e}")
    print("STARTUP: UI labels seeded")
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
    print("STARTUP: Starting create_all...")
    Base.metadata.create_all(bind=engine, checkfirst=True)
    print("STARTUP: create_all done")
    # ── Auto-migration: add missing columns to existing tables ──
    _migrations = [
        ("products", "is_deleted", "BOOLEAN DEFAULT FALSE"),
        ("products", "deleted_at", "TIMESTAMP"),
        ("products", "deleted_by", "INTEGER"),
        ("products", "deleted_reason", "TEXT"),
        ("purchase_orders", "received_date", "DATE"),
        ("purchase_orders", "container_reference", "VARCHAR(100)"),
        ("purchase_orders", "freight_cost", "NUMERIC(10,3) DEFAULT 0"),
        ("purchase_orders", "customs_duty", "NUMERIC(10,3) DEFAULT 0"),
        ("purchase_orders", "handling_cost", "NUMERIC(10,3) DEFAULT 0"),
        ("purchase_orders", "insurance_cost", "NUMERIC(10,3) DEFAULT 0"),
        ("purchase_orders", "local_transport_cost", "NUMERIC(10,3) DEFAULT 0"),
        ("purchase_orders", "currency", "VARCHAR(3) DEFAULT 'OMR'"),
        ("purchase_orders", "exchange_rate", "NUMERIC(10,6) DEFAULT 1.0"),
        ("purchase_order_items", "batch_number", "VARCHAR(100)"),
        ("purchase_order_items", "expiry_date", "DATE"),
        ("purchase_order_items", "notes", "TEXT"),
        ("deliveries", "customer_name", "VARCHAR(200)"),
        ("deliveries", "delivery_notes", "TEXT"),
        ("deliveries", "items_delivered", "TEXT"),
        ("deliveries", "pod_photo_base64", "TEXT"),
        ("deliveries", "pod_captured_at", "DATETIME"),
        ("deliveries", "route_area", "VARCHAR(100)"),
        # Phase 37: User fields for roles & permissions
        ("users", "profile_picture", "TEXT"),
        ("users", "default_warehouse_id", "INTEGER"),
        ("users", "warehouse_group", "TEXT DEFAULT ''"),
        ("users", "last_active_at", "TIMESTAMP"),
        ("users", "login_count", "INTEGER DEFAULT 0"),
        # Products: avg_cost and stock_quantity
        ("products", "avg_cost", "NUMERIC(12,3) DEFAULT 0"),
        ("products", "stock_quantity", "NUMERIC(12,3) DEFAULT 0"),
        # Phase 41: Fawtara e-invoicing fields
        ("sales_invoices", "fawtara_status", "TEXT DEFAULT 'pending'"),
        ("sales_invoices", "fawtara_uuid", "TEXT"),
        ("sales_invoices", "fawtara_submitted_at", "TEXT"),
        ("sales_invoices", "fawtara_response", "TEXT"),
        ("sales_invoices", "qr_code_data", "TEXT"),
        ("sales_invoices", "buyer_vat_number", "TEXT"),
        ("sales_invoices", "invoice_type", "TEXT DEFAULT 'standard'"),
        # Phase 42: Stock alerts — product reorder fields
        ("products", "auto_reorder", "INTEGER DEFAULT 1"),
        ("products", "preferred_supplier_id", "INTEGER"),
        ("products", "reorder_quantity", "NUMERIC(12,3) DEFAULT 0"),
        # Phase 44: Van warehouse assignment for drivers
        ("users", "van_warehouse_id", "INTEGER"),
        # Phase 47: Data safety
        ("users", "must_change_password", "BOOLEAN DEFAULT false"),
        # Phase 46: Fawtara hash chain and XML archive
        ("sales_invoices", "fawtara_xml", "TEXT"),
        ("sales_invoices", "invoice_hash", "TEXT"),
        ("sales_invoices", "previous_invoice_hash", "TEXT"),
        # Phase 50: Approval fields on purchase_orders
        ("purchase_orders", "approval_status", "TEXT DEFAULT 'not_required'"),
        ("purchase_orders", "approved_by", "INTEGER"),
        ("purchase_orders", "approved_at", "TIMESTAMP"),
        ("purchase_orders", "approval_notes", "TEXT"),
        # Phase 51: Product images
        ("products", "image_url", "TEXT"),
        # Phase 52: Route territory
        ("users", "route_area", "TEXT"),
    ]
    print("STARTUP: Starting column migrations loop...")
    with engine.connect() as conn:
        for table, col, col_type in _migrations:
            try:
                conn.execute(text(f"SELECT {col} FROM {table} LIMIT 1"))
            except Exception:
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                    conn.commit()
                    print(f"  MIGRATED: {table}.{col}")
                except Exception:
                    conn.rollback()
    print("STARTUP: Column migrations done")
    # ── Phase 37: Seed system roles ──
    print("STARTUP: Starting role seeding...")
    _system_roles = [
        ("ADMIN", "Administrator", "Full system access", "system"),
        ("WAREHOUSE_MANAGER", "Warehouse Manager", "Manage inventory, purchasing, and warehouse operations", "system"),
        ("WAREHOUSE_STAFF", "Warehouse Staff", "Basic inventory and stock operations", "system"),
        ("SALES_STAFF", "Sales Staff", "Sales orders, customers, and invoicing", "system"),
        ("DELIVERY_DRIVER", "Delivery Driver", "Delivery management and driver app", "system"),
        ("ACCOUNTANT", "Accountant", "Financial reports, invoices, and accounting", "system"),
    ]
    try:
        with engine.connect() as conn:
            for role_name, display, desc, rtype in _system_roles:
                try:
                    result = conn.execute(text("SELECT id FROM roles WHERE name = :name"), {"name": role_name})
                    if not result.fetchone():
                        conn.execute(text(
                            "INSERT INTO roles (name, display_name, description, role_type, permissions_json, is_active) "
                            "VALUES (:name, :display, :desc, :rtype, :perms, 1)"
                        ), {"name": role_name, "display": display, "desc": desc, "rtype": rtype, "perms": "{}"})
                        conn.commit()
                except Exception:
                    conn.rollback()
    except Exception as e:
        print(f"STARTUP: Role seeding error: {e}")
    print("STARTUP: Roles seeded")

    # Seed van warehouses (INSERT only — tables created by Alembic/create_all)
    try:
        with engine.connect() as conn:
            mw = conn.execute(text("SELECT id FROM warehouses WHERE code = 'WH-01'")).fetchone()
            if not mw:
                conn.execute(text("INSERT INTO warehouses (code, name, location_type, is_active) VALUES ('WH-01', 'Main Warehouse', 'main', true)"))
                conn.commit()
            main_id = conn.execute(text("SELECT id FROM warehouses WHERE code = 'WH-01'")).fetchone()
            pid = main_id[0] if main_id else None
            for code, name in [("VAN-MANIK", "Van — Manik"), ("VAN-ARIF", "Van — Arif"), ("VAN-ARAFAT", "Van — Arafat")]:
                exists = conn.execute(text("SELECT id FROM warehouses WHERE code = :c"), {"c": code}).fetchone()
                if not exists:
                    conn.execute(text("INSERT INTO warehouses (code, name, location_type, parent_id, is_active) VALUES (:c, :n, 'van', :p, true)"), {"c": code, "n": name, "p": pid})
                    conn.commit()
        print("Van warehouses: OK")
    except Exception as e:
        print(f"Van warehouses warning: {e}")

    # Seed default approval rules
    try:
        with engine.connect() as conn:
            exists = conn.execute(text("SELECT id FROM approval_rules LIMIT 1")).fetchone()
            if not exists:
                conn.execute(text("INSERT INTO approval_rules (rule_name, entity_type, condition_field, condition_operator, condition_value, approver_role) VALUES ('PO above 500 OMR', 'purchase_order', 'total_amount', '>', 500, 'ADMIN')"))
                conn.commit()
        print("Approval rules: OK")
    except Exception as e:
        print(f"Approval rules warning: {e}")

    # Fix any lowercase enum values in inventory_transactions
    print("STARTUP: Starting enum fix...")
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE inventory_transactions SET transaction_type = UPPER(transaction_type) WHERE transaction_type != UPPER(transaction_type)"))
            conn.commit()
    except Exception as e:
        print(f"STARTUP: enum fix error: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
    print("STARTUP: Enum fix done")
    print("STARTUP: All startup tasks complete")
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
    print("  Warehouses module loaded")
except ImportError as e:
    print(f"  Warehouses module: {e}")

# ── Phase 2: Purchasing ──
try:
    from app.api.suppliers import router as suppliers_router
    from app.api.purchases import router as purchases_router
    app.include_router(suppliers_router, prefix="/api/suppliers", tags=["Suppliers"])
    app.include_router(purchases_router, prefix="/api/purchases", tags=["Purchases"])
    print("  Purchasing module loaded")
except ImportError as e:
    print(f"  Purchasing module: {e}")

# ── Phase 3: Sales ──
try:
    from app.api.customers import router as customers_router
    from app.api.sales import router as sales_router
    app.include_router(customers_router, prefix="/api/customers", tags=["Customers"])
    app.include_router(sales_router, prefix="/api/sales", tags=["Sales"])
    print("  Sales module loaded")
except ImportError as e:
    print(f"  Sales module: {e}")

# ── Estimates ──
try:
    from app.api.estimates import router as estimates_router
    app.include_router(estimates_router, prefix="/api/estimates", tags=["Estimates"])
    print("  Estimates module loaded")
except ImportError as e:
    print(f"  Estimates module: {e}")

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

# ── Phase 36: Van Sales / Route Accounting ──
try:
    from app.api.van_sales import router as van_sales_router
    app.include_router(van_sales_router, prefix="/api/van-sales", tags=["Van Sales"])
    print("  Van Sales module loaded")
except ImportError as e:
    print(f"  Van Sales module: {e}")

# ── Phase 41: Fawtara E-Invoicing ──
try:
    from app.api.fawtara import router as fawtara_router
    app.include_router(fawtara_router, prefix="/api/fawtara", tags=["Fawtara E-Invoicing"])
    print("  Fawtara E-Invoicing module loaded")
except ImportError as e:
    print(f"  Fawtara module: {e}")

# ── Phase 42: Stock Alerts & Auto-Reorder ──
try:
    from app.api.alerts import router as alerts_router
    app.include_router(alerts_router, prefix="/api/alerts", tags=["Stock Alerts"])
    print("  Stock Alerts module loaded")
except ImportError as e:
    print(f"  Stock Alerts module: {e}")

# ── Phase 43: Customer Collections & Aging ──
try:
    from app.api.collections import router as collections_router
    app.include_router(collections_router, prefix="/api/collections", tags=["Collections"])
    print("  Collections module loaded")
except ImportError as e:
    print(f"  Collections module: {e}")

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