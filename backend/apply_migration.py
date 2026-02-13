"""
Database Migration Script
Applies the enhanced schema to your warehouse database
"""

import sqlite3
import os
from datetime import datetime
import shutil

def backup_database(db_path):
    """Create a backup of the database before migration"""
    if os.path.exists(db_path):
        backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(db_path, backup_path)
        print(f"✓ Database backed up to: {backup_path}")
        return backup_path
    else:
        print(f"! Database not found at {db_path}, will create new one")
        return None

def apply_schema(db_path, schema_file):
    """Apply SQL schema from file to database"""
    try:
        # Read the schema file
        with open(schema_file, 'r') as f:
            schema_sql = f.read()
        
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys = ON;")
        
        # Execute the schema
        print("Applying schema...")
        cursor.executescript(schema_sql)
        
        conn.commit()
        print("✓ Schema applied successfully!")
        
        # Verify tables were created
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"\n✓ Created {len(tables)} tables:")
        for table in tables:
            print(f"  - {table[0]}")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"✗ Error applying schema: {e}")
        return False
    except FileNotFoundError:
        print(f"✗ Schema file not found: {schema_file}")
        return False

def check_existing_data(db_path):
    """Check what data exists in the database"""
    if not os.path.exists(db_path):
        return None
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        if not tables:
            print("Database is empty (no tables)")
            return None
        
        print(f"\nCurrent database has {len(tables)} tables:")
        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            print(f"  - {table_name}: {count} rows")
        
        conn.close()
        return tables
        
    except sqlite3.Error as e:
        print(f"Error checking existing data: {e}")
        conn.close()
        return None

def migrate_existing_data(db_path):
    """Migrate data from old schema to new schema"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if we need to add new columns to existing products table
        cursor.execute("PRAGMA table_info(products);")
        columns = [col[1] for col in cursor.fetchall()]
        
        new_columns = {
            'cost_price': 'DECIMAL(10, 2) DEFAULT 0',
            'selling_price': 'DECIMAL(10, 2) DEFAULT 0',
            'reorder_point': 'INTEGER DEFAULT 0',
            'reorder_quantity': 'INTEGER DEFAULT 0',
            'safety_stock': 'INTEGER DEFAULT 0',
            'maximum_stock': 'INTEGER DEFAULT 0',
            'lead_time_days': 'INTEGER DEFAULT 7',
            'unit': "VARCHAR(20) DEFAULT 'pcs'",
            'is_dead_stock': 'BOOLEAN DEFAULT FALSE',
            'last_stock_update': 'TIMESTAMP',
            'current_stock': 'INTEGER DEFAULT 0'
        }
        
        print("\nAdding new columns to products table...")
        for col_name, col_def in new_columns.items():
            if col_name not in columns:
                try:
                    cursor.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_def};")
                    print(f"  ✓ Added column: {col_name}")
                except sqlite3.OperationalError as e:
                    if 'duplicate column' in str(e).lower():
                        print(f"  - Column already exists: {col_name}")
                    else:
                        raise
        
        conn.commit()
        print("✓ Products table migration complete!")
        
    except sqlite3.Error as e:
        print(f"✗ Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

def main():
    """Main migration function"""
    print("=" * 60)
    print("WAREHOUSE DATABASE MIGRATION")
    print("=" * 60)
    
    # Configuration
    db_path = "warehouse.db"  # Your database file
    schema_file = "database_schema.sql"  # The schema file
    
    # Check if schema file exists in current directory
    if not os.path.exists(schema_file):
        print(f"\n✗ Schema file not found: {schema_file}")
        print("Please make sure database_schema.sql is in the same directory as this script")
        return
    
    # Check existing data
    print("\nChecking existing database...")
    existing_tables = check_existing_data(db_path)
    
    if existing_tables:
        # Database exists with data
        print("\n" + "=" * 60)
        print("MIGRATION MODE: Extending existing database")
        print("=" * 60)
        
        response = input("\nDo you want to proceed with migration? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("Migration cancelled.")
            return
        
        # Backup first
        backup_database(db_path)
        
        # Migrate existing data
        migrate_existing_data(db_path)
        
        # Apply new tables (will skip existing ones)
        print("\nCreating new tables...")
        apply_schema(db_path, schema_file)
        
    else:
        # Fresh installation
        print("\n" + "=" * 60)
        print("FRESH INSTALLATION MODE: Creating new database")
        print("=" * 60)
        
        # Backup if file exists
        if os.path.exists(db_path):
            backup_database(db_path)
        
        # Apply full schema
        apply_schema(db_path, schema_file)
    
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Verify the migration worked: python verify_migration.py")
    print("2. Populate initial data (suppliers, customers, etc.)")
    print("3. Update your FastAPI models")
    print("4. Test your application")

if __name__ == "__main__":
    main()