"""
Fix Product Prices
Adds cost and selling prices to existing products
"""

import sqlite3

def update_product_prices():
    """Update existing products with sample prices"""
    
    db_path = "warehouse.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Checking products...")
        
        # Get all products
        cursor.execute("SELECT id, name, cost_price, selling_price FROM products")
        products = cursor.fetchall()
        
        if not products:
            print("! No products found")
            return
        
        print(f"\nFound {len(products)} products:\n")
        
        updated = 0
        for product_id, name, cost, price in products:
            print(f"{product_id}. {name}")
            print(f"   Current cost_price: {cost}, selling_price: {price}")
            
            # If prices are 0 or None, set sample prices
            if not cost or cost == 0:
                # Generate a random cost price between 1 and 50
                import random
                new_cost = round(random.uniform(2.0, 20.0), 2)
                new_price = round(new_cost * 1.5, 2)  # 50% markup
                
                cursor.execute("""
                    UPDATE products 
                    SET cost_price = ?, selling_price = ?
                    WHERE id = ?
                """, (new_cost, new_price, product_id))
                
                print(f"   ✓ Updated: cost_price={new_cost}, selling_price={new_price}")
                updated += 1
            else:
                print(f"   - Already has prices")
        
        # Also update other fields if needed
        cursor.execute("""
            UPDATE products 
            SET current_stock = 500,
                reorder_point = 200,
                reorder_quantity = 300,
                safety_stock = 100,
                maximum_stock = 1000,
                unit = 'pcs'
            WHERE current_stock IS NULL OR current_stock = 0
        """)
        
        conn.commit()
        conn.close()
        
        print(f"\n✓ Updated {updated} products with prices!")
        print("\nNow run: python populate_sample_data_fixed.py")
        
    except sqlite3.Error as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("FIXING PRODUCT PRICES")
    print("=" * 60)
    print()
    update_product_prices()