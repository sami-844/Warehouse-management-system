"""
Analytics API Router — PostgreSQL Compatible
Uses SQLAlchemy engine for both SQLite (dev) and PostgreSQL (production).

Phase 5 fix: all SQL queries rewritten to use the actual DB schema.
- products.current_stock  → JOIN stock_levels.quantity_on_hand
- products.cost_price     → products.standard_cost
- products.lead_time_days → computed from purchase_orders
- products.is_dead_stock  → computed: stock > 0 AND no sales in 90 days
- products.reorder_point  → products.reorder_level
- products.reorder_quantity → products.reorder_level
- sales_orders.is_on_time/is_damage_free/is_accurate → computed from delivered_date/items
"""

from fastapi import APIRouter, Query
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import text
from app.core.database import engine

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def run_query(sql: str, params: dict = {}):
    """Execute a SQL query and return all rows as dicts"""
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


def run_scalar(sql: str, params: dict = {}):
    """Execute a SQL query and return single scalar value"""
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        row = result.fetchone()
        return row[0] if row and row[0] is not None else 0


# Reusable subquery: aggregate stock_levels per product
STOCK_CTE = """
    LEFT JOIN (
        SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
        FROM stock_levels
        GROUP BY product_id
    ) sl ON sl.product_id = p.id
"""


# ================================================================
# DASHBOARD — All KPIs in one call
# ================================================================

