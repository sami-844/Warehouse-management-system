"""
Comprehensive Table Fix Script
Adds all missing columns to all tables that need them
"""

import sqlite3

def fix_all_tables():
    """Fix all tables by adding missing columns"""
    
    db_path = "warehouse.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Checking and fixing all tables...\n")
        
        # Fix 1: Products table
        print("1. Checking products table...")
        cursor.execute("PRAGMA table_info(products)")
        product_columns = [col[1] for col in cursor.fetchall()]
        
        products_to_add = {
            'cost_price': 'DECIMAL(10, 2) DEFAULT 0',
            'selling_price': 'DECIMAL(10, 2) DEFAULT 0',
            'current_stock': 'INTEGER DEFAULT 0',
            'reorder_point': 'INTEGER DEFAULT 0',
            'reorder_quantity': 'INTEGER DEFAULT 0',
            'safety_stock': 'INTEGER DEFAULT 0',
            'maximum_stock': 'INTEGER DEFAULT 0',
            'lead_time_days': 'INTEGER DEFAULT 7',
            'unit': "VARCHAR(20) DEFAULT 'pcs'",
            'is_dead_stock': 'BOOLEAN DEFAULT FALSE',
            'last_stock_update': 'TIMESTAMP'
        }
        
        added_count = 0
        for col_name, col_def in products_to_add.items():
            if col_name not in product_columns:
                try:
                    cursor.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_def}")
                    print(f"   ✓ Added: {col_name}")
                    added_count += 1
                except sqlite3.OperationalError:
                    pass
        
        if added_count == 0:
            print("   ✓ All columns exist")
        
        # Fix 2: Suppliers table
        print("\n2. Checking suppliers table...")
        cursor.execute("PRAGMA table_info(suppliers)")
        supplier_columns = [col[1] for col in cursor.fetchall()]
        
        suppliers_to_add = {
            'contact_person': 'VARCHAR(100)',
            'email': 'VARCHAR(100)',
            'phone': 'VARCHAR(20)',
            'address': 'TEXT',
            'payment_terms': 'VARCHAR(100)',
            'average_lead_time': 'INTEGER DEFAULT 7',
            'is_active': 'BOOLEAN DEFAULT TRUE',
            'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        }
        
        added_count = 0
        for col_name, col_def in suppliers_to_add.items():
            if col_name not in supplier_columns:
                try:
                    cursor.execute(f"ALTER TABLE suppliers ADD COLUMN {col_name} {col_def}")
                    print(f"   ✓ Added: {col_name}")
                    added_count += 1
                except sqlite3.OperationalError:
                    pass
        
        if added_count == 0:
            print("   ✓ All columns exist")
        
        # Fix 3: Customers table
        print("\n3. Checking customers table...")
        cursor.execute("PRAGMA table_info(customers)")
        customer_columns = [col[1] for col in cursor.fetchall()]
        
        customers_to_add = {
            'business_name': 'VARCHAR(200)',
            'contact_person': 'VARCHAR(100)',
            'email': 'VARCHAR(100)',
            'phone': 'VARCHAR(20)',
            'address': 'TEXT',
            'customer_type': "VARCHAR(50) DEFAULT 'retail'",
            'credit_limit': 'DECIMAL(10, 2) DEFAULT 0',
            'payment_terms': 'VARCHAR(100)',
            'is_active': 'BOOLEAN DEFAULT TRUE',
            'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        }
        
        added_count = 0
        for col_name, col_def in customers_to_add.items():
            if col_name not in customer_columns:
                try:
                    cursor.execute(f"ALTER TABLE customers ADD COLUMN {col_name} {col_def}")
                    print(f"   ✓ Added: {col_name}")
                    added_count += 1
                except sqlite3.OperationalError:
                    pass
        
        if added_count == 0:
            print("   ✓ All columns exist")
        
        # Fix 4: Warehouses table (if it exists)
        print("\n4. Checking warehouses table...")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='warehouses'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(warehouses)")
            warehouse_columns = [col[1] for col in cursor.fetchall()]
            
            warehouses_to_add = {
                'address': 'TEXT',
                'manager': 'VARCHAR(100)',
                'phone': 'VARCHAR(20)',
                'is_active': 'BOOLEAN DEFAULT TRUE'
            }
            
            added_count = 0
            for col_name, col_def in warehouses_to_add.items():
                if col_name not in warehouse_columns:
                    try:
                        cursor.execute(f"ALTER TABLE warehouses ADD COLUMN {col_name} {col_def}")
                        print(f"   ✓ Added: {col_name}")
                        added_count += 1
                    except sqlite3.OperationalError:
                        pass
            
            if added_count == 0:
                print("   ✓ All columns exist")
        else:
            print("   - Table doesn't exist (OK)")
        
        conn.commit()
        conn.close()
        
        print("\n" + "=" * 60)
        print("✓ ALL TABLES FIXED!")
        print("=" * 60)
        print("\nYou can now run:")
        print("  python populate_sample_data.py")
        
    except sqlite3.Error as e:
        print(f"\n✗ Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("COMPREHENSIVE TABLE FIX")
    print("Adding all missing columns to all tables")
    print("=" * 60)
    print()
    fix_all_tables()