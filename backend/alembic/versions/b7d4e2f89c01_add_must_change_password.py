"""add must_change_password to users

Revision ID: b7d4e2f89c01
Revises: a3c7e9f12b45
Create Date: 2026-03-18

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b7d4e2f89c01'
down_revision = 'a3c7e9f12b45'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import text
    from app.core.database import engine
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT must_change_password FROM users LIMIT 1"))
        except Exception:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT false"))
                conn.commit()
            except Exception:
                conn.rollback()


def downgrade():
    pass
