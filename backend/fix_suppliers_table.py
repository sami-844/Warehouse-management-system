"""
Fix Suppliers Table - Add Missing Column
"""

import sqlite3

def fix_suppliers_table():
    """Add the missing average_lead_time column to suppliers table"""
    
    db_path = "warehouse.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Checking suppliers table structure...")
        
        # Check current columns
        cursor.execute("PRAGMA table_info(suppliers)")
        columns = [col[1] for col in cursor.fetchall()]
        
        print(f"Current columns: {', '.join(columns)}")
        
        # Add missing column if it doesn't exist
        if 'average_lead_time' not in columns:
            print("\nAdding average_lead_time column...")
            cursor.execute("""
                ALTER TABLE suppliers 
                ADD COLUMN average_lead_time INTEGER DEFAULT 7
            """)
            print("✓ Column added successfully!")
        else:
            print("\n✓ Column already exists!")
        
        conn.commit()
        conn.close()
        
        print("\n✓ Suppliers table fixed!")
        print("\nYou can now run: python populate_sample_data.py")
        
    except sqlite3.Error as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("FIXING SUPPLIERS TABLE")
    print("=" * 60)
    print()
    fix_suppliers_table()