"""approval rules and supplier price lists

Revision ID: d5a2b7c93e10
Revises: c8e3f1a52d90
Create Date: 2026-03-18

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd5a2b7c93e10'
down_revision = 'c8e3f1a52d90'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import text
    from app.core.database import engine

    with engine.connect() as conn:
        # approval_rules table
        try:
            conn.execute(text("SELECT 1 FROM approval_rules LIMIT 1"))
        except Exception:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS approval_rules (
                    id SERIAL PRIMARY KEY,
                    rule_name VARCHAR(100) NOT NULL,
                    entity_type VARCHAR(50) NOT NULL DEFAULT 'purchase_order',
                    condition_field VARCHAR(50) NOT NULL,
                    condition_operator VARCHAR(10) NOT NULL DEFAULT '>',
                    condition_value NUMERIC(12,3) NOT NULL,
                    approver_role VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
                    is_active BOOLEAN DEFAULT true,
                    created_by INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            conn.commit()

        # supplier_price_list table
        try:
            conn.execute(text("SELECT 1 FROM supplier_price_list LIMIT 1"))
        except Exception:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS supplier_price_list (
                    id SERIAL PRIMARY KEY,
                    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
                    product_id INTEGER NOT NULL REFERENCES products(id),
                    unit_price NUMERIC(10,3) NOT NULL,
                    currency VARCHAR(3) DEFAULT 'OMR',
                    min_order_qty NUMERIC(10,3) DEFAULT 1,
                    lead_time_days INTEGER DEFAULT 7,
                    notes TEXT,
                    is_active BOOLEAN DEFAULT true,
                    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_by INTEGER,
                    UNIQUE(supplier_id, product_id)
                )
            """))
            conn.commit()

        # approval columns on purchase_orders
        for col, coltype in [
            ("approval_status", "TEXT DEFAULT 'not_required'"),
            ("approved_by", "INTEGER"),
            ("approved_at", "TIMESTAMP"),
            ("approval_notes", "TEXT"),
        ]:
            try:
                conn.execute(text(f"SELECT {col} FROM purchase_orders LIMIT 1"))
            except Exception:
                try:
                    conn.execute(text(f"ALTER TABLE purchase_orders ADD COLUMN {col} {coltype}"))
                    conn.commit()
                except Exception:
                    conn.rollback()


def downgrade():
    pass
