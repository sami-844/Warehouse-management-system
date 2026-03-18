"""add product image_url

Revision ID: e6f3a8b14c27
Revises: d5a2b7c93e10
Create Date: 2026-03-18
"""
from alembic import op

revision = 'e6f3a8b14c27'
down_revision = 'd5a2b7c93e10'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT")


def downgrade():
    try:
        op.drop_column('products', 'image_url')
    except Exception:
        pass
