"""
Populate Sample Data
Creates realistic test data for your warehouse system
"""

import sqlite3
from datetime import datetime, timedelta
import random

def create_sample_categories(cursor):
    """Create product categories"""
    categories = [
        ('Drinks', 'Soft drinks, juices, water'),
        ('Cooking Oil', 'Vegetable oil, olive oil, etc.'),
        ('Rice & Grains', 'Rice, pasta, flour'),
        ('Canned Goods', 'Canned vegetables, fruits, etc.'),
        ('Snacks', 'Chips, biscuits, crackers'),
        ('Dairy Products', 'Milk, cheese, yogurt'),
        ('Cleaning Supplies', 'Detergents, soaps, cleaners')
    ]
    
    print("Creating categories...")
    for name, description in categories:
        cursor.execute("""
            INSERT OR IGNORE INTO categories (name, description)
            VALUES (?, ?)
        """, (name, description))
    print(f"✓ Created {len(categories)} categories")

def create_sample_suppliers(cursor):
    """Create suppliers"""
    suppliers = [
        ('Gulf Container Imports LLC', 'Ahmed Al-Balushi', '+968-9123-4567', 'ahmed@gulfcontainer.om', 90),
        ('Oman Food Distributors', 'Khalid Al-Rashidi', '+968-9234-5678', 'khalid@omanfood.om', 7),
        ('Muscat Trading Co.', 'Fatima Al-Said', '+968-9345-6789', 'fatima@muscattrading.om', 14),
        ('Arabian Beverages Supply', 'Mohammed Al-Harthi', '+968-9456-7890', 'mohammed@arabianbev.om', 21)
    ]
    
    print("Creating suppliers...")
    for name, contact, phone, email, lead_time in suppliers:
        cursor.execute("""
            INSERT OR IGNORE INTO suppliers 
            (name, contact_person, phone, email, average_lead_time, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (name, contact, phone, email, lead_time))
    print(f"✓ Created {len(suppliers)} suppliers")

def create_sample_customers(cursor):
    """Create customers (local shops)"""
    customers = [
        ('Al-Khuwair Mini Market', 'Shop Owner', '+968-2411-1111', 'Al Khuwair, Muscat', 'retail'),
        ('Ruwi Grocery Store', 'Shop Manager', '+968-2470-2222', 'Ruwi, Muscat', 'wholesale'),
        ('Qurum Supermarket', 'Owner', '+968-2460-3333', 'Qurum, Muscat', 'wholesale'),
        ('Bousher Corner Shop', 'Manager', '+968-2459-4444', 'Bousher, Muscat', 'retail'),
        ('Seeb Local Market', 'Owner', '+968-2448-5555', 'Seeb, Muscat', 'wholesale'),
        ('Azaiba Mini Mart', 'Shop Keeper', '+968-2454-6666', 'Azaiba, Muscat', 'retail'),
        ('Ghubrah Grocery', 'Manager', '+968-2469-7777', 'Ghubrah, Muscat', 'retail'),
        ('Madinat Qaboos Store', 'Owner', '+968-2460-8888', 'Madinat Qaboos', 'wholesale')
    ]
    
    print("Creating customers...")
    for name, contact, phone, address, cust_type in customers:
        cursor.execute("""
            INSERT OR IGNORE INTO customers 
            (name, contact_person, phone, address, customer_type, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (name, contact, phone, address, cust_type))
    print(f"✓ Created {len(customers)} customers")

def create_sample_products(cursor):
    """Create sample FMCG products"""
    products = [
        # Drinks
        ('DRK001', 'Coca Cola 330ml (24 pack)', 1, 5.0, 7.5, 500, 200, 300, 100, 1000, 'carton'),
        ('DRK002', 'Pepsi 330ml (24 pack)', 1, 4.8, 7.2, 400, 150, 300, 100, 1000, 'carton'),
        ('DRK003', 'Water 500ml (24 pack)', 1, 1.5, 2.5, 800, 300, 500, 150, 1500, 'carton'),
        ('DRK004', 'Orange Juice 1L (12 pack)', 1, 8.0, 12.0, 200, 80, 150, 50, 500, 'carton'),
        
        # Cooking Oil
        ('OIL001', 'Vegetable Oil 1.8L', 2, 3.5, 5.0, 300, 100, 200, 50, 800, 'bottle'),
        ('OIL002', 'Olive Oil 500ml', 2, 6.0, 9.0, 150, 50, 100, 30, 400, 'bottle'),
        ('OIL003', 'Sunflower Oil 1L', 2, 3.0, 4.5, 250, 80, 150, 40, 600, 'bottle'),
        
        # Rice & Grains
        ('RICE001', 'Basmati Rice 5kg', 3, 12.0, 18.0, 400, 150, 250, 80, 800, 'bag'),
        ('RICE002', 'White Rice 5kg', 3, 8.0, 12.0, 500, 200, 300, 100, 1000, 'bag'),
        ('RICE003', 'Pasta 500g (24 pack)', 3, 6.0, 9.0, 200, 80, 120, 40, 500, 'carton'),
        
        # Canned Goods
        ('CAN001', 'Tomato Paste 400g (24 pack)', 4, 10.0, 15.0, 300, 120, 180, 60, 700, 'carton'),
        ('CAN002', 'Canned Tuna 185g (48 pack)', 4, 35.0, 50.0, 150, 60, 100, 30, 400, 'carton'),
        ('CAN003', 'Canned Beans 400g (24 pack)', 4, 8.0, 12.0, 250, 100, 150, 50, 600, 'carton'),
        
        # Snacks
        ('SNK001', 'Potato Chips 25g (30 pack)', 5, 12.0, 18.0, 200, 80, 120, 40, 500, 'carton'),
        ('SNK002', 'Biscuits Assorted (24 pack)', 5, 15.0, 22.0, 180, 70, 110, 35, 450, 'carton'),
        
        # Dairy
        ('DRY001', 'UHT Milk 1L (12 pack)', 6, 10.0, 15.0, 300, 120, 180, 60, 700, 'carton'),
        ('DRY002', 'Cheese Slices 200g (20 pack)', 6, 25.0, 38.0, 100, 40, 60, 20, 300, 'carton'),
        
        # Cleaning
        ('CLN001', 'Dish Soap 500ml (12 pack)', 7, 8.0, 12.0, 200, 80, 120, 40, 500, 'carton'),
        ('CLN002', 'Laundry Detergent 2kg', 7, 15.0, 22.0, 150, 60, 90, 30, 400, 'bag'),
    ]
    
    print("Creating products...")
    for sku, name, cat_id, cost, price, stock, reorder, reorder_qty, safety, max_stock, unit in products:
        cursor.execute("""
            INSERT OR IGNORE INTO products 
            (sku, name, category_id, cost_price, selling_price, current_stock, 
             reorder_point, reorder_quantity, safety_stock, maximum_stock, 
             unit, is_active, lead_time_days, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 7, ?, ?)
        """, (sku, name, cat_id, cost, price, stock, reorder, reorder_qty, 
              safety, max_stock, unit, datetime.now(), datetime.now()))
    
    print(f"✓ Created {len(products)} products")

def create_sample_sales_orders(cursor):
    """Create sample sales orders"""
    print("Creating sample sales orders...")
    
    # Get all products
    cursor.execute("SELECT id, sku, selling_price, cost_price FROM products")
    products = cursor.fetchall()
    
    # Get all customers
    cursor.execute("SELECT id FROM customers")
    customers = [row[0] for row in cursor.fetchall()]
    
    statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']
    
    # Create 30 orders over the last 30 days
    for i in range(30):
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
        """, (order_number, customer_id, order_date.date(), status,
              status == 'delivered', status == 'delivered', True, True,
              random.choice(['van1', 'van2']), datetime.now()))
        
        order_id = cursor.lastrowid
        
        # Add 2-5 random items to order
        num_items = random.randint(2, 5)
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
    
    print(f"✓ Created 30 sales orders with items")

def create_sample_stock_movements(cursor):
    """Create stock movement history"""
    print("Creating stock movements...")
    
    cursor.execute("SELECT id, current_stock, cost_price FROM products")
    products = cursor.fetchall()
    
    # Create initial stock receipt movements for each product
    for product_id, stock, cost in products:
        movement_date = datetime.now() - timedelta(days=random.randint(30, 90))
        
        cursor.execute("""
            INSERT INTO stock_movements 
            (product_id, movement_type, quantity, unit_cost, total_cost,
             stock_before, stock_after, reference_type, movement_date)
            VALUES (?, 'purchase', ?, ?, ?, 0, ?, 'initial_stock', ?)
        """, (product_id, stock, cost, float(cost) * stock, stock, movement_date))
    
    print(f"✓ Created stock movements for {len(products)} products")

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
        # Create all sample data
        create_sample_categories(cursor)
        create_sample_suppliers(cursor)
        create_sample_customers(cursor)
        create_sample_products(cursor)
        create_sample_sales_orders(cursor)
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
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"  {table}: {count} records")
        
        print("\n✓ Sample data population complete!")
        print("\nYou can now:")
        print("1. View data in your database browser")
        print("2. Test your API endpoints")
        print("3. Start building the dashboard")
        
    except sqlite3.Error as e:
        print(f"\n✗ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()