"""
Phase 25 Migration: Create bills table for expense/service invoices.
Run once: python -m migrations.add_bills
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.core.database import engine


SQL = """
CREATE TABLE IF NOT EXISTS bills (
    id              SERIAL PRIMARY KEY,
    bill_number     VARCHAR(50) UNIQUE NOT NULL,
    bill_date       DATE NOT NULL,
    due_date        DATE,
    vendor_id       INTEGER REFERENCES suppliers(id),
    vendor_name     VARCHAR(200),
    expense_account VARCHAR(10),
    description     TEXT,
    amount          NUMERIC(14,3) DEFAULT 0,
    tax_amount      NUMERIC(14,3) DEFAULT 0,
    total_amount    NUMERIC(14,3) DEFAULT 0,
    amount_paid     NUMERIC(14,3) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'unpaid',
    payment_method  VARCHAR(50),
    notes           TEXT,
    created_by      INTEGER,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
"""


def run():
    with engine.connect() as conn:
        for stmt in SQL.strip().split(';'):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
        conn.commit()
    print("Migration complete: bills table created.")


if __name__ == "__main__":
    run()
