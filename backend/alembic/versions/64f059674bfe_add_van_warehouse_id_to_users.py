"""add van_warehouse_id to users

Revision ID: 64f059674bfe
Revises: b119848a2abc
Create Date: 2026-03-18

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '64f059674bfe'
down_revision = 'b119848a2abc'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS van_warehouse_id INTEGER")


def downgrade():
    pass
