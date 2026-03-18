"""add driver_settlements table

Revision ID: c8e3f1a52d90
Revises: b7d4e2f89c01
Create Date: 2026-03-18

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c8e3f1a52d90'
down_revision = 'b7d4e2f89c01'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS driver_settlements (
            id SERIAL PRIMARY KEY,
            driver_id INTEGER NOT NULL REFERENCES users(id),
            settlement_date DATE NOT NULL,
            amount NUMERIC(12,3) NOT NULL,
            payment_method VARCHAR(30) DEFAULT 'cash',
            bank_reference VARCHAR(100),
            running_due_before NUMERIC(12,3) DEFAULT 0,
            running_due_after NUMERIC(12,3) DEFAULT 0,
            notes TEXT,
            settled_by INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)


def downgrade():
    pass
