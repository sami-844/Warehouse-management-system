"""Add soft delete columns to products + deleted_items_log table"""
import sys
sys.path.insert(0, '/app/backend')
from sqlalchemy import text
from app.core.database import engine

def run():
    with engine.connect() as conn:
        # Add soft delete columns to products
        conn.execute(text("""
            ALTER TABLE products
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id),
                ADD COLUMN IF NOT EXISTS deleted_reason TEXT;
        """))

        # Create deleted_items_log table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS deleted_items_log (
                id SERIAL PRIMARY KEY,
                item_type VARCHAR(50) DEFAULT 'product',
                item_id INTEGER,
                item_name VARCHAR(500),
                item_sku VARCHAR(200),
                item_data TEXT,
                deleted_by_id INTEGER REFERENCES users(id),
                deleted_by_name VARCHAR(200),
                deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                deleted_reason TEXT,
                restored_at TIMESTAMP WITH TIME ZONE,
                restored_by_id INTEGER REFERENCES users(id),
                restored_by_name VARCHAR(200),
                is_restored BOOLEAN DEFAULT FALSE
            );
        """))

        conn.commit()
        print("Migration complete: soft delete columns + deleted_items_log table created")

if __name__ == "__main__":
    run()
