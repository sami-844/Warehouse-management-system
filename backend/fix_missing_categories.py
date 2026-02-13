"""
Fix Missing Categories Table
Creates the categories table that was missing from the migration
"""

import sqlite3

def create_categories_table():
    """Create the missing categories table"""
    
    db_path = "warehouse.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Creating categories table...")
        
        # Create categories table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert some default categories for FMCG
        default_categories = [
            ('Drinks', 'Soft drinks, juices, water'),
            ('Cooking Oil', 'Vegetable oil, olive oil, etc.'),
            ('Rice & Grains', 'Rice, pasta, flour'),
            ('Canned Goods', 'Canned vegetables, fruits, etc.'),
            ('Snacks', 'Chips, biscuits, crackers'),
            ('Dairy Products', 'Milk, cheese, yogurt'),
            ('Cleaning Supplies', 'Detergents, soaps, cleaners')
        ]
        
        print("Adding default categories...")
        for name, description in default_categories:
            cursor.execute("""
                INSERT OR IGNORE INTO categories (name, description)
                VALUES (?, ?)
            """, (name, description))
        
        conn.commit()
        
        # Verify it worked
        cursor.execute("SELECT COUNT(*) FROM categories")
        count = cursor.fetchone()[0]
        
        print(f"✓ Categories table created successfully!")
        print(f"✓ Added {count} default categories")
        
        # Show the categories
        cursor.execute("SELECT id, name FROM categories")
        categories = cursor.fetchall()
        print("\nAvailable categories:")
        for cat_id, name in categories:
            print(f"  {cat_id}. {name}")
        
        conn.close()
        
        print("\n✓ Fix complete! Run verify_migration.py again to check.")
        
    except sqlite3.Error as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("FIXING MISSING CATEGORIES TABLE")
    print("=" * 60)
    print()
    create_categories_table()