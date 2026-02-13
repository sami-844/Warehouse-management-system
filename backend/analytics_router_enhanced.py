"""
Analytics API Router — ENHANCED
Keeps every original endpoint unchanged.
New endpoints added at the bottom: /categories, /trends, /category-breakdown, /alerts
"""

from fastapi import APIRouter, Query
from datetime import datetime, timedelta
from typing import Optional
import sqlite3

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect("warehouse.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# ================================================================
# EXISTING ENDPOINTS  (untouched)
# ================================================================

@router.get("/dashboard")
def get_dashboard_kpis(
    days: int            = Query(30, description="Number of days to analyse"),
    category_id: Optional[int] = Query(None, description="Filter by category")
):
    """Get all KPIs for the dashboard in one call"""
    conn = get_db_connection()
    cursor = conn.cursor()

    end_date   = datetime.now()
    start_date = end_date - timedelta(days=days)
    start_str  = start_date.strftime('%Y-%m-%d')

    try:
        # 1. Inventory Turnover
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
                FROM products WHERE is_active = 1
            )
            SELECT ROUND(CAST(COALESCE(pc.total_cogs, 0) AS FLOAT) /
                  NULLIF(ai.avg_inv_value, 0), 2)
            FROM period_cogs pc, avg_inventory ai
        """, (start_str,))
        inventory_turnover = cursor.fetchone()[0] or 0

        # 2. Average Inventory
        cursor.execute("""
            SELECT ROUND(SUM(current_stock * cost_price), 2)
            FROM products WHERE is_active = 1
        """)
        avg_inventory = cursor.fetchone()[0] or 0

        # 3. COGS
        cursor.execute("""
            SELECT ROUND(SUM(soi.quantity_shipped * soi.unit_cost), 2)
            FROM sales_order_items soi
            JOIN sales_orders so ON soi.sales_order_id = so.id
            WHERE so.order_date >= date(?)
              AND so.status IN ('delivered', 'shipped')
        """, (start_str,))
        cogs = cursor.fetchone()[0] or 0

        # 4. Service Level
        cursor.execute("""
            WITH order_status AS (
                SELECT COUNT(*) as total_orders,
                    SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) as fulfilled
                FROM sales_orders
                WHERE order_date >= date(?)
            )
            SELECT ROUND((fulfilled * 100.0) / NULLIF(total_orders, 0), 1)
            FROM order_status
        """, (start_str,))
        service_level = cursor.fetchone()[0] or 0

        # 5. Days to Sell
        cursor.execute("""
            WITH inventory_value AS (
                SELECT SUM(current_stock * cost_price) as total_value
                FROM products WHERE is_active = 1
            ),
            daily_cogs AS (
                SELECT SUM(soi.quantity_shipped * soi.unit_cost) / ? as avg_daily_cogs
                FROM sales_order_items soi
                JOIN sales_orders so ON soi.sales_order_id = so.id
                WHERE so.order_date >= date(?)
                  AND so.status IN ('delivered', 'shipped')
            )
            SELECT ROUND(iv.total_value / NULLIF(dc.avg_daily_cogs, 0), 1)
            FROM inventory_value iv, daily_cogs dc
        """, (days, start_str))
        days_to_sell = cursor.fetchone()[0] or 0

        # 6. Lead Time
        cursor.execute("""
            SELECT ROUND(AVG(lead_time_days), 1)
            FROM products WHERE is_active = 1
        """)
        lead_time = cursor.fetchone()[0] or 0

        # 7. Perfect Order Rate
        cursor.execute("""
            WITH order_analysis AS (
                SELECT COUNT(*) as total_orders,
                    SUM(CASE WHEN is_complete = 1 AND is_on_time = 1 
                         AND is_damage_free = 1 AND is_accurate = 1
                        THEN 1 ELSE 0 END) as perfect_orders
                FROM sales_orders
                WHERE order_date >= date(?)
                  AND status IN ('delivered', 'shipped')
            )
            SELECT ROUND((perfect_orders * 100.0) / NULLIF(total_orders, 0), 1)
            FROM order_analysis
        """, (start_str,))
        perfect_order_rate = cursor.fetchone()[0] or 0

        # 8. Rate of Return
        cursor.execute("""
            WITH total_sales AS (
                SELECT SUM(total_amount) as sales_value
                FROM sales_orders
                WHERE order_date >= date(?) AND status IN ('delivered', 'shipped')
            ),
            total_returns AS (
                SELECT SUM(refund_amount) as return_value
                FROM returns
                WHERE return_date >= date(?) AND status = 'approved'
            )
            SELECT ROUND((COALESCE(tr.return_value, 0) * 100.0) /
                         NULLIF(ts.sales_value, 0), 1)
            FROM total_sales ts, total_returns tr
        """, (start_str, start_str))
        return_rate = cursor.fetchone()[0] or 0

        # 9. Sales Orders by Status
        cursor.execute("""
            SELECT status, COUNT(*), SUM(total_amount)
            FROM sales_orders WHERE order_date >= date(?)
            GROUP BY status
        """, (start_str,))
        sales_orders_raw = {}
        for row in cursor.fetchall():
            sales_orders_raw[row[0]] = {"count": row[1], "total_value": row[2] or 0}

        completed = sales_orders_raw.get('delivered', {}).get('count', 0)
        in_progress = sum([
            sales_orders_raw.get('confirmed', {}).get('count', 0),
            sales_orders_raw.get('processing', {}).get('count', 0),
            sales_orders_raw.get('shipped', {}).get('count', 0),
        ])
        returns = sales_orders_raw.get('returned', {}).get('count', 0)

        cursor.execute("""
            SELECT COUNT(*) FROM sales_orders
            WHERE required_date < date('now')
              AND status NOT IN ('delivered', 'cancelled')
              AND order_date >= date(?)
        """, (start_str,))
        overdue = cursor.fetchone()[0] or 0

        # 10. Inventory Status
        cursor.execute("""
            SELECT
                CASE
                    WHEN current_stock = 0 THEN 'out_of_stock'
                    WHEN current_stock <= reorder_point THEN 'low_stock'
                    ELSE 'in_stock'
                END as stock_status,
                COUNT(*)
            FROM products WHERE is_active = 1
            GROUP BY stock_status
        """)
        inventory_status = {
            "in_stock_items": 0, "out_of_stock_items": 0,
            "low_stock_items": 0, "dead_stock_items": 0
        }
        for row in cursor.fetchall():
            key = {"in_stock": "in_stock_items", "low_stock": "low_stock_items",
                   "out_of_stock": "out_of_stock_items"}.get(row[0])
            if key: inventory_status[key] = row[1]

        cursor.execute("SELECT COUNT(*) FROM products WHERE is_dead_stock = 1 AND is_active = 1")
        inventory_status['dead_stock_items'] = cursor.fetchone()[0] or 0

        conn.close()

        return {
            "period": {
                "start_date": start_str,
                "end_date": end_date.strftime('%Y-%m-%d'),
                "days": days
            },
            "kpis": {
                "inventory_turnover_ratio": inventory_turnover,
                "average_inventory": avg_inventory,
                "cost_of_goods_sold": cogs,
                "service_level": service_level,
                "days_to_sell_inventory": days_to_sell,
                "lead_time": lead_time,
                "perfect_order_rate": perfect_order_rate,
                "rate_of_return": return_rate
            },
            "sales_orders": {
                "completed": completed,
                "in_progress": in_progress,
                "returns": returns,
                "overdue_shipping": overdue
            },
            "inventory_status": inventory_status
        }

    except Exception as e:
        conn.close()
        return {"error": str(e), "message": "Error calculating KPIs"}


@router.get("/inventory-turnover")
def get_inventory_turnover(days: int = Query(30)):
    conn = get_db_connection()
    cursor = conn.cursor()
    start = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    cursor.execute("""
        WITH period_cogs AS (
            SELECT SUM(soi.quantity_shipped * soi.unit_cost) as total_cogs
            FROM sales_order_items soi
            JOIN sales_orders so ON soi.sales_order_id = so.id
            WHERE so.order_date >= date(?) AND so.status IN ('delivered', 'shipped')
        ),
        avg_inventory AS (
            SELECT AVG(current_stock * cost_price) as avg_inv_value
            FROM products WHERE is_active = 1
        )
        SELECT ROUND(CAST(COALESCE(pc.total_cogs, 0) AS FLOAT) /
              NULLIF(ai.avg_inv_value, 0), 2), pc.total_cogs, ai.avg_inv_value
        FROM period_cogs pc, avg_inventory ai
    """, (start,))
    result = cursor.fetchone()
    conn.close()
    return {
        "inventory_turnover_ratio": result[0] or 0,
        "cogs": result[1] or 0,
        "average_inventory": result[2] or 0,
        "period_days": days
    }


@router.get("/stock-status")
def get_stock_status():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            CASE
                WHEN current_stock = 0 THEN 'out_of_stock'
                WHEN current_stock <= reorder_point THEN 'low_stock'
                ELSE 'in_stock'
            END as status,
            COUNT(*), SUM(current_stock * cost_price)
        FROM products WHERE is_active = 1
        GROUP BY status
    """)
    breakdown = {"in_stock": {"count":0,"value":0}, "low_stock": {"count":0,"value":0}, "out_of_stock": {"count":0,"value":0}}
    for row in cursor.fetchall():
        breakdown[row[0]] = {"count": row[1], "value": round(row[2] or 0, 2)}
    cursor.execute("SELECT COUNT(*), SUM(current_stock * cost_price) FROM products WHERE is_dead_stock = 1 AND is_active = 1")
    dead = cursor.fetchone()
    breakdown["dead_stock"] = {"count": dead[0] or 0, "value": round(dead[1] or 0, 2)}
    conn.close()
    return breakdown


