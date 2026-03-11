"""
Phase 25 Migration: Add vendor_type column to suppliers table.
Run once: python -m migrations.add_vendor_type
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.core.database import engine


SQL = """
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS vendor_type VARCHAR(20) DEFAULT 'supplier';
"""


def run():
    with engine.connect() as conn:
        conn.execute(text(SQL.strip()))
        conn.commit()
    print("Migration complete: vendor_type column added to suppliers.")


if __name__ == "__main__":
    run()
