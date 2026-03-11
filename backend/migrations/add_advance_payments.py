"""
Phase 26 Migration: Create customer_advance_payments table.
Run once: python -m migrations.add_advance_payments
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.core.database import engine


SQL = """
CREATE TABLE IF NOT EXISTS customer_advance_payments (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    amount          NUMERIC(14,3) NOT NULL,
    payment_date    DATE NOT NULL,
    payment_method  VARCHAR(50) DEFAULT 'cash',
    reference       VARCHAR(200),
    notes           TEXT,
    amount_used     NUMERIC(14,3) DEFAULT 0,
    balance         NUMERIC(14,3) NOT NULL,
    status          VARCHAR(20) DEFAULT 'active',
    created_by      INTEGER,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def run():
    with engine.connect() as conn:
        conn.execute(text(SQL.strip()))
        conn.commit()
    print("Migration complete: customer_advance_payments table created.")


if __name__ == "__main__":
    run()
