"""
Phase 24 Migration: Create purchase_returns, purchase_return_items, and debit_notes tables.
Run once: python -m migrations.add_purchase_returns
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.core.database import engine


SQL = """
CREATE TABLE IF NOT EXISTS purchase_returns (
    id              SERIAL PRIMARY KEY,
    return_number   VARCHAR(50) UNIQUE NOT NULL,
    return_date     DATE NOT NULL,
    purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
    supplier_id     INTEGER REFERENCES suppliers(id),
    reason          TEXT,
    subtotal        NUMERIC(14,3) DEFAULT 0,
    tax_amount      NUMERIC(14,3) DEFAULT 0,
    total_amount    NUMERIC(14,3) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'pending',
    created_by      INTEGER,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
    id              SERIAL PRIMARY KEY,
    return_id       INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id),
    quantity        NUMERIC(12,3),
    unit_price      NUMERIC(12,3),
    tax_rate        NUMERIC(5,2) DEFAULT 0,
    line_total      NUMERIC(14,3),
    condition       VARCHAR(20) DEFAULT 'good'
);

CREATE TABLE IF NOT EXISTS debit_notes (
    id              SERIAL PRIMARY KEY,
    debit_note_number VARCHAR(50) UNIQUE NOT NULL,
    return_id       INTEGER REFERENCES purchase_returns(id),
    supplier_id     INTEGER REFERENCES suppliers(id),
    issue_date      DATE,
    amount          NUMERIC(14,3),
    tax_amount      NUMERIC(14,3) DEFAULT 0,
    total_amount    NUMERIC(14,3),
    status          VARCHAR(20) DEFAULT 'issued',
    applied_to_invoice_id INTEGER REFERENCES purchase_invoices(id),
    notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_status ON purchase_returns(status);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_supplier ON debit_notes(supplier_id);
"""


def run():
    with engine.connect() as conn:
        for stmt in SQL.strip().split(';'):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
        conn.commit()
    print("Migration complete: purchase_returns + purchase_return_items + debit_notes tables created.")


if __name__ == "__main__":
    run()
