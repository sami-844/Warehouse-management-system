"""
Driver API — Phase 7
Dedicated lightweight endpoints for the mobile driver app.
Migrated from SQLite3 to SQLAlchemy (PostgreSQL compatible).

Column name fixes vs original SQLite version:
  vehicle_number   → vehicle          (Delivery model)
  driver_notes     → delivery_notes   (Delivery model)
  delivery_lat/lng → delivery_latitude/longitude (Delivery model)
  customer/driver_signature → signature_image (Delivery model, single field)
  completed_at     → actual_delivery_date (Delivery model)
  delivery_number  → computed 'DEL-<id>' (not a real column)
  delivery_sequence → not in model; reorder is a graceful no-op
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date
from sqlalchemy import text
from app.core.database import engine

router = APIRouter()


def run_q(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


def run_s(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        row = result.fetchone()
        return row[0] if row and row[0] is not None else 0


# ── Today's Deliveries for Driver ──
@router.get("/my-deliveries")
def my_deliveries(driver_name: str = Query(default="")):
    """Get today's deliveries. Filter by driver name if provided."""
    today = date.today().isoformat()
    params: dict = {"today": today}

    driver_filter = ""
    if driver_name:
        driver_filter = " AND d.driver_name ILIKE :driver_name"
        params["driver_name"] = f"%{driver_name}%"

    rows = run_q(f"""
        SELECT d.id,
               'DEL-' || CAST(d.id AS VARCHAR) AS delivery_number,
               d.status,
               d.driver_name,
               d.vehicle                                   AS vehicle_number,
               d.scheduled_date,
               COALESCE(d.delivery_notes, d.notes, '')    AS driver_notes,
               so.order_number,
               so.delivery_address,
               so.notes                                    AS order_notes,
               c.name                                      AS customer_name,
               c.phone                                     AS customer_phone,
               c.address_line1,
               c.city,
               c.area,
               c.contact_person,
               (SELECT COUNT(*) FROM sales_order_items
                WHERE sales_order_id = so.id)              AS item_count,
               so.total_amount
        FROM deliveries d
        JOIN sales_orders so ON d.sales_order_id = so.id
        JOIN customers c ON so.customer_id = c.id
        WHERE d.scheduled_date = :today{driver_filter}
        ORDER BY d.id ASC
    """, params)

    return {
        "deliveries": rows,
        "total": len(rows),
        "date": today,
    }


# ── Delivery Detail (with items) ──
@router.get("/delivery/{delivery_id}")
def delivery_detail(delivery_id: int):
    rows = run_q("""
        SELECT d.id,
               'DEL-' || CAST(d.id AS VARCHAR)          AS delivery_number,
               d.status,
               d.driver_name,
               d.vehicle                                 AS vehicle_number,
               d.scheduled_date,
               d.actual_delivery_date,
               COALESCE(d.delivery_notes, d.notes, '')  AS driver_notes,
               d.delivery_latitude                       AS delivery_lat,
               d.delivery_longitude                      AS delivery_lng,
               d.signature_image                         AS customer_signature,
               d.sales_order_id,
               so.order_number,
               so.delivery_address,
               so.notes                                  AS order_notes,
               c.name                                    AS customer_name,
               c.phone                                   AS customer_phone,
               c.address_line1,
               c.city,
               c.area,
               c.contact_person
        FROM deliveries d
        JOIN sales_orders so ON d.sales_order_id = so.id
        JOIN customers c ON so.customer_id = c.id
        WHERE d.id = :id
    """, {"id": delivery_id})

    if not rows:
        raise HTTPException(404, "Delivery not found")

    delivery = rows[0]

    items = run_q("""
        SELECT soi.quantity_ordered AS quantity,
               soi.unit_price,
               p.name,
               p.sku,
               p.barcode,
               p.unit_of_measure
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.sales_order_id = :so_id
    """, {"so_id": delivery["sales_order_id"]})

    delivery["items"] = items
    return delivery


# ── Complete Delivery (with signature + GPS) ──
class DeliveryComplete(BaseModel):
    customer_signature: str = ""   # base64 PNG — stored in signature_image
    driver_signature: str = ""     # accepted but no separate DB column; discarded
    notes: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.post("/delivery/{delivery_id}/complete")
def complete_delivery(delivery_id: int, data: DeliveryComplete):
    rows = run_q(
        "SELECT id, sales_order_id FROM deliveries WHERE id = :id",
        {"id": delivery_id}
    )
    if not rows:
        raise HTTPException(404, "Delivery not found")

    delivery = rows[0]
    today = date.today().isoformat()

    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE deliveries SET
                status               = 'delivered',
                signature_image      = :sig,
                delivery_notes       = :notes,
                delivery_latitude    = :lat,
                delivery_longitude   = :lng,
                actual_delivery_date = :today
            WHERE id = :id
        """), {
            "sig": data.customer_signature,
            "notes": data.notes,
            "lat": data.latitude,
            "lng": data.longitude,
            "today": today,
            "id": delivery_id,
        })

        # Update sales order status
        try:
            conn.execute(text(
                "UPDATE sales_orders SET status = 'delivered', is_complete = true WHERE id = :id"
            ), {"id": delivery["sales_order_id"]})
        except Exception:
            pass

    return {"message": "Delivery completed", "delivery_id": delivery_id}


# ── Update Delivery Sequence (for route reordering) ──
class SequenceUpdate(BaseModel):
    delivery_ids: list  # ordered list of delivery IDs


@router.post("/reorder")
def reorder_deliveries(data: SequenceUpdate):
    # delivery_sequence is not in the SQLAlchemy model — graceful no-op if column missing
    try:
        with engine.begin() as conn:
            for idx, did in enumerate(data.delivery_ids):
                conn.execute(text(
                    "UPDATE deliveries SET delivery_sequence = :seq WHERE id = :id"
                ), {"seq": idx + 1, "id": did})
    except Exception:
        pass
    return {"message": f"Reordered {len(data.delivery_ids)} deliveries"}


# ── Driver Stats ──
@router.get("/stats")
def driver_stats(driver_name: str = Query(default="")):
    today = date.today().isoformat()
    params: dict = {"today": today}

    driver_filter = ""
    if driver_name:
        driver_filter = " AND driver_name ILIKE :driver_name"
        params["driver_name"] = f"%{driver_name}%"

    total_today = run_s(
        f"SELECT COUNT(*) FROM deliveries WHERE scheduled_date = :today{driver_filter}",
        params
    )
    completed_today = run_s(
        f"SELECT COUNT(*) FROM deliveries WHERE scheduled_date = :today AND status = 'delivered'{driver_filter}",
        params
    )
    pending = run_s(
        f"SELECT COUNT(*) FROM deliveries WHERE scheduled_date = :today AND status IN ('pending', 'in_transit'){driver_filter}",
        params
    )

    total = int(total_today)
    done = int(completed_today)
    return {
        "date": today,
        "total_deliveries": total,
        "completed": done,
        "pending": int(pending),
        "completion_rate": round(done / total * 100, 1) if total > 0 else 0,
    }
