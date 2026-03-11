"""
Migration: Damage Items — Phase 31
Creates damage_items table for tracking damaged goods.
"""
from sqlalchemy import text
from app.core.database import engine


def run():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS damage_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                product_id INTEGER NOT NULL REFERENCES products(id),
                warehouse_id INTEGER REFERENCES warehouses(id),
                quantity NUMERIC(12, 3) NOT NULL,
                unit_cost NUMERIC(12, 3) DEFAULT 0,
                reason TEXT,
                batch_number VARCHAR(100),
                recorded_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

    print("  Migration: damage_items table ready")


if __name__ == "__main__":
    run()
