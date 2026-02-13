"""
Phase 5b Migration — FIFO Batch Inventory + Payment tracking columns
Run ONCE after Phase 4 migration: python migrate_phase5b.py
"""
import sqlite3, os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "warehouse.db")
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()


def col_exists(table, col):
    c.execute(f'PRAGMA table_info("{table}")')
    return any(r[1] == col for r in c.fetchall())


def table_exists(name):
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return c.fetchone() is not None


print("=" * 60)
print("Phase 5b Migration — FIFO Batch Inventory")
print("=" * 60)

# ── 1. batch_inventory table ──
if not table_exists("batch_inventory"):
    c.execute("""CREATE TABLE batch_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id),
        warehouse_id INTEGER DEFAULT 1 REFERENCES warehouses(id),
        batch_number VARCHAR(100),
        quantity_received DECIMAL(10,3) NOT NULL DEFAULT 0,
        quantity_remaining DECIMAL(10,3) NOT NULL DEFAULT 0,
        cost_price DECIMAL(10,3) DEFAULT 0,
        received_date DATE NOT NULL,
        expiry_date DATE,
        supplier_id INTEGER REFERENCES suppliers(id),
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        status VARCHAR(20) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("CREATE INDEX idx_batch_product ON batch_inventory(product_id)")
    c.execute("CREATE INDEX idx_batch_expiry ON batch_inventory(expiry_date)")
    c.execute("CREATE INDEX idx_batch_status ON batch_inventory(status)")
    print("  ✅ Created batch_inventory table")

    # Seed from existing inventory_transactions if they exist
    try:
        c.execute("""
            SELECT DISTINCT it.product_id, it.warehouse_id, it.quantity, it.unit_cost,
                   it.reference_number, it.transaction_date, it.notes, p.name
            FROM inventory_transactions it
            JOIN products p ON it.product_id = p.id
            WHERE it.transaction_type = 'receipt'
            ORDER BY it.transaction_date ASC
        """)
        receipts = c.fetchall()
        seeded = 0
        for r in receipts:
            product_id, wh_id, qty, cost, ref, txn_date, notes, pname = r
            if qty and qty > 0:
                # Calculate a plausible expiry (6 months from receipt for FMCG)
                try:
                    rd = datetime.strptime(txn_date[:10], "%Y-%m-%d")
                except:
                    rd = datetime.now()
                expiry = (rd + timedelta(days=180)).strftime("%Y-%m-%d")
                batch_num = f"BATCH-{ref or ''}-{product_id}"

                c.execute("""
                    INSERT INTO batch_inventory
                    (product_id, warehouse_id, batch_number, quantity_received,
                     quantity_remaining, cost_price, received_date, expiry_date, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (product_id, wh_id or 1, batch_num, qty, qty,
                      cost or 0, txn_date[:10], expiry,
                      f"Seeded from receipt: {notes or ref or ''}"))
                seeded += 1
        print(f"  ✅ Seeded {seeded} batches from existing receipts")
    except Exception as e:
        print(f"  ⚠️  Could not seed batches (no receipts yet): {e}")
else:
    print("  ℹ️  batch_inventory already exists, skipping")

# ── 2. Add payment-tracking columns to sales_invoices if missing ──
if table_exists("sales_invoices"):
    if not col_exists("sales_invoices", "payment_date"):
        c.execute("ALTER TABLE sales_invoices ADD COLUMN payment_date DATE")
        print("  ✅ Added sales_invoices.payment_date")

# ── 3. Ensure deliveries table has driver columns ──
if table_exists("deliveries"):
    for col in [("signature_data", "TEXT"), ("driver_notes", "TEXT"),
                ("delivery_sequence", "INTEGER DEFAULT 0")]:
        if not col_exists("deliveries", col[0]):
            c.execute(f"ALTER TABLE deliveries ADD COLUMN {col[0]} {col[1]}")
            print(f"  ✅ Added deliveries.{col[0]}")

conn.commit()
conn.close()
print("\n✅ Phase 5b migration complete!")
print("   You can now restart the backend server.")
