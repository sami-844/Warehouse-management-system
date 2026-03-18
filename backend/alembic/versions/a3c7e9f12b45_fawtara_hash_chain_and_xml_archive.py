"""fawtara hash chain and xml archive

Revision ID: a3c7e9f12b45
Revises: 64f059674bfe
Create Date: 2026-03-18

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a3c7e9f12b45'
down_revision = '64f059674bfe'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS fawtara_xml TEXT")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS invoice_hash TEXT")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS previous_invoice_hash TEXT")


def downgrade():
    pass
