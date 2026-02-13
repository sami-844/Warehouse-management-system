"""
Email Notifications API — Phase 5c
Sends alerts for low stock, overdue payments, expiring stock.
Configurable SMTP settings. Can be triggered manually or via scheduled endpoint.
"""
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta
import sqlite3, os, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter()
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "warehouse.db")


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def get_smtp_settings(conn):
    rows = conn.execute("SELECT setting_key, setting_value FROM notification_settings").fetchall()
    return {r["setting_key"]: r["setting_value"] for r in rows}


def send_email(settings, to_emails, subject, html_body):
    """Send email via SMTP. Returns True on success, error string on failure."""
    if not settings.get("smtp_host") or not settings.get("smtp_username"):
        return "SMTP not configured"
    if not to_emails:
        return "No recipients"

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.get('smtp_from_name', 'WMS')} <{settings.get('smtp_from_email', settings['smtp_username'])}>"
        msg["To"] = ", ".join(to_emails) if isinstance(to_emails, list) else to_emails
        msg.attach(MIMEText(html_body, "html"))

        port = int(settings.get("smtp_port", 587))
        with smtplib.SMTP(settings["smtp_host"], port) as server:
            server.starttls()
            server.login(settings["smtp_username"], settings["smtp_password"])
            recipients = to_emails if isinstance(to_emails, list) else [to_emails]
            server.sendmail(msg["From"], recipients, msg.as_string())
        return True
    except Exception as e:
        return str(e)


