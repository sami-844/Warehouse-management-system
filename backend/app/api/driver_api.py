"""
Driver API — Phase 5c
Dedicated lightweight endpoints for the mobile driver app.
Minimal data, optimized for low-bandwidth mobile use.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
import sqlite3, os

router = APIRouter()
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "warehouse.db")


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# ── Today's Deliveries for Driver ──
@router.get("/my-deliveries")
def my_deliveries(driver_name: str = Query(default="")):
    """Get today's deliveries. Filter by driver name if provided."""
    conn = get_db()
    today = date.today().isoformat()

    where = "d.scheduled_date = ?"
    params = [today]
    if driver_name:
        where += " AND d.driver_name LIKE ?"
        params.append(f"%{driver_name}%")

    rows = conn.execute(f"""
        SELECT d.id, d.delivery_number, d.status, d.driver_name, d.vehicle_number,
               d.scheduled_date, d.delivery_sequence, d.driver_notes,
               so.order_number, so.delivery_address, so.notes as order_notes,
               c.name as customer_name, c.phone as customer_phone,
               c.address_line1, c.city, c.area, c.contact_person,
               (SELECT COUNT(*) FROM sales_order_items WHERE sales_order_id = so.id) as item_count,
               so.total_amount
        FROM deliveries d
        JOIN sales_orders so ON d.sales_order_id = so.id
        JOIN customers c ON so.customer_id = c.id
        WHERE {where}
        ORDER BY d.delivery_sequence ASC, d.id ASC
    """, params).fetchall()

    conn.close()
    return {
        "deliveries": [dict(r) for r in rows],
        "total": len(rows),
        "date": today,
    }


# ── Delivery Detail (with items) ──
@router.get("/delivery/{delivery_id}")
def delivery_detail(delivery_id: int):
    conn = get_db()
    d = conn.execute("""
        SELECT d.*, so.order_number, so.delivery_address, so.notes as order_notes,
               c.name as customer_name, c.phone as customer_phone,
               c.address_line1, c.city, c.area, c.contact_person
        FROM deliveries d
        JOIN sales_orders so ON d.sales_order_id = so.id
        JOIN customers c ON so.customer_id = c.id
        WHERE d.id = ?
    """, (delivery_id,)).fetchone()

    if not d:
        raise HTTPException(404, "Delivery not found")

    items = conn.execute("""
        SELECT soi.quantity, soi.unit_price, p.name, p.sku, p.barcode, p.unit_of_measure
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.sales_order_id = ?
    """, (d["sales_order_id"],)).fetchall()

    conn.close()
    result = dict(d)
    result["items"] = [dict(i) for i in items]
    return result


# ── Complete Delivery (with signature + GPS) ──
class DeliveryComplete(BaseModel):
    customer_signature: str = ""    # base64 PNG from canvas
    driver_signature: str = ""      # base64 PNG from canvas
    notes: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@router.post("/delivery/{delivery_id}/complete")
def complete_delivery(delivery_id: int, data: DeliveryComplete):
    conn = get_db()
    d = conn.execute("SELECT * FROM deliveries WHERE id = ?", (delivery_id,)).fetchone()
    if not d:
        raise HTTPException(404, "Delivery not found")

    conn.execute("""
        UPDATE deliveries SET
            status = 'delivered',
            customer_signature = ?,
            driver_signature = ?,
            driver_notes = ?,
            delivery_lat = ?,
            delivery_lng = ?,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (data.customer_signature, data.driver_signature, data.notes,
          data.latitude, data.longitude, delivery_id))

    # Also update sales order status
    try:
        conn.execute(
            "UPDATE sales_orders SET status='delivered', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (d["sales_order_id"],))
    except:
        pass

    conn.commit()
    conn.close()
    return {"message": "Delivery completed", "delivery_id": delivery_id}


# ── Update Delivery Sequence (for route reordering) ──
class SequenceUpdate(BaseModel):
    delivery_ids: list  # ordered list of delivery IDs

@router.post("/reorder")
def reorder_deliveries(data: SequenceUpdate):
    conn = get_db()
    for idx, did in enumerate(data.delivery_ids):
        conn.execute(
            "UPDATE deliveries SET delivery_sequence = ? WHERE id = ?",
            (idx + 1, did))
    conn.commit()
    conn.close()
    return {"message": f"Reordered {len(data.delivery_ids)} deliveries"}


# ── Driver Stats ──
@router.get("/stats")
def driver_stats(driver_name: str = Query(default="")):
    conn = get_db()
    today = date.today().isoformat()

    total_today = conn.execute(
        "SELECT COUNT(*) FROM deliveries WHERE scheduled_date = ?", (today,)
    ).fetchone()[0]

    completed_today = conn.execute(
        "SELECT COUNT(*) FROM deliveries WHERE scheduled_date = ? AND status = 'delivered'", (today,)
    ).fetchone()[0]

    pending = conn.execute(
        "SELECT COUNT(*) FROM deliveries WHERE scheduled_date = ? AND status IN ('pending', 'in_transit')",
        (today,)
    ).fetchone()[0]

    conn.close()
    return {
        "date": today,
        "total_deliveries": total_today,
        "completed": completed_today,
        "pending": pending,
        "completion_rate": round(completed_today / total_today * 100, 1) if total_today > 0 else 0,
    }