@router.get("/sales-summary")
def get_sales_summary(days: int = Query(30)):
    conn = get_db_connection()
    cursor = conn.cursor()
    start = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    cursor.execute("""
        SELECT status, COUNT(*), SUM(total_amount)
        FROM sales_orders WHERE order_date >= date(?)
        GROUP BY status
    """, (start,))
    summary = {}
    for row in cursor.fetchall():
        summary[row[0]] = {"count": row[1], "total_value": round(row[2] or 0, 2)}
    conn.close()
    return {"period_days": days, "breakdown": summary}


@router.get("/low-stock-products")
def get_low_stock_products():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, sku, name, current_stock, reorder_point, reorder_quantity, lead_time_days
        FROM products
        WHERE current_stock <= reorder_point AND is_active = 1
        ORDER BY (current_stock - reorder_point) ASC
    """)
    products = []
    for row in cursor.fetchall():
        products.append({
            "id": row[0], "sku": row[1], "name": row[2],
            "current_stock": row[3], "reorder_point": row[4],
            "reorder_quantity": row[5], "lead_time_days": row[6],
            "shortage": row[4] - row[3]
        })
    conn.close()
    return {"count": len(products), "products": products}


# ================================================================
# NEW ENDPOINTS
# ================================================================

@router.get("/categories")
def get_categories():
    """List all product categories"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM categories ORDER BY name")
    cats = [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]
    conn.close()
    return {"categories": cats}


