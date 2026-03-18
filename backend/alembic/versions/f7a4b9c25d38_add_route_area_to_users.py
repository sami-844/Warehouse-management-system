"""add route_area to users

Revision ID: f7a4b9c25d38
Revises: e6f3a8b14c27
Create Date: 2026-03-18
"""
from alembic import op

revision = 'f7a4b9c25d38'
down_revision = 'e6f3a8b14c27'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS route_area TEXT")


def downgrade():
    try:
        op.drop_column('users', 'route_area')
    except Exception:
        pass