@router.get("/dashboard")
def get_dashboard_kpis(
    days: int = Query(30, description="Number of days to analyse"),
    category_id: Optional[int] = Query(None, description="Filter by category")
):
    """Get all KPIs for the dashboard in one call"""
    end_date   = datetime.now()
    start_date = end_date - timedelta(days=days)
    start_str  = start_date.strftime('%Y-%m-%d')

    try:
        # 1. Inventory Turnover Ratio
        inventory_turnover = run_scalar("""
            WITH period_cogs AS (
                SELECT COALESCE(SUM(soi.quantity_shipped * soi.unit_cost), 0) as total_cogs
                FROM sales_order_items soi
                JOIN sales_orders so ON soi.sales_order_id = so.id
                WHERE so.order_date >= :start
                  AND so.status IN ('delivered', 'shipped')
            ),
            avg_inventory AS (
                SELECT AVG(COALESCE(sl.current_stock, 0) * COALESCE(p.standard_cost, 0)) as avg_inv_value
                FROM products p
                LEFT JOIN (
                    SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                    FROM stock_levels GROUP BY product_id
                ) sl ON sl.product_id = p.id
                WHERE p.is_active = true
            )
            SELECT ROUND(CAST(COALESCE(pc.total_cogs, 0) AS NUMERIC) /
                  NULLIF(ai.avg_inv_value, 0), 2)
            FROM period_cogs pc, avg_inventory ai
        """, {"start": start_str})

        # 2. Average Inventory Value
        avg_inventory = run_scalar("""
            SELECT ROUND(SUM(COALESCE(sl.current_stock, 0) * COALESCE(p.standard_cost, 0)), 2)
            FROM products p
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE p.is_active = true
        """)

        # 3. COGS
        cogs = run_scalar("""
            SELECT ROUND(COALESCE(SUM(soi.quantity_shipped * soi.unit_cost), 0), 2)
            FROM sales_order_items soi
            JOIN sales_orders so ON soi.sales_order_id = so.id
            WHERE so.order_date >= :start
              AND so.status IN ('delivered', 'shipped')
        """, {"start": start_str})

        # 4. Service Level
        service_level = run_scalar("""
            SELECT ROUND((SUM(CASE WHEN is_complete = true THEN 1 ELSE 0 END) * 100.0) /
                  NULLIF(COUNT(*), 0), 1)
            FROM sales_orders WHERE order_date >= :start
        """, {"start": start_str})

        # 5. Days to Sell
        days_to_sell = run_scalar("""
            WITH inventory_value AS (
                SELECT SUM(COALESCE(sl.current_stock, 0) * COALESCE(p.standard_cost, 0)) as total_value
                FROM products p
                LEFT JOIN (
                    SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                    FROM stock_levels GROUP BY product_id
                ) sl ON sl.product_id = p.id
                WHERE p.is_active = true
            ),
            daily_cogs AS (
                SELECT COALESCE(SUM(soi.quantity_shipped * soi.unit_cost), 0) / :days as avg_daily_cogs
                FROM sales_order_items soi
                JOIN sales_orders so ON soi.sales_order_id = so.id
                WHERE so.order_date >= :start
                  AND so.status IN ('delivered', 'shipped')
            )
            SELECT ROUND(iv.total_value / NULLIF(dc.avg_daily_cogs, 0), 1)
            FROM inventory_value iv, daily_cogs dc
        """, {"days": days, "start": start_str})

        # 6. Lead Time — computed from purchase orders
        lead_time = run_scalar("""
            SELECT COALESCE(ROUND(AVG(
                EXTRACT(DAY FROM (
                    CAST(expected_delivery_date AS timestamp) - CAST(order_date AS timestamp)
                ))
            ), 1), 0)
            FROM purchase_orders
            WHERE status IN ('received', 'partial')
              AND expected_delivery_date IS NOT NULL
              AND order_date IS NOT NULL
              AND order_date >= CURRENT_DATE - INTERVAL '365 days'
        """)

        # 7. Perfect Order Rate — on-time + fully shipped
        perfect_order_rate = run_scalar("""
            SELECT ROUND((SUM(CASE
                WHEN so.is_complete = true
                 AND (so.required_date IS NULL OR so.delivered_date IS NULL
                      OR so.delivered_date <= so.required_date)
                 AND NOT EXISTS (
                     SELECT 1 FROM sales_order_items soi
                     WHERE soi.sales_order_id = so.id
                       AND COALESCE(soi.quantity_shipped, 0) < soi.quantity_ordered
                 )
                THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0), 1)
            FROM sales_orders so
            WHERE so.order_date >= :start
              AND so.status IN ('delivered', 'shipped')
        """, {"start": start_str})

        # 8. Return Rate — safe: returns table may not exist
        try:
            return_rate = run_scalar("""
                WITH total_sales AS (
                    SELECT COALESCE(SUM(total_amount), 0) as sales_value
                    FROM sales_orders
                    WHERE order_date >= :start AND status IN ('delivered', 'shipped')
                ),
                total_returns AS (
                    SELECT COALESCE(SUM(total_amount), 0) as return_value
                    FROM returns
                    WHERE return_date >= :start AND status = 'processed'
                )
                SELECT ROUND((tr.return_value * 100.0) / NULLIF(ts.sales_value, 0), 1)
                FROM total_sales ts, total_returns tr
            """, {"start": start_str})
        except Exception:
            return_rate = 0

        # 9. Sales Orders by Status
        orders_rows = run_query("""
            SELECT status, COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total_value
            FROM sales_orders WHERE order_date >= :start
            GROUP BY status
        """, {"start": start_str})

        sales_orders_raw = {r["status"]: r for r in orders_rows}
        completed   = sales_orders_raw.get("delivered", {}).get("cnt", 0)
        in_progress = sum([
            sales_orders_raw.get("confirmed",   {}).get("cnt", 0),
            sales_orders_raw.get("processing",  {}).get("cnt", 0),
            sales_orders_raw.get("shipped",     {}).get("cnt", 0),
        ])
        returns = sales_orders_raw.get("returned", {}).get("cnt", 0)

        overdue = run_scalar("""
            SELECT COUNT(*) FROM sales_orders
            WHERE required_date < CURRENT_DATE
              AND status NOT IN ('delivered', 'cancelled')
              AND order_date >= :start
        """, {"start": start_str})

        # 10. Inventory Status
        inv_rows = run_query("""
            SELECT
                CASE
                    WHEN COALESCE(sl.current_stock, 0) = 0 THEN 'out_of_stock'
                    WHEN COALESCE(sl.current_stock, 0) <= COALESCE(p.reorder_level, 10) THEN 'low_stock'
                    ELSE 'in_stock'
                END as stock_status,
                COUNT(*) as cnt
            FROM products p
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE p.is_active = true
            GROUP BY stock_status
        """)

        inventory_status = {
            "in_stock_items": 0, "out_of_stock_items": 0,
            "low_stock_items": 0, "dead_stock_items": 0
        }
        key_map = {
            "in_stock": "in_stock_items",
            "low_stock": "low_stock_items",
            "out_of_stock": "out_of_stock_items"
        }
        for row in inv_rows:
            key = key_map.get(row["stock_status"])
            if key:
                inventory_status[key] = row["cnt"]

        # Dead stock: has stock but no sales in 90 days
        dead = run_scalar("""
            SELECT COUNT(*)
            FROM products p
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE p.is_active = true
              AND COALESCE(sl.current_stock, 0) > 0
              AND NOT EXISTS (
                  SELECT 1 FROM sales_order_items soi
                  JOIN sales_orders so ON soi.sales_order_id = so.id
                  WHERE soi.product_id = p.id
                    AND so.order_date >= CURRENT_DATE - INTERVAL '90 days'
              )
        """)
        inventory_status["dead_stock_items"] = dead

        return {
            "period": {
                "start_date": start_str,
                "end_date": end_date.strftime('%Y-%m-%d'),
                "days": days
            },
            "kpis": {
                "inventory_turnover_ratio": float(inventory_turnover or 0),
                "average_inventory": float(avg_inventory or 0),
                "cost_of_goods_sold": float(cogs or 0),
                "service_level": float(service_level or 0),
                "days_to_sell_inventory": float(days_to_sell or 0),
                "lead_time": float(lead_time or 0),
                "perfect_order_rate": float(perfect_order_rate or 0),
                "rate_of_return": float(return_rate or 0)
            },
            "sales_orders": {
                "completed": int(completed or 0),
                "in_progress": int(in_progress or 0),
                "returns": int(returns or 0),
                "overdue_shipping": int(overdue or 0)
            },
            "inventory_status": inventory_status
        }

    except Exception as e:
        return {"error": str(e), "message": "Error calculating KPIs"}