@router.get("/trends")
def get_trends(days: int = Query(30), category_id: Optional[int] = Query(None)):
    """Daily sales & COGS trend"""
    conn = get_db_connection()
    cursor = conn.cursor()
    start = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    cursor.execute("""
        SELECT
            date(so.order_date) as order_day,
            ROUND(SUM(soi.quantity_shipped * soi.unit_price), 2) as sales,
            ROUND(SUM(soi.quantity_shipped * soi.unit_cost), 2) as cogs,
            COUNT(DISTINCT so.id) as order_count
        FROM sales_orders so
        JOIN sales_order_items soi ON soi.sales_order_id = so.id
        WHERE so.order_date >= date(?)
          AND so.status IN ('delivered', 'shipped')
        GROUP BY order_day
        ORDER BY order_day ASC
    """, (start,))
    trends = [
        {"date": row[0], "sales": row[1] or 0, "cogs": row[2] or 0, "order_count": row[3] or 0}
        for row in cursor.fetchall()
    ]
    conn.close()
    return {"trends": trends, "period_days": days}


@router.get("/category-breakdown")
def get_category_breakdown(days: int = Query(30)):
    """Per-category inventory breakdown"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            COALESCE(c.name, 'Uncategorised') as category,
            COUNT(p.id) as product_count,
            SUM(p.current_stock) as total_stock,
            ROUND(SUM(p.current_stock * p.cost_price), 2) as total_value,
            SUM(CASE WHEN p.current_stock = 0 THEN 1 ELSE 0 END) as out_of_stock,
            SUM(CASE WHEN p.current_stock <= p.reorder_point AND p.current_stock > 0 THEN 1 ELSE 0 END) as low_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1
        GROUP BY c.id, c.name
        ORDER BY total_value DESC
    """)
    rows = []
    for row in cursor.fetchall():
        rows.append({
            "category": row[0], "product_count": row[1],
            "total_stock": row[2], "total_value": row[3] or 0,
            "out_of_stock": row[4], "low_stock": row[5],
        })
    conn.close()
    return {"categories": rows, "period_days": days}


