"""
Migration: Variation Templates — Phase 31
Creates variation_templates, variation_values, product_variants tables.
"""
from sqlalchemy import text
from app.core.database import engine


def run():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS variation_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL UNIQUE,
                status VARCHAR(10) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS variation_values (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id INTEGER NOT NULL REFERENCES variation_templates(id),
                value VARCHAR(100) NOT NULL,
                sort_order INTEGER DEFAULT 0
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS product_variants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_product_id INTEGER NOT NULL REFERENCES products(id),
                sku VARCHAR(100),
                variation_combo TEXT,
                price_modifier NUMERIC(12, 3) DEFAULT 0,
                stock_quantity NUMERIC(12, 3) DEFAULT 0,
                barcode VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

    print("  Migration: variation tables ready")


if __name__ == "__main__":
    run()
