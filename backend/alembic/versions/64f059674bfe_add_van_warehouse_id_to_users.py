"""add van_warehouse_id to users

Revision ID: 64f059674bfe
Revises: b119848a2abc
Create Date: 2026-03-18

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '64f059674bfe'
down_revision = 'b119848a2abc'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('van_warehouse_id', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('users', 'van_warehouse_id')
