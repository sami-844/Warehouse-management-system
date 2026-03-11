"""
Phase 27 Migration: Create cash_transactions table.
Run once: python -m migrations.add_cash_transactions
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.core.database import engine


SQL = """
CREATE TABLE IF NOT EXISTS cash_transactions (
    id              SERIAL PRIMARY KEY,
    tx_type         VARCHAR(20) NOT NULL,
    tx_date         DATE NOT NULL,
    account_code    VARCHAR(10),
    category        VARCHAR(100),
    amount          NUMERIC(14,3) NOT NULL,
    description     TEXT,
    reference       VARCHAR(200),
    journal_entry_id INTEGER,
    created_by      INTEGER,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def run():
    with engine.connect() as conn:
        conn.execute(text(SQL.strip()))
        conn.commit()
    print("Migration complete: cash_transactions table created.")


if __name__ == "__main__":
    run()