@router.get("/alerts")
def get_alerts():
    """Get all active alerts"""
    conn = get_db_connection()
    cursor = conn.cursor()
    alerts = []

    # Low stock
    cursor.execute("""
        SELECT p.id, p.sku, p.name, p.current_stock, p.reorder_point,
               COALESCE(c.name, 'General') as category
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.current_stock > 0 AND p.current_stock <= p.reorder_point
          AND p.is_active = 1
        ORDER BY (p.current_stock - p.reorder_point) ASC LIMIT 30
    """)
    for r in cursor.fetchall():
        alerts.append({
            "type": "low_stock", "severity": "warning",
            "product_id": r[0], "sku": r[1], "category": r[5],
            "message": f"{r[2]} — {r[3]} units left (reorder at {r[4]})"
        })

    # Out of stock
    cursor.execute("""
        SELECT p.id, p.sku, p.name, p.reorder_quantity,
               COALESCE(c.name, 'General') as category
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.current_stock = 0 AND p.is_active = 1 LIMIT 30
    """)
    for r in cursor.fetchall():
        alerts.append({
            "type": "out_of_stock", "severity": "critical",
            "product_id": r[0], "sku": r[1], "category": r[4],
            "message": f"{r[2]} — completely out of stock (needs {r[3]} units)"
        })

    # Dead stock
    cursor.execute("""
        SELECT p.id, p.sku, p.name, p.current_stock,
               COALESCE(c.name, 'General') as category
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_dead_stock = 1 AND p.is_active = 1 LIMIT 30
    """)
    for r in cursor.fetchall():
        alerts.append({
            "type": "dead_stock", "severity": "info",
            "product_id": r[0], "sku": r[1], "category": r[4],
            "message": f"{r[2]} — {r[3]} units not moving"
        })

    # Overdue orders
    cursor.execute("""
        SELECT id, required_date, status, total_amount
        FROM sales_orders
        WHERE required_date < date('now')
          AND status NOT IN ('delivered', 'cancelled')
        ORDER BY required_date ASC LIMIT 20
    """)
    for r in cursor.fetchall():
        alerts.append({
            "type": "overdue", "severity": "critical",
            "order_id": r[0], "required_date": r[1],
            "status": r[2], "total_amount": r[3],
            "message": f"Order #{r[0]} was due {r[1]} — currently {r[2]}"
        })

    conn.close()
    summary = {
        "low_stock": sum(1 for a in alerts if a["type"] == "low_stock"),
        "out_of_stock": sum(1 for a in alerts if a["type"] == "out_of_stock"),
        "dead_stock": sum(1 for a in alerts if a["type"] == "dead_stock"),
        "overdue": sum(1 for a in alerts if a["type"] == "overdue"),
        "total": len(alerts),
    }
    return {"summary": summary, "alerts": alerts}
