"""Phase 4 Migration — Add admin/financial tables"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "warehouse.db")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

def col_exists(table, col):
    c.execute(f'PRAGMA table_info("{table}")')
    return any(r[1] == col for r in c.fetchall())

def table_exists(name):
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return c.fetchone() is not None

print("Phase 4 Migration — Financial & Settings")

# Activity Log
if not table_exists("activity_log"):
    c.execute("""CREATE TABLE activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username VARCHAR(50),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        description TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("CREATE INDEX idx_activity_date ON activity_log(created_at)")
    c.execute("CREATE INDEX idx_activity_user ON activity_log(user_id)")
    print("  Created activity_log table")

# Company Settings (key-value store)
if not table_exists("company_settings"):
    c.execute("""CREATE TABLE company_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type VARCHAR(20) DEFAULT 'string',
        updated_by INTEGER,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    # Insert defaults
    defaults = [
        ('company_name', 'AK Al Momaiza Trading', 'string'),
        ('company_address', 'Oman', 'string'),
        ('company_phone', '', 'string'),
        ('company_email', '', 'string'),
        ('company_cr', '', 'string'),
        ('tax_rate', '5.0', 'number'),
        ('currency', 'OMR', 'string'),
        ('invoice_prefix', 'INV', 'string'),
        ('po_prefix', 'PO', 'string'),
        ('so_prefix', 'SO', 'string'),
        ('default_payment_terms_days', '30', 'number'),
        ('low_stock_threshold', '10', 'number'),
        ('expiry_warning_days', '90', 'number'),
    ]
    for key, val, typ in defaults:
        c.execute("INSERT OR IGNORE INTO company_settings (setting_key, setting_value, setting_type) VALUES (?,?,?)", (key, val, typ))
    print("  Created company_settings table with defaults")

# Add last_login to users
if not col_exists("users", "last_login"):
    c.execute("ALTER TABLE users ADD COLUMN last_login TIMESTAMP")
    print("  Added users.last_login")

# Ensure payments table exists (Phase 2/3 may not have been installed)
if not table_exists("payments"):
    c.execute("""CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_type VARCHAR(20) NOT NULL,
        reference_type VARCHAR(30) NOT NULL,
        reference_id INTEGER NOT NULL,
        amount DECIMAL(10,3) NOT NULL,
        payment_method VARCHAR(20) DEFAULT 'cash',
        payment_date DATE NOT NULL,
        bank_reference VARCHAR(100),
        notes TEXT,
        recorded_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    print("  Created payments table")

# Ensure sales_invoices exists
if not table_exists("sales_invoices"):
    c.execute("""CREATE TABLE sales_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        sales_order_id INTEGER REFERENCES sales_orders(id),
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        subtotal DECIMAL(10,3) DEFAULT 0,
        tax_amount DECIMAL(10,3) DEFAULT 0,
        discount_amount DECIMAL(10,3) DEFAULT 0,
        total_amount DECIMAL(10,3) DEFAULT 0,
        amount_paid DECIMAL(10,3) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        currency VARCHAR(3) DEFAULT 'OMR',
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    )""")
    print("  Created sales_invoices table")

# Ensure purchase_invoices exists
if not table_exists("purchase_invoices"):
    c.execute("""CREATE TABLE purchase_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        subtotal DECIMAL(10,3) DEFAULT 0,
        tax_amount DECIMAL(10,3) DEFAULT 0,
        total_amount DECIMAL(10,3) DEFAULT 0,
        amount_paid DECIMAL(10,3) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        currency VARCHAR(3) DEFAULT 'OMR',
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    )""")
    print("  Created purchase_invoices table")

# Ensure pricing_rules exists
if not table_exists("pricing_rules"):
    c.execute("""CREATE TABLE pricing_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_name VARCHAR(100),
        product_id INTEGER REFERENCES products(id),
        customer_id INTEGER REFERENCES customers(id),
        min_quantity INTEGER DEFAULT 1,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        special_price DECIMAL(10,3),
        valid_from DATE,
        valid_to DATE,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    print("  Created pricing_rules table")

conn.commit()
conn.close()
print("\nPhase 4 migration complete!")