def log_notification(conn, ntype, recipients, subject, body, status, error="", entity_type="", entity_id=0):
    conn.execute("""
        INSERT INTO notification_log
        (notification_type, recipient_email, subject, body, status, error_message,
         related_entity_type, related_entity_id, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (ntype, recipients, subject, body[:500], status, error,
          entity_type, entity_id,
          datetime.now().isoformat() if status == "sent" else None))
    conn.commit()


# ── Get/Update Settings ──
@router.get("/settings")
def get_notification_settings():
    conn = get_db()
    settings = get_smtp_settings(conn)
    conn.close()
    # Mask password
    if settings.get("smtp_password"):
        settings["smtp_password"] = "••••••••"
    return settings


class NotifSettingsUpdate(BaseModel):
    settings: dict

@router.put("/settings")
def update_notification_settings(data: NotifSettingsUpdate):
    conn = get_db()
    for key, value in data.settings.items():
        if key == "smtp_password" and value == "••••••••":
            continue  # Don't overwrite masked password
        conn.execute("""
            INSERT INTO notification_settings (setting_key, setting_value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(setting_key) DO UPDATE SET setting_value=?, updated_at=CURRENT_TIMESTAMP
        """, (key, value, value))
    conn.commit()
    conn.close()
    return {"message": "Settings updated"}


# ── Test SMTP Connection ──
@router.post("/test")
def test_smtp_connection(email: str = Query(...)):
    conn = get_db()
    settings = get_smtp_settings(conn)
    conn.close()
    result = send_email(settings, [email], "WMS Test Email",
        "<h2>✅ SMTP Connection Successful</h2><p>Your warehouse notification system is configured correctly.</p>")
    if result is True:
        return {"message": f"Test email sent to {email}"}
    raise HTTPException(400, f"SMTP failed: {result}")


# ── Trigger: Low Stock Alert ──
@router.post("/trigger/low-stock")
def trigger_low_stock_alert(background_tasks: BackgroundTasks):
    conn = get_db()
    settings = get_smtp_settings(conn)

    if settings.get("notify_low_stock") != "true":
        conn.close()
        return {"message": "Low stock notifications disabled"}

    recipients = [e.strip() for e in settings.get("low_stock_recipients", "").split(",") if e.strip()]
    if not recipients:
        conn.close()
        return {"message": "No recipients configured for low stock alerts"}

    # Get low stock items
    try:
        threshold = int(conn.execute(
            "SELECT setting_value FROM company_settings WHERE setting_key='low_stock_threshold'"
        ).fetchone()[0])
    except:
        threshold = 10

    low_items = conn.execute("""
        SELECT p.name, p.sku, COALESCE(
            (SELECT SUM(CASE WHEN transaction_type='receipt' THEN quantity
                             WHEN transaction_type='issue' THEN -quantity ELSE 0 END)
             FROM inventory_transactions WHERE product_id = p.id), 0
        ) as current_stock
        FROM products p
        HAVING current_stock < ? AND current_stock >= 0
        ORDER BY current_stock ASC LIMIT 50
    """, (threshold,)).fetchall()

    if not low_items:
        conn.close()
        return {"message": "No low stock items found"}

    # Build HTML
    rows_html = "".join(
        f"<tr><td>{i['name']}</td><td>{i['sku']}</td><td style='color:red;font-weight:bold'>{i['current_stock']}</td></tr>"
        for i in low_items
    )
    html = f"""
    <h2 style="color:#c0392b">⚠️ Low Stock Alert</h2>
    <p>{len(low_items)} product(s) below threshold ({threshold} units):</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial">
    <tr style="background:#c0392b;color:white"><th>Product</th><th>SKU</th><th>Current Stock</th></tr>
    {rows_html}</table>
    <p style="color:#888;font-size:12px">Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} — AK Al Momaiza WMS</p>
    """

    result = send_email(settings, recipients, f"⚠️ Low Stock Alert — {len(low_items)} items", html)
    status = "sent" if result is True else "failed"
    log_notification(conn, "low_stock", ",".join(recipients),
                     f"Low Stock Alert — {len(low_items)} items", html, status,
                     str(result) if result is not True else "")
    conn.close()
    return {"message": f"Low stock alert {status}", "items_count": len(low_items)}


# ── Trigger: Overdue Payment Alert ──
@router.post("/trigger/overdue-payments")
def trigger_overdue_payments():
    conn = get_db()
    settings = get_smtp_settings(conn)

    if settings.get("notify_overdue_payments") != "true":
        conn.close()
        return {"message": "Overdue payment notifications disabled"}

    recipients = [e.strip() for e in settings.get("payment_recipients", "").split(",") if e.strip()]
    if not recipients:
        conn.close()
        return {"message": "No recipients for payment alerts"}

    today = date.today().isoformat()
    overdue = conn.execute("""
        SELECT si.invoice_number, si.due_date, si.total_amount, si.amount_paid,
               c.name as customer_name, c.phone
        FROM sales_invoices si
        JOIN customers c ON si.customer_id = c.id
        WHERE si.status NOT IN ('paid', 'cancelled') AND si.due_date < ?
        ORDER BY si.due_date ASC LIMIT 50
    """, (today,)).fetchall()

    if not overdue:
        conn.close()
        return {"message": "No overdue invoices"}

    rows_html = "".join(
        f"<tr><td>{i['customer_name']}</td><td>{i['invoice_number']}</td><td>{i['due_date']}</td>"
        f"<td style='text-align:right'>{i['total_amount']}</td>"
        f"<td style='text-align:right;color:red'>{round((i['total_amount'] or 0)-(i['amount_paid'] or 0),3)}</td></tr>"
        for i in overdue
    )
    total_overdue = sum((i["total_amount"] or 0) - (i["amount_paid"] or 0) for i in overdue)
    html = f"""
    <h2 style="color:#e67e22">💰 Overdue Payment Alert</h2>
    <p>{len(overdue)} invoice(s) past due. Total outstanding: <strong>OMR {round(total_overdue,3)}</strong></p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial">
    <tr style="background:#e67e22;color:white"><th>Customer</th><th>Invoice</th><th>Due Date</th><th>Total</th><th>Outstanding</th></tr>
    {rows_html}</table>
    <p style="color:#888;font-size:12px">Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} — AK Al Momaiza WMS</p>
    """

    result = send_email(settings, recipients, f"💰 Overdue Payments — OMR {round(total_overdue,3)}", html)
    status = "sent" if result is True else "failed"
    log_notification(conn, "overdue_payments", ",".join(recipients),
                     f"Overdue Payments — {len(overdue)} invoices", html, status,
                     str(result) if result is not True else "")
    conn.close()
    return {"message": f"Overdue payment alert {status}", "invoices_count": len(overdue)}


# ── Trigger: Expiring Stock Alert ──
@router.post("/trigger/expiring-stock")
def trigger_expiring_stock():
    conn = get_db()
    settings = get_smtp_settings(conn)

    if settings.get("notify_expiring_stock") != "true":
        conn.close()
        return {"message": "Expiry notifications disabled"}

    recipients = [e.strip() for e in settings.get("expiry_recipients", "").split(",") if e.strip()]
    if not recipients:
        conn.close()
        return {"message": "No recipients for expiry alerts"}

    cutoff = (date.today() + timedelta(days=30)).isoformat()
    expiring = conn.execute("""
        SELECT bi.batch_number, bi.expiry_date, bi.quantity_remaining,
               p.name as product_name, p.sku
        FROM batch_inventory bi
        JOIN products p ON bi.product_id = p.id
        WHERE bi.status='active' AND bi.quantity_remaining > 0
          AND bi.expiry_date IS NOT NULL AND bi.expiry_date <= ?
        ORDER BY bi.expiry_date ASC LIMIT 50
    """, (cutoff,)).fetchall()

    if not expiring:
        conn.close()
        return {"message": "No stock expiring within 30 days"}

    rows_html = "".join(
        f"<tr><td>{i['product_name']}</td><td>{i['sku']}</td><td>{i['batch_number']}</td>"
        f"<td>{i['expiry_date']}</td><td>{i['quantity_remaining']}</td></tr>"
        for i in expiring
    )
    html = f"""
    <h2 style="color:#e74c3c">⏰ Stock Expiry Alert</h2>
    <p>{len(expiring)} batch(es) expiring within 30 days:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial">
    <tr style="background:#e74c3c;color:white"><th>Product</th><th>SKU</th><th>Batch</th><th>Expiry</th><th>Qty</th></tr>
    {rows_html}</table>
    <p style="color:#888;font-size:12px">Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
    """

    result = send_email(settings, recipients, f"⏰ Expiring Stock — {len(expiring)} batches", html)
    status = "sent" if result is True else "failed"
    log_notification(conn, "expiring_stock", ",".join(recipients),
                     f"Expiring Stock — {len(expiring)} batches", html, status,
                     str(result) if result is not True else "")
    conn.close()
    return {"message": f"Expiry alert {status}", "batches_count": len(expiring)}


# ── Notification Log ──
@router.get("/log")
def notification_log(limit: int = 50, notification_type: str = ""):
    conn = get_db()
    where = "1=1"
    params = []
    if notification_type:
        where = "notification_type = ?"
        params = [notification_type]
    rows = conn.execute(f"""
        SELECT * FROM notification_log WHERE {where}
        ORDER BY created_at DESC LIMIT ?
    """, params + [limit]).fetchall()
    conn.close()
    return {"log": [dict(r) for r in rows]}
