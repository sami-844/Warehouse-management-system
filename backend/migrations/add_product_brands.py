"""
Migration: Product Brands — Phase 31
Creates product_brands table and adds brand_id to products.
"""
from sqlalchemy import text
from app.core.database import engine


def run():
    with engine.begin() as conn:
        # Create product_brands table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS product_brands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(200) NOT NULL UNIQUE,
                status VARCHAR(10) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # Add brand_id to products (ignore if exists)
        try:
            conn.execute(text("ALTER TABLE products ADD COLUMN brand_id INTEGER REFERENCES product_brands(id)"))
        except Exception:
            pass  # column already exists

    print("  Migration: product_brands table ready")


if __name__ == "__main__":
    run()