# ================================================================
# INVENTORY TURNOVER
# ================================================================

@router.get("/inventory-turnover")
def get_inventory_turnover(days: int = Query(30)):
    start = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    try:
        row = run_query("""
            WITH period_cogs AS (
                SELECT COALESCE(SUM(soi.quantity_shipped * soi.unit_cost), 0) as total_cogs
                FROM sales_order_items soi
                JOIN sales_orders so ON soi.sales_order_id = so.id
                WHERE so.order_date >= :start AND so.status IN ('delivered', 'shipped')
            ),
            avg_inventory AS (
                SELECT COALESCE(AVG(COALESCE(sl.current_stock, 0) * COALESCE(p.standard_cost, 0)), 0) as avg_inv_value
                FROM products p
                LEFT JOIN (
                    SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                    FROM stock_levels GROUP BY product_id
                ) sl ON sl.product_id = p.id
                WHERE p.is_active = true
            )
            SELECT
                ROUND(CAST(COALESCE(pc.total_cogs, 0) AS NUMERIC) / NULLIF(ai.avg_inv_value, 0), 2) as ratio,
                pc.total_cogs,
                ai.avg_inv_value
            FROM period_cogs pc, avg_inventory ai
        """, {"start": start})
        r = row[0] if row else {}
        return {
            "inventory_turnover_ratio": float(r.get("ratio") or 0),
            "cogs": float(r.get("total_cogs") or 0),
            "average_inventory": float(r.get("avg_inv_value") or 0),
            "period_days": days
        }
    except Exception as e:
        return {"error": str(e)}


# ================================================================
# STOCK STATUS
# ================================================================

@router.get("/stock-status")
def get_stock_status():
    try:
        rows = run_query("""
            SELECT
                CASE
                    WHEN COALESCE(sl.current_stock, 0) = 0 THEN 'out_of_stock'
                    WHEN COALESCE(sl.current_stock, 0) <= COALESCE(p.reorder_level, 10) THEN 'low_stock'
                    ELSE 'in_stock'
                END as status,
                COUNT(*) as cnt,
                ROUND(SUM(COALESCE(sl.current_stock, 0) * COALESCE(p.standard_cost, 0)), 2) as value
            FROM products p
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE p.is_active = true
            GROUP BY status
        """)
        breakdown = {
            "in_stock": {"count": 0, "value": 0},
            "low_stock": {"count": 0, "value": 0},
            "out_of_stock": {"count": 0, "value": 0}
        }
        for r in rows:
            breakdown[r["status"]] = {"count": r["cnt"], "value": float(r["value"] or 0)}

        # Dead stock: has quantity but no recent sales
        dead = run_query("""
            SELECT COUNT(*) as cnt,
                   ROUND(SUM(COALESCE(sl.current_stock, 0) * COALESCE(p.standard_cost, 0)), 2) as value
            FROM products p
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE p.is_active = true
              AND COALESCE(sl.current_stock, 0) > 0
              AND NOT EXISTS (
                  SELECT 1 FROM sales_order_items soi
                  JOIN sales_orders so ON soi.sales_order_id = so.id
                  WHERE soi.product_id = p.id
                    AND so.order_date >= CURRENT_DATE - INTERVAL '90 days'
              )
        """)
        d = dead[0] if dead else {}
        breakdown["dead_stock"] = {"count": d.get("cnt", 0), "value": float(d.get("value") or 0)}
        return breakdown
    except Exception as e:
        return {"error": str(e)}


