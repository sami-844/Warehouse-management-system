"""
Phase 23 Migration: Create estimates and estimate_items tables.
Run once: python -m migrations.add_estimates
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.core.database import engine


SQL = """
CREATE TABLE IF NOT EXISTS estimates (
    id              SERIAL PRIMARY KEY,
    estimate_number VARCHAR(50) UNIQUE NOT NULL,
    estimate_date   DATE NOT NULL,
    valid_until     DATE,
    customer_id     INTEGER REFERENCES customers(id),
    po_number       VARCHAR(100),
    notes           TEXT,
    terms           TEXT,
    subtotal        NUMERIC(14,3) DEFAULT 0,
    discount_amount NUMERIC(14,3) DEFAULT 0,
    tax_amount      NUMERIC(14,3) DEFAULT 0,
    total_amount    NUMERIC(14,3) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'draft',
    created_by      INTEGER,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estimate_items (
    id          SERIAL PRIMARY KEY,
    estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    product_id  INTEGER REFERENCES products(id),
    description VARCHAR(500),
    quantity    NUMERIC(12,3) DEFAULT 1,
    unit_price  NUMERIC(12,3) DEFAULT 0,
    discount    NUMERIC(5,2) DEFAULT 0,
    tax_rate    NUMERIC(5,2) DEFAULT 0,
    line_total  NUMERIC(14,3) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON estimate_items(estimate_id);
"""


def run():
    with engine.connect() as conn:
        for stmt in SQL.strip().split(';'):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
        conn.commit()
    print("Migration complete: estimates + estimate_items tables created.")


if __name__ == "__main__":
    run()
