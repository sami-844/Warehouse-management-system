"""
PDF Generator API — Phase 5
Returns structured data for frontend-rendered print documents.
Frontend renders as HTML/CSS then uses window.print() → PDF.
Migrated from SQLite3 to SQLAlchemy (PostgreSQL compatible).
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
from sqlalchemy import text
from app.core.database import engine

router = APIRouter()


def run_q(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


def get_company_info() -> dict:
    try:
        rows = run_q("SELECT setting_key, setting_value FROM company_settings")
        settings = {r["setting_key"]: r["setting_value"] for r in rows}
    except Exception:
        settings = {}
    return {
        "name": settings.get("company_name", "AK Al Mumayza Trading"),
        "address": settings.get("company_address", "Muscat, Oman"),
        "phone": settings.get("company_phone", ""),
        "email": settings.get("company_email", ""),
        "tax_id": settings.get("company_tax_id", ""),
        "tax_rate": float(settings.get("tax_rate", "5")),
        "currency": settings.get("currency", "OMR"),
    }


# ── Sales Invoice ──
@router.get("/invoice/{order_id}")
def get_invoice_data(order_id: int):
    company = get_company_info()

    rows = run_q("""
        SELECT so.id, so.order_number, so.order_date, so.status,
               so.subtotal, so.tax_amount, so.discount_amount, so.total_amount,
               so.delivery_address, so.notes,
               c.name as customer_name, c.address_line1, c.address_line2,
               c.city, c.area, c.phone as customer_phone, c.email as customer_email,
               c.tax_id as customer_tax_id, c.payment_terms_days, c.contact_person
        FROM sales_orders so
        JOIN customers c ON so.customer_id = c.id
        WHERE so.id = :id
    """, {"id": order_id})
    if not rows:
        raise HTTPException(404, "Order not found")
    order = rows[0]

    items = run_q("""
        SELECT soi.id, soi.quantity_ordered AS quantity, soi.unit_price,
               soi.unit_cost, soi.discount_percent, soi.total_price,
               p.name as product_name, p.sku, p.barcode, p.unit_of_measure
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.sales_order_id = :id
    """, {"id": order_id})

    subtotal = sum(float(i.get("quantity") or 0) * float(i.get("unit_price") or 0) for i in items)
    discount = float(order.get("discount_amount") or 0)
    tax_rate = company["tax_rate"]
    taxable = subtotal - discount
    tax = round(taxable * tax_rate / 100, 3)
    total = round(taxable + tax, 3)

    return {
        "company": company,
        "order": order,
        "items": items,
        "subtotal": round(subtotal, 3),
        "discount": discount,
        "tax_rate": tax_rate,
        "tax_amount": tax,
        "total": total,
        "type": "invoice"
    }


# ── Delivery Note ──
@router.get("/delivery-note/{delivery_id}")
def get_delivery_note_data(delivery_id: int):
    company = get_company_info()

    rows = run_q("""
        SELECT d.id, d.status, d.driver_name, d.vehicle, d.scheduled_date,
               d.actual_delivery_date, d.signature_image, d.delivery_notes, d.notes,
               d.sales_order_id,
               so.order_number, so.customer_id, so.delivery_address, so.notes as order_notes,
               c.name as customer_name, c.address_line1, c.city, c.area,
               c.phone as customer_phone, c.contact_person
        FROM deliveries d
        JOIN sales_orders so ON d.sales_order_id = so.id
        JOIN customers c ON so.customer_id = c.id
        WHERE d.id = :id
    """, {"id": delivery_id})
    if not rows:
        raise HTTPException(404, "Delivery not found")
    delivery = rows[0]

    items = run_q("""
        SELECT soi.quantity_ordered AS quantity, soi.unit_price,
               p.name as product_name, p.sku, p.barcode, p.unit_of_measure, p.weight
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.sales_order_id = :so_id
    """, {"so_id": delivery["sales_order_id"]})

    return {
        "company": company,
        "delivery": delivery,
        "items": items,
        "type": "delivery_note"
    }


# ── Customer Statement ──
@router.get("/statement/{customer_id}")
def get_customer_statement(customer_id: int, from_date: str = "", to_date: str = ""):
    company = get_company_info()

    cust_rows = run_q("SELECT * FROM customers WHERE id = :id", {"id": customer_id})
    if not cust_rows:
        raise HTTPException(404, "Customer not found")
    customer = cust_rows[0]

    date_filter = ""
    params: dict = {"cid": customer_id}
    if from_date:
        date_filter += " AND so.order_date >= :from_date"
        params["from_date"] = from_date
    if to_date:
        date_filter += " AND so.order_date <= :to_date"
        params["to_date"] = to_date

    orders = run_q(f"""
        SELECT so.id, so.order_number, so.order_date, so.total_amount, so.status
        FROM sales_orders so
        WHERE so.customer_id = :cid{date_filter}
        ORDER BY so.order_date ASC
    """, params)

    entries = []
    running_balance = 0
    for o in orders:
        if o["status"] in ("confirmed", "shipped", "delivered", "invoiced"):
            running_balance += float(o["total_amount"] or 0)
            entries.append({
                "date": o["order_date"],
                "reference": o["order_number"],
                "description": "Sales Order",
                "debit": o["total_amount"],
                "credit": 0,
                "balance": round(running_balance, 3),
            })

    return {
        "company": company,
        "customer": customer,
        "entries": entries,
        "opening_balance": 0,
        "closing_balance": round(running_balance, 3),
        "from_date": from_date or "Beginning",
        "to_date": to_date or datetime.now().strftime("%Y-%m-%d"),
        "type": "statement"
    }