# ================================================================
# SALES SUMMARY
# ================================================================

@router.get("/sales-summary")
def get_sales_summary(days: int = Query(30)):
    start = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    try:
        rows = run_query("""
            SELECT status, COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total_value
            FROM sales_orders WHERE order_date >= :start
            GROUP BY status
        """, {"start": start})
        summary = {r["status"]: {"count": r["cnt"], "total_value": float(r["total_value"])} for r in rows}
        return {"period_days": days, "breakdown": summary}
    except Exception as e:
        return {"error": str(e)}


# ================================================================
# LOW STOCK PRODUCTS
# ================================================================

@router.get("/low-stock-products")
def get_low_stock_products():
    try:
        rows = run_query("""
            SELECT p.id, p.sku, p.name,
                   COALESCE(sl.current_stock, 0) as current_stock,
                   COALESCE(p.reorder_level, 10) as reorder_point,
                   COALESCE(p.reorder_level, 10) as reorder_quantity
            FROM products p
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE COALESCE(sl.current_stock, 0) <= COALESCE(p.reorder_level, 10)
              AND p.is_active = true
            ORDER BY (COALESCE(sl.current_stock, 0) - COALESCE(p.reorder_level, 10)) ASC
        """)
        products = [{
            "id": r["id"], "sku": r["sku"], "name": r["name"],
            "current_stock": float(r["current_stock"]),
            "reorder_point": float(r["reorder_point"]),
            "reorder_quantity": float(r["reorder_quantity"]),
            "lead_time_days": 0,
            "shortage": float(r["reorder_point"]) - float(r["current_stock"])
        } for r in rows]
        return {"count": len(products), "products": products}
    except Exception as e:
        return {"error": str(e)}


# ================================================================
# CATEGORIES
# ================================================================

@router.get("/categories")
def get_categories():
    """List all active product categories"""
    try:
        rows = run_query("""
            SELECT id, name FROM product_categories
            WHERE is_active = true ORDER BY name
        """)
        return {"categories": rows}
    except Exception as e:
        return {"categories": [], "error": str(e)}


# ================================================================
# TRENDS
# ================================================================

@router.get("/trends")
def get_trends(days: int = Query(30), category_id: Optional[int] = Query(None)):
    """Daily sales & COGS trend"""
    start = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    try:
        rows = run_query("""
            SELECT
                DATE(so.order_date) as order_day,
                ROUND(SUM(soi.quantity_shipped * soi.unit_price), 2) as sales,
                ROUND(SUM(soi.quantity_shipped * soi.unit_cost), 2) as cogs,
                COUNT(DISTINCT so.id) as order_count
            FROM sales_orders so
            JOIN sales_order_items soi ON soi.sales_order_id = so.id
            WHERE so.order_date >= :start
              AND so.status IN ('delivered', 'shipped')
            GROUP BY DATE(so.order_date)
            ORDER BY order_day ASC
        """, {"start": start})
        trends = [{
            "date": str(r["order_day"]),
            "sales": float(r["sales"] or 0),
            "cogs": float(r["cogs"] or 0),
            "order_count": int(r["order_count"] or 0)
        } for r in rows]
        return {"trends": trends, "period_days": days}
    except Exception as e:
        return {"trends": [], "error": str(e)}


# ================================================================
# CATEGORY BREAKDOWN
# ================================================================

@router.get("/category-breakdown")
def get_category_breakdown(days: int = Query(30)):
    """Per-category inventory breakdown"""
    try:
        rows = run_query("""
            SELECT
                COALESCE(c.name, 'Uncategorised') as category,
                COUNT(p.id) as product_count,
                COALESCE(SUM(COALESCE(sl.current_stock, 0)), 0) as total_stock,
                ROUND(COALESCE(SUM(COALESCE(sl.current_stock, 0) * COALESCE(p.standard_cost, 0)), 0), 2) as total_value,
                SUM(CASE WHEN COALESCE(sl.current_stock, 0) = 0 THEN 1 ELSE 0 END) as out_of_stock,
                SUM(CASE WHEN COALESCE(sl.current_stock, 0) <= COALESCE(p.reorder_level, 10)
                         AND COALESCE(sl.current_stock, 0) > 0 THEN 1 ELSE 0 END) as low_stock
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE p.is_active = true
            GROUP BY c.id, c.name
            ORDER BY total_value DESC
        """)
        categories = [{
            "category": r["category"],
            "product_count": r["product_count"],
            "total_stock": float(r["total_stock"] or 0),
            "total_value": float(r["total_value"] or 0),
            "out_of_stock": int(r["out_of_stock"] or 0),
            "low_stock": int(r["low_stock"] or 0),
        } for r in rows]
        return {"categories": categories, "period_days": days}
    except Exception as e:
        return {"categories": [], "error": str(e)}


