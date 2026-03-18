"""add must_change_password to users

Revision ID: b7d4e2f89c01
Revises: a3c7e9f12b45
Create Date: 2026-03-18

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b7d4e2f89c01'
down_revision = 'a3c7e9f12b45'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false")


def downgrade():
    pass
