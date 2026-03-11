"""
Phase 5c Migration — Returns/Credits + Notification Log
Run ONCE after Phase 5b: python migrate_phase5c.py
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "warehouse.db")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()


def table_exists(name):
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return c.fetchone() is not None


def col_exists(table, col):
    c.execute(f'PRAGMA table_info("{table}")')
    return any(r[1] == col for r in c.fetchall())


print("=" * 60)
print("Phase 5c Migration — Returns, Credits, Notifications")
print("=" * 60)

# ── 1. returns table ──
if not table_exists("returns"):
    c.execute("""CREATE TABLE returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number VARCHAR(50) UNIQUE NOT NULL,
        sales_order_id INTEGER REFERENCES sales_orders(id),
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        return_date DATE NOT NULL,
        return_type VARCHAR(20) DEFAULT 'refund',
        reason VARCHAR(200),
        status VARCHAR(20) DEFAULT 'pending',
        subtotal DECIMAL(10,3) DEFAULT 0,
        tax_amount DECIMAL(10,3) DEFAULT 0,
        total_amount DECIMAL(10,3) DEFAULT 0,
        notes TEXT,
        processed_by INTEGER,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("CREATE INDEX idx_returns_customer ON returns(customer_id)")
    c.execute("CREATE INDEX idx_returns_status ON returns(status)")
    c.execute("CREATE INDEX idx_returns_date ON returns(return_date)")
    print("  ✅ Created returns table")
else:
    print("  ℹ️  returns table already exists")

# ── 2. return_items table ──
if not table_exists("return_items"):
    c.execute("""CREATE TABLE return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
        unit_price DECIMAL(10,3) DEFAULT 0,
        reason VARCHAR(100),
        condition VARCHAR(20) DEFAULT 'good',
        restock BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("CREATE INDEX idx_return_items_return ON return_items(return_id)")
    print("  ✅ Created return_items table")
else:
    print("  ℹ️  return_items table already exists")

# ── 3. credit_notes table ──
if not table_exists("credit_notes"):
    c.execute("""CREATE TABLE credit_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        credit_note_number VARCHAR(50) UNIQUE NOT NULL,
        return_id INTEGER REFERENCES returns(id),
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        issue_date DATE NOT NULL,
        amount DECIMAL(10,3) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(10,3) DEFAULT 0,
        total_amount DECIMAL(10,3) NOT NULL DEFAULT 0,
        status VARCHAR(20) DEFAULT 'issued',
        applied_to_invoice_id INTEGER REFERENCES sales_invoices(id),
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("CREATE INDEX idx_credit_notes_customer ON credit_notes(customer_id)")
    print("  ✅ Created credit_notes table")
else:
    print("  ℹ️  credit_notes table already exists")

# ── 4. notification_log table ──
if not table_exists("notification_log"):
    c.execute("""CREATE TABLE notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_type VARCHAR(50) NOT NULL,
        recipient_email VARCHAR(200),
        subject VARCHAR(200),
        body TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        related_entity_type VARCHAR(50),
        related_entity_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
    )""")
    c.execute("CREATE INDEX idx_notif_type ON notification_log(notification_type)")
    c.execute("CREATE INDEX idx_notif_status ON notification_log(status)")
    print("  ✅ Created notification_log table")
else:
    print("  ℹ️  notification_log table already exists")

# ── 5. notification_settings table ──
if not table_exists("notification_settings"):
    c.execute("""CREATE TABLE notification_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    defaults = [
        ('smtp_host', 'smtp.gmail.com'),
        ('smtp_port', '587'),
        ('smtp_username', ''),
        ('smtp_password', ''),
        ('smtp_from_email', ''),
        ('smtp_from_name', 'AK Al Mumayza Trading'),
        ('notify_low_stock', 'true'),
        ('notify_overdue_payments', 'true'),
        ('notify_expiring_stock', 'true'),
        ('notify_new_orders', 'false'),
        ('low_stock_recipients', ''),
        ('payment_recipients', ''),
        ('expiry_recipients', ''),
        ('order_recipients', ''),
    ]
    for key, val in defaults:
        c.execute("INSERT OR IGNORE INTO notification_settings (setting_key, setting_value) VALUES (?,?)", (key, val))
    print("  ✅ Created notification_settings table with defaults")
else:
    print("  ℹ️  notification_settings table already exists")

# ── 6. Add signature columns to deliveries ──
if table_exists("deliveries"):
    if not col_exists("deliveries", "customer_signature"):
        c.execute("ALTER TABLE deliveries ADD COLUMN customer_signature TEXT")
        print("  ✅ Added deliveries.customer_signature")
    if not col_exists("deliveries", "driver_signature"):
        c.execute("ALTER TABLE deliveries ADD COLUMN driver_signature TEXT")
        print("  ✅ Added deliveries.driver_signature")
    if not col_exists("deliveries", "delivery_lat"):
        c.execute("ALTER TABLE deliveries ADD COLUMN delivery_lat DECIMAL(10,7)")
        c.execute("ALTER TABLE deliveries ADD COLUMN delivery_lng DECIMAL(10,7)")
        print("  ✅ Added deliveries.delivery_lat/lng")
    if not col_exists("deliveries", "completed_at"):
        c.execute("ALTER TABLE deliveries ADD COLUMN completed_at TIMESTAMP")
        print("  ✅ Added deliveries.completed_at")

conn.commit()
conn.close()
print("\n✅ Phase 5c migration complete!")