# ================================================================
# ALERTS
# ================================================================

@router.get("/alerts")
def get_alerts():
    """Get all active alerts"""
    alerts = []

    try:
        # Low stock (has stock but at or below reorder level)
        rows = run_query("""
            SELECT p.id, p.sku, p.name,
                   COALESCE(sl.current_stock, 0) as current_stock,
                   COALESCE(p.reorder_level, 10) as reorder_point,
                   COALESCE(c.name, 'General') as category
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE COALESCE(sl.current_stock, 0) > 0
              AND COALESCE(sl.current_stock, 0) <= COALESCE(p.reorder_level, 10)
              AND p.is_active = true
            ORDER BY (COALESCE(sl.current_stock, 0) - COALESCE(p.reorder_level, 10)) ASC
            LIMIT 30
        """)
        for r in rows:
            alerts.append({
                "type": "low_stock", "severity": "warning",
                "product_id": r["id"], "sku": r["sku"], "category": r["category"],
                "message": f"{r['name']} — {r['current_stock']} units left (reorder at {r['reorder_point']})"
            })

        # Out of stock
        rows = run_query("""
            SELECT p.id, p.sku, p.name,
                   COALESCE(p.reorder_level, 10) as reorder_quantity,
                   COALESCE(c.name, 'General') as category
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE COALESCE(sl.current_stock, 0) = 0 AND p.is_active = true
            LIMIT 30
        """)
        for r in rows:
            alerts.append({
                "type": "out_of_stock", "severity": "critical",
                "product_id": r["id"], "sku": r["sku"], "category": r["category"],
                "message": f"{r['name']} — completely out of stock (needs {r['reorder_quantity']} units)"
            })

        # Dead stock: has quantity but no sales in 90 days
        rows = run_query("""
            SELECT p.id, p.sku, p.name,
                   COALESCE(sl.current_stock, 0) as current_stock,
                   COALESCE(c.name, 'General') as category
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN (
                SELECT product_id, COALESCE(SUM(quantity_on_hand), 0) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE p.is_active = true
              AND COALESCE(sl.current_stock, 0) > 0
              AND NOT EXISTS (
                  SELECT 1 FROM sales_order_items soi
                  JOIN sales_orders so ON soi.sales_order_id = so.id
                  WHERE soi.product_id = p.id
                    AND so.order_date >= CURRENT_DATE - INTERVAL '90 days'
              )
            LIMIT 30
        """)
        for r in rows:
            alerts.append({
                "type": "dead_stock", "severity": "info",
                "product_id": r["id"], "sku": r["sku"], "category": r["category"],
                "message": f"{r['name']} — {r['current_stock']} units not moving"
            })

        # Overdue orders
        rows = run_query("""
            SELECT id, required_date, status, COALESCE(total_amount, 0) as total_amount
            FROM sales_orders
            WHERE required_date < CURRENT_DATE
              AND status NOT IN ('delivered', 'cancelled')
            ORDER BY required_date ASC
            LIMIT 20
        """)
        for r in rows:
            alerts.append({
                "type": "overdue", "severity": "critical",
                "order_id": r["id"],
                "required_date": str(r["required_date"]),
                "status": r["status"],
                "total_amount": float(r["total_amount"]),
                "message": f"Order #{r['id']} was due {r['required_date']} — currently {r['status']}"
            })

    except Exception as e:
        return {"summary": {}, "alerts": [], "error": str(e)}

    summary = {
        "low_stock":    sum(1 for a in alerts if a["type"] == "low_stock"),
        "out_of_stock": sum(1 for a in alerts if a["type"] == "out_of_stock"),
        "dead_stock":   sum(1 for a in alerts if a["type"] == "dead_stock"),
        "overdue":      sum(1 for a in alerts if a["type"] == "overdue"),
        "total":        len(alerts),
    }
    return {"summary": summary, "alerts": alerts}
