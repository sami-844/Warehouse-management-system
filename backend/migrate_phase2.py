"""Phase 2 Migration — Add purchasing tables and columns"""
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

print("Phase 2 Migration — Purchasing Module")

# Add missing columns to purchase_orders
for col, typ, default in [
    ("container_reference", "VARCHAR(100)", None),
    ("freight_cost", "DECIMAL(10,3)", "0"),
    ("customs_duty", "DECIMAL(10,3)", "0"),
    ("handling_cost", "DECIMAL(10,3)", "0"),
    ("insurance_cost", "DECIMAL(10,3)", "0"),
    ("local_transport_cost", "DECIMAL(10,3)", "0"),
    ("currency", "VARCHAR(3)", "'OMR'"),
    ("exchange_rate", "DECIMAL(10,6)", "1"),
    ("received_date", "DATE", None),
]:
    if not col_exists("purchase_orders", col):
        default_clause = f" DEFAULT {default}" if default else ""
        c.execute(f'ALTER TABLE purchase_orders ADD COLUMN {col} {typ}{default_clause}')
        print(f"  Added purchase_orders.{col}")

for col, typ, default in [
    ("batch_number", "VARCHAR(100)", None),
    ("expiry_date", "DATE", None),
    ("notes", "TEXT", None),
]:
    if not col_exists("purchase_order_items", col):
        default_clause = f" DEFAULT {default}" if default else ""
        c.execute(f'ALTER TABLE purchase_order_items ADD COLUMN {col} {typ}{default_clause}')
        print(f"  Added purchase_order_items.{col}")

if not table_exists("landed_costs"):
    c.execute("""CREATE TABLE landed_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
        cost_type VARCHAR(50) NOT NULL,
        description VARCHAR(200),
        amount DECIMAL(10,3) NOT NULL DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'OMR',
        allocation_method VARCHAR(20) DEFAULT 'by_value',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    print("  Created landed_costs table")

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

if not table_exists("payments"):
    c.execute("""CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_type VARCHAR(20) NOT NULL,
        reference_type VARCHAR(30) NOT NULL,
        reference_id INTEGER NOT NULL,
        amount DECIMAL(10,3) NOT NULL,
        payment_method VARCHAR(20) DEFAULT 'bank_transfer',
        payment_date DATE NOT NULL,
        bank_reference VARCHAR(100),
        notes TEXT,
        recorded_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    print("  Created payments table")

if not table_exists("purchase_receipts"):
    c.execute("""CREATE TABLE purchase_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number VARCHAR(50) UNIQUE NOT NULL,
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        received_date DATE NOT NULL,
        quality_notes TEXT,
        notes TEXT,
        received_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    print("  Created purchase_receipts table")

if not table_exists("purchase_receipt_items"):
    c.execute("""CREATE TABLE purchase_receipt_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL REFERENCES purchase_receipts(id),
        purchase_order_item_id INTEGER NOT NULL REFERENCES purchase_order_items(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity_received DECIMAL(10,2) NOT NULL,
        batch_number VARCHAR(100),
        expiry_date DATE,
        quality_status VARCHAR(20) DEFAULT 'accepted',
        notes TEXT
    )""")
    print("  Created purchase_receipt_items table")

conn.commit()
conn.close()
print("\nPhase 2 migration complete!")
