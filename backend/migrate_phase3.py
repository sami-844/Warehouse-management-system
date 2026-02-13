"""Phase 3 Migration — Add sales tables and columns"""
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

print("Phase 3 Migration — Sales Module")

# Add columns to sales_orders
for col, typ, default in [
    ("driver_id", "INTEGER", None),
    ("driver_name", "VARCHAR(100)", None),
    ("vehicle", "VARCHAR(50)", None),
    ("route_area", "VARCHAR(100)", None),
    ("invoice_id", "INTEGER", None),
    ("discount_type", "VARCHAR(20)", "'none'"),
]:
    if not col_exists("sales_orders", col):
        default_clause = f" DEFAULT {default}" if default else ""
        c.execute(f'ALTER TABLE sales_orders ADD COLUMN {col} {typ}{default_clause}')
        print(f"  Added sales_orders.{col}")

# Add columns to sales_order_items
for col, typ, default in [
    ("batch_number", "VARCHAR(100)", None),
    ("notes", "TEXT", None),
]:
    if not col_exists("sales_order_items", col):
        default_clause = f" DEFAULT {default}" if default else ""
        c.execute(f'ALTER TABLE sales_order_items ADD COLUMN {col} {typ}{default_clause}')
        print(f"  Added sales_order_items.{col}")

# Add columns to deliveries
for col, typ, default in [
    ("route_area", "VARCHAR(100)", None),
    ("delivery_notes", "TEXT", None),
    ("items_delivered", "TEXT", None),
    ("customer_name", "VARCHAR(200)", None),
]:
    if not col_exists("deliveries", col):
        default_clause = f" DEFAULT {default}" if default else ""
        c.execute(f'ALTER TABLE deliveries ADD COLUMN {col} {typ}{default_clause}')
        print(f"  Added deliveries.{col}")

# Create sales_invoices
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

# Create payments table (if not exists from Phase 2)
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

# Create pricing_rules
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
print("\nPhase 3 migration complete!")
