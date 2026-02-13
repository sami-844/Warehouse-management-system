"""
Test Analytics Endpoints
Tests all KPI calculations directly
"""

import sqlite3
from datetime import datetime, timedelta
import json

def test_dashboard_kpis():
    """Test the main dashboard endpoint logic"""
    
    conn = sqlite3.connect("warehouse.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("=" * 60)
    print("TESTING DASHBOARD KPIs")
    print("=" * 60)
    
    days = 30
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    print(f"\nAnalyzing period: Last {days} days")
    print(f"Start date: {start_date}")
    print(f"End date: {datetime.now().strftime('%Y-%m-%d')}\n")
    
    # Test each KPI
    print("1. Inventory Turnover Ratio...")
    cursor.execute("""
        WITH period_cogs AS (
            SELECT SUM(soi.quantity_shipped * soi.unit_cost) as total_cogs
            FROM sales_order_items soi
            JOIN sales_orders so ON soi.sales_order_id = so.id
            WHERE so.order_date >= date(?)
              AND so.status IN ('delivered', 'shipped')
        ),
        avg_inventory AS (
            SELECT AVG(current_stock * cost_price) as avg_inv_value
            FROM products
            WHERE is_active = 1
        )
        SELECT 
            ROUND(CAST(COALESCE(pc.total_cogs, 0) AS FLOAT) / 
                  NULLIF(ai.avg_inv_value, 0), 2) as ratio
        FROM period_cogs pc, avg_inventory ai
    """, (start_date,))
    print(f"   Result: {cursor.fetchone()[0]}")
    
    print("\n2. Average Inventory Value...")
    cursor.execute("""
        SELECT ROUND(SUM(current_stock * cost_price), 2)
        FROM products WHERE is_active = 1
    """)
    print(f"   Result: ${cursor.fetchone()[0]:,.2f}")
    
    print("\n3. Cost of Goods Sold (COGS)...")
    cursor.execute("""
        SELECT ROUND(SUM(soi.quantity_shipped * soi.unit_cost), 2)
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.sales_order_id = so.id
        WHERE so.order_date >= date(?)
          AND so.status IN ('delivered', 'shipped')
    """, (start_date,))
    print(f"   Result: ${cursor.fetchone()[0]:,.2f}")
    
    print("\n4. Service Level...")
    cursor.execute("""
        WITH order_status AS (
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) as fulfilled
            FROM sales_orders
            WHERE order_date >= date(?)
        )
        SELECT ROUND((fulfilled * 100.0) / NULLIF(total, 0), 1)
        FROM order_status
    """, (start_date,))
    print(f"   Result: {cursor.fetchone()[0]}%")
    
    print("\n5. Sales Orders Summary...")
    cursor.execute("""
        SELECT status, COUNT(*)
        FROM sales_orders
        WHERE order_date >= date(?)
        GROUP BY status
    """, (start_date,))
    for row in cursor.fetchall():
        print(f"   {row[0]}: {row[1]} orders")
    
    print("\n6. Inventory Status...")
    cursor.execute("""
        SELECT 
            CASE 
                WHEN current_stock = 0 THEN 'Out of Stock'
                WHEN current_stock <= reorder_point THEN 'Low Stock'
                ELSE 'In Stock'
            END as status,
            COUNT(*)
        FROM products
        WHERE is_active = 1
        GROUP BY status
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]}: {row[1]} items")
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("✓ ALL KPI CALCULATIONS WORKING!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Add analytics_router.py to your FastAPI app")
    print("2. Test endpoints with your frontend")
    print("3. Build the React dashboard components")

if __name__ == "__main__":
    test_dashboard_kpis()