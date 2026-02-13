"""
Database Migration Verification Script
Checks that the migration was successful
"""

import sqlite3
import os

def verify_tables(db_path):
    """Verify all expected tables exist"""
    expected_tables = [
        'users', 'categories', 'products', 'suppliers', 'customers',
        'purchase_orders', 'purchase_order_items', 'sales_orders', 
        'sales_order_items', 'stock_movements', 'stock_adjustments',
        'returns', 'return_items', 'deliveries', 'inventory_snapshots'
    ]
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    existing_tables = [row[0] for row in cursor.fetchall()]
    
    print("\n" + "=" * 60)
    print("TABLE VERIFICATION")
    print("=" * 60)
    
    missing_tables = []
    for table in expected_tables:
        if table in existing_tables:
            print(f"✓ {table}")
        else:
            print(f"✗ {table} - MISSING")
            missing_tables.append(table)
    
    conn.close()
    
    if missing_tables:
        print(f"\n⚠ Warning: {len(missing_tables)} tables are missing")
        return False
    else:
        print(f"\n✓ All {len(expected_tables)} expected tables exist!")
        return True

def verify_products_columns(db_path):
    """Verify products table has all required columns"""
    expected_columns = [
        'id', 'sku', 'name', 'description', 'category_id',
        'cost_price', 'selling_price', 'current_stock', 
        'reorder_point', 'reorder_quantity', 'safety_stock', 
        'maximum_stock', 'lead_time_days', 'unit', 
        'is_active', 'is_dead_stock', 'created_at', 
        'updated_at', 'last_stock_update'
    ]
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(products);")
    existing_columns = [row[1] for row in cursor.fetchall()]
    
    print("\n" + "=" * 60)
    print("PRODUCTS TABLE COLUMNS")
    print("=" * 60)
    
    missing_columns = []
    for col in expected_columns:
        if col in existing_columns:
            print(f"✓ {col}")
        else:
            print(f"✗ {col} - MISSING")
            missing_columns.append(col)
    
    conn.close()
    
    if missing_columns:
        print(f"\n⚠ Warning: {len(missing_columns)} columns are missing from products table")
        return False
    else:
        print(f"\n✓ All required columns exist in products table!")
        return True

def verify_indexes(db_path):
    """Verify indexes were created"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index';")
    indexes = [row[0] for row in cursor.fetchall()]
    
    print("\n" + "=" * 60)
    print("INDEXES")
    print("=" * 60)
    
    print(f"Found {len(indexes)} indexes:")
    for idx in indexes:
        if not idx.startswith('sqlite_'):  # Skip system indexes
            print(f"  - {idx}")
    
    conn.close()
    return True

def verify_views(db_path):
    """Verify views were created"""
    expected_views = [
        'v_stock_status',
        'v_sales_order_summary', 
        'v_product_movement_summary'
    ]
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='view';")
    existing_views = [row[0] for row in cursor.fetchall()]
    
    print("\n" + "=" * 60)
    print("DATABASE VIEWS")
    print("=" * 60)
    
    missing_views = []
    for view in expected_views:
        if view in existing_views:
            print(f"✓ {view}")
        else:
            print(f"✗ {view} - MISSING")
            missing_views.append(view)
    
    conn.close()
    
    if missing_views:
        print(f"\n⚠ Warning: {len(missing_views)} views are missing")
        return False
    else:
        print(f"\n✓ All views exist!")
        return True

def check_data_counts(db_path):
    """Show data counts in each table"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    
    print("\n" + "=" * 60)
    print("DATA COUNTS")
    print("=" * 60)
    
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            count = cursor.fetchone()[0]
            print(f"  {table}: {count} rows")
        except sqlite3.Error as e:
            print(f"  {table}: Error - {e}")
    
    conn.close()

def test_sample_queries(db_path):
    """Test some sample queries"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\n" + "=" * 60)
    print("SAMPLE QUERY TESTS")
    print("=" * 60)
    
    try:
        # Test 1: Select from products
        cursor.execute("SELECT COUNT(*) FROM products;")
        count = cursor.fetchone()[0]
        print(f"✓ Products query: {count} products found")
        
        # Test 2: Join products with categories
        cursor.execute("""
            SELECT p.name, c.name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            LIMIT 5;
        """)
        results = cursor.fetchall()
        print(f"✓ Products-Categories join: {len(results)} rows")
        
        # Test 3: Query stock status view
        cursor.execute("SELECT COUNT(*) FROM v_stock_status;")
        count = cursor.fetchone()[0]
        print(f"✓ Stock status view: {count} items")
        
        print("\n✓ All sample queries executed successfully!")
        return True
        
    except sqlite3.Error as e:
        print(f"✗ Query test failed: {e}")
        return False
    finally:
        conn.close()

def main():
    """Run all verification checks"""
    db_path = "warehouse.db"
    
    if not os.path.exists(db_path):
        print(f"✗ Database not found: {db_path}")
        print("Please run apply_migration.py first")
        return
    
    print("=" * 60)
    print("DATABASE MIGRATION VERIFICATION")
    print("=" * 60)
    print(f"Database: {db_path}")
    
    # Run all checks
    checks_passed = []
    
    checks_passed.append(("Tables", verify_tables(db_path)))
    checks_passed.append(("Product Columns", verify_products_columns(db_path)))
    checks_passed.append(("Indexes", verify_indexes(db_path)))
    checks_passed.append(("Views", verify_views(db_path)))
    
    check_data_counts(db_path)
    checks_passed.append(("Sample Queries", test_sample_queries(db_path)))
    
    # Final summary
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in checks_passed if result)
    total = len(checks_passed)
    
    for check_name, result in checks_passed:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {check_name}")
    
    print(f"\nResult: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n🎉 Migration verification complete - All checks passed!")
        print("\nYou can now:")
        print("1. Populate sample data: python populate_sample_data.py")
        print("2. Start building your API endpoints")
        print("3. Update your FastAPI application")
    else:
        print("\n⚠ Some checks failed. Please review the errors above.")

if __name__ == "__main__":
    main()