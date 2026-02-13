"""
Populate Sample Data - FIXED VERSION
Creates realistic test data for your warehouse system
"""

import sqlite3
from datetime import datetime, timedelta
import random

def create_sample_sales_orders(cursor):
    """Create sample sales orders"""
    print("Creating sample sales orders...")
    
    # Get all products
    cursor.execute("SELECT id, sku, selling_price, cost_price FROM products WHERE selling_price > 0 AND cost_price > 0")
    products = cursor.fetchall()
    
    if not products:
        print("   ! No products found, skipping sales orders")
        return
    
    print(f"   Found {len(products)} products")
    
    # Get all customers
    cursor.execute("SELECT id FROM customers")
    customers = [row[0] for row in cursor.fetchall()]
    
    if not customers:
        print("   ! No customers found, skipping sales orders")
        return
    
    statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']
    
    # Create 30 orders over the last 30 days
    orders_created = 0
    for i in range(30):
        try:
            order_date = datetime.now() - timedelta(days=random.randint(0, 30))
            customer_id = random.choice(customers)
            status = random.choice(statuses)
            
            # Create order
            order_number = f"SO{datetime.now().year}{(i+1):04d}"
            cursor.execute("""
                INSERT INTO sales_orders 
                (order_number, customer_id, order_date, status, 
                 is_complete, is_on_time, is_damage_free, is_accurate,
                 delivery_method, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (order_number, customer_id, order_date.strftime('%Y-%m-%d'), status,
                  status == 'delivered', status == 'delivered', True, True,
                  random.choice(['van1', 'van2']), datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
            
            order_id = cursor.lastrowid
            
            # Add 2-5 random items to order (but not more than available products)
            num_items = min(random.randint(2, 5), len(products))
            order_items = random.sample(products, num_items)
            
            order_total = 0
            for product_id, sku, selling_price, cost_price in order_items:
                quantity = random.randint(5, 20)
                total_price = float(selling_price) * quantity
                order_total += total_price
                
                cursor.execute("""
                    INSERT INTO sales_order_items 
                    (sales_order_id, product_id, quantity_ordered, quantity_shipped,
                     unit_price, unit_cost, total_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (order_id, product_id, quantity, 
                      quantity if status == 'delivered' else 0,
                      selling_price, cost_price, total_price))
            
            # Update order total
            cursor.execute("""
                UPDATE sales_orders 
                SET subtotal = ?, total_amount = ?
                WHERE id = ?
            """, (order_total, order_total, order_id))
            
            orders_created += 1
            
        except Exception as e:
            print(f"   ! Error creating order {i+1}: {e}")
            continue
    
    print(f"✓ Created {orders_created} sales orders with items")

def create_sample_stock_movements(cursor):
    """Create stock movement history"""
    print("Creating stock movements...")
    
    cursor.execute("SELECT id, current_stock, cost_price FROM products WHERE cost_price > 0")
    products = cursor.fetchall()
    
    if not products:
        print("   ! No products found, skipping stock movements")
        return
    
    movements_created = 0
    # Create initial stock receipt movements for each product
    for product_id, stock, cost in products:
        try:
            movement_date = (datetime.now() - timedelta(days=random.randint(30, 90))).strftime('%Y-%m-%d %H:%M:%S')
            
            cursor.execute("""
                INSERT INTO stock_movements 
                (product_id, movement_type, quantity, unit_cost, total_cost,
                 stock_before, stock_after, reference_type, movement_date)
                VALUES (?, 'purchase', ?, ?, ?, 0, ?, 'initial_stock', ?)
            """, (product_id, stock, cost, float(cost) * stock, stock, movement_date))
            
            movements_created += 1
            
        except Exception as e:
            print(f"   ! Error creating stock movement for product {product_id}: {e}")
            continue
    
    print(f"✓ Created stock movements for {movements_created} products")

def main():
    """Main function to populate all sample data"""
    db_path = "warehouse.db"
    
    print("=" * 60)
    print("POPULATING SAMPLE DATA")
    print("=" * 60)
    print(f"Database: {db_path}\n")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if data already exists
        cursor.execute("SELECT COUNT(*) FROM products")
        existing_products = cursor.fetchone()[0]
        
        if existing_products > 0:
            print(f"! Database already has {existing_products} products")
            response = input("Do you want to add more sample data? (yes/no): ")
            if response.lower() not in ['yes', 'y']:
                print("Cancelled.")
                return
        
        # Create sales orders
        create_sample_sales_orders(cursor)
        
        # Create stock movements
        create_sample_stock_movements(cursor)
        
        conn.commit()
        
        # Show summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        
        tables = [
            'categories', 'suppliers', 'customers', 'products', 
            'sales_orders', 'sales_order_items', 'stock_movements'
        ]
        
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"  {table}: {count} records")
            except:
                print(f"  {table}: table not found")
        
        print("\n✓ Sample data population complete!")
        print("\nYou can now:")
        print("1. View data in your database")
        print("2. Test your API endpoints")
        print("3. Start building the dashboard")
        
    except sqlite3.Error as e:
        print(f"\n✗ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()