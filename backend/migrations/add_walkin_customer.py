"""
Phase 23 Migration: Insert Walk-in Customer record.
Run once: python -m migrations.add_walkin_customer
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.core.database import engine


SQL = """
INSERT INTO customers (code, name, phone, business_type, is_active, created_at)
SELECT 'WALKIN', 'Walk-in Customer', '', 'walkin', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE code = 'WALKIN');
"""


def run():
    with engine.connect() as conn:
        conn.execute(text(SQL.strip()))
        conn.commit()
    print("Migration complete: Walk-in Customer record inserted.")


if __name__ == "__main__":
    run()
