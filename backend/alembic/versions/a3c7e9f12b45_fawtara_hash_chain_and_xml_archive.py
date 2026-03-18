"""fawtara hash chain and xml archive

Revision ID: a3c7e9f12b45
Revises: 64f059674bfe
Create Date: 2026-03-18

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a3c7e9f12b45'
down_revision = '64f059674bfe'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import text
    from app.core.database import engine
    cols_to_add = [
        ("sales_invoices", "fawtara_xml", "TEXT"),
        ("sales_invoices", "invoice_hash", "TEXT"),
        ("sales_invoices", "previous_invoice_hash", "TEXT"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in cols_to_add:
            try:
                conn.execute(text(f"SELECT {col} FROM {table} LIMIT 1"))
            except Exception:
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    conn.rollback()


def downgrade():
    pass
