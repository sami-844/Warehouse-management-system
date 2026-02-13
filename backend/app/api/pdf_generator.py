"""
PDF Generator API — Phase 5
Returns structured data for frontend-rendered print documents.
Frontend renders as HTML/CSS then uses window.print() → PDF.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
import sqlite3, os

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "warehouse.db")


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def get_company_info(conn):
    """Get company settings or defaults."""
    try:
        rows = conn.execute("SELECT setting_key, setting_value FROM company_settings").fetchall()
        settings = {r["setting_key"]: r["setting_value"] for r in rows}
    except Exception:
        settings = {}
    return {
        "name": settings.get("company_name", "AK Al Momaiza Trading"),
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
    conn = get_db()
    company = get_company_info(conn)

    order = conn.execute("""
        SELECT so.*, c.name as customer_name, c.address_line1, c.address_line2,
               c.city, c.area, c.phone as customer_phone, c.email as customer_email,
               c.tax_id as customer_tax_id, c.payment_terms_days, c.contact_person
        FROM sales_orders so
        JOIN customers c ON so.customer_id = c.id
        WHERE so.id = ?
    """, (order_id,)).fetchone()
    if not order:
        raise HTTPException(404, "Order not found")

    items = conn.execute("""
        SELECT soi.*, p.name as product_name, p.sku, p.barcode, p.unit_of_measure
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.sales_order_id = ?
    """, (order_id,)).fetchall()

    conn.close()

    order_dict = dict(order)
    items_list = [dict(i) for i in items]

    # Calculate totals
    subtotal = sum((i.get("quantity", 0) or 0) * (i.get("unit_price", 0) or 0) for i in items_list)
    discount = float(order_dict.get("discount_amount", 0) or 0)
    tax_rate = company["tax_rate"]
    taxable = subtotal - discount
    tax = round(taxable * tax_rate / 100, 3)
    total = round(taxable + tax, 3)

    return {
        "company": company,
        "order": order_dict,
        "items": items_list,
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
    conn = get_db()
    company = get_company_info(conn)

    delivery = conn.execute("""
        SELECT d.*, so.order_number, so.customer_id, so.delivery_address, so.notes as order_notes,
               c.name as customer_name, c.address_line1, c.city, c.area,
               c.phone as customer_phone, c.contact_person
        FROM deliveries d
        JOIN sales_orders so ON d.sales_order_id = so.id
        JOIN customers c ON so.customer_id = c.id
        WHERE d.id = ?
    """, (delivery_id,)).fetchone()
    if not delivery:
        raise HTTPException(404, "Delivery not found")

    items = conn.execute("""
        SELECT soi.*, p.name as product_name, p.sku, p.barcode, p.unit_of_measure, p.weight
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.sales_order_id = ?
    """, (delivery["sales_order_id"],)).fetchall()

    conn.close()
    return {
        "company": company,
        "delivery": dict(delivery),
        "items": [dict(i) for i in items],
        "type": "delivery_note"
    }


# ── Customer Statement (bonus — useful for accountant) ──
@router.get("/statement/{customer_id}")
def get_customer_statement(customer_id: int, from_date: str = "", to_date: str = ""):
    conn = get_db()
    company = get_company_info(conn)

    customer = conn.execute("SELECT * FROM customers WHERE id=?", (customer_id,)).fetchone()
    if not customer:
        raise HTTPException(404, "Customer not found")

    date_filter = ""
    params = [customer_id]
    if from_date:
        date_filter += " AND so.order_date >= ?"
        params.append(from_date)
    if to_date:
        date_filter += " AND so.order_date <= ?"
        params.append(to_date)

    orders = conn.execute(f"""
        SELECT so.id, so.order_number, so.order_date, so.total_amount, so.status
        FROM sales_orders so WHERE so.customer_id=? {date_filter}
        ORDER BY so.order_date ASC
    """, params).fetchall()

    conn.close()

    entries = []
    running_balance = 0
    for o in orders:
        o = dict(o)
        if o["status"] in ("confirmed", "shipped", "delivered", "invoiced"):
            running_balance += o["total_amount"] or 0
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
        "customer": dict(customer),
        "entries": entries,
        "opening_balance": 0,
        "closing_balance": round(running_balance, 3),
        "from_date": from_date or "Beginning",
        "to_date": to_date or datetime.now().strftime("%Y-%m-%d"),
        "type": "statement"
    }
