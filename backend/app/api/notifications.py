"""
Email Notifications API — Phase 5c
Sends alerts for low stock, overdue payments, expiring stock.
Configurable SMTP settings. Can be triggered manually or via scheduled endpoint.
Migrated from SQLite3 to SQLAlchemy (PostgreSQL compatible).
"""
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta
from sqlalchemy import text
from app.core.database import engine
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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


def get_smtp_settings() -> dict:
    """Read SMTP settings from notification_settings table."""
    try:
        rows = run_q("SELECT setting_key, setting_value FROM notification_settings")
        return {r["setting_key"]: r["setting_value"] for r in rows}
    except Exception:
        return {}


def send_email(settings: dict, to_emails, subject: str, html_body: str):
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


def log_notification(ntype, recipients, subject, body, status, error="", entity_type="", entity_id=0):
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO notification_log
                (notification_type, recipient_email, subject, body, status, error_message,
                 related_entity_type, related_entity_id, sent_at)
                VALUES (:ntype, :recip, :subj, :body, :status, :error, :etype, :eid, :sent_at)
            """), {
                "ntype": ntype, "recip": recipients, "subj": subject,
                "body": body[:500], "status": status, "error": error,
                "etype": entity_type, "eid": entity_id,
                "sent_at": datetime.now().isoformat() if status == "sent" else None,
            })
    except Exception:
        pass  # notification_log table may not exist


# ── Get/Update Settings ──
@router.get("/settings")
def get_notification_settings():
    settings = get_smtp_settings()
    if settings.get("smtp_password"):
        settings["smtp_password"] = "••••••••"
    return settings


class NotifSettingsUpdate(BaseModel):
    settings: dict


@router.put("/settings")
def update_notification_settings(data: NotifSettingsUpdate):
    try:
        with engine.begin() as conn:
            for key, value in data.settings.items():
                if key == "smtp_password" and value == "••••••••":
                    continue
                conn.execute(text("""
                    INSERT INTO notification_settings (setting_key, setting_value, updated_at)
                    VALUES (:key, :val, CURRENT_TIMESTAMP)
                    ON CONFLICT(setting_key) DO UPDATE SET setting_value=:val, updated_at=CURRENT_TIMESTAMP
                """), {"key": key, "val": value})
        return {"message": "Settings updated"}
    except Exception as e:
        raise HTTPException(503, f"notification_settings table may not be set up: {str(e)}")


# ── Test SMTP Connection ──
@router.post("/test")
def test_smtp_connection(email: str = Query(...)):
    settings = get_smtp_settings()
    result = send_email(settings, [email], "WMS Test Email",
        "<h2>SMTP Connection Successful</h2><p>Your warehouse notification system is configured correctly.</p>")
    if result is True:
        return {"message": f"Test email sent to {email}"}
    raise HTTPException(400, f"SMTP failed: {result}")


# ── Trigger: Low Stock Alert ──
@router.post("/trigger/low-stock")
def trigger_low_stock_alert(background_tasks: BackgroundTasks):
    settings = get_smtp_settings()

    if settings.get("notify_low_stock") != "true":
        return {"message": "Low stock notifications disabled"}

    recipients = [e.strip() for e in settings.get("low_stock_recipients", "").split(",") if e.strip()]
    if not recipients:
        return {"message": "No recipients configured for low stock alerts"}

    threshold = 10
    try:
        val = run_s("SELECT setting_value FROM company_settings WHERE setting_key='low_stock_threshold'")
        if val:
            threshold = int(val)
    except Exception:
        pass

    # Use stock_levels (PostgreSQL-compatible, no HAVING without GROUP BY)
    try:
        low_items = run_q("""
            SELECT p.name, p.sku, COALESCE(sl.current_stock, 0) as current_stock
            FROM products p
            LEFT JOIN (
                SELECT product_id, SUM(quantity_on_hand) as current_stock
                FROM stock_levels GROUP BY product_id
            ) sl ON sl.product_id = p.id
            WHERE COALESCE(sl.current_stock, 0) < :threshold
              AND COALESCE(sl.current_stock, 0) >= 0
              AND p.is_active = true
            ORDER BY current_stock ASC LIMIT 50
        """, {"threshold": threshold})
    except Exception:
        low_items = []

    if not low_items:
        return {"message": "No low stock items found"}

    rows_html = "".join(
        f"<tr><td>{i['name']}</td><td>{i['sku']}</td>"
        f"<td style='color:red;font-weight:bold'>{i['current_stock']}</td></tr>"
        for i in low_items
    )
    html = f"""
    <h2 style="color:#c0392b">Low Stock Alert</h2>
    <p>{len(low_items)} product(s) below threshold ({threshold} units):</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial">
    <tr style="background:#c0392b;color:white"><th>Product</th><th>SKU</th><th>Current Stock</th></tr>
    {rows_html}</table>
    <p style="color:#888;font-size:12px">Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} — AK Al Momaiza WMS</p>
    """

    result = send_email(settings, recipients, f"Low Stock Alert — {len(low_items)} items", html)
    status = "sent" if result is True else "failed"
    log_notification("low_stock", ",".join(recipients),
                     f"Low Stock Alert — {len(low_items)} items", html, status,
                     str(result) if result is not True else "")
    return {"message": f"Low stock alert {status}", "items_count": len(low_items)}


# ── Trigger: Overdue Payment Alert ──
@router.post("/trigger/overdue-payments")
def trigger_overdue_payments():
    settings = get_smtp_settings()

    if settings.get("notify_overdue_payments") != "true":
        return {"message": "Overdue payment notifications disabled"}

    recipients = [e.strip() for e in settings.get("payment_recipients", "").split(",") if e.strip()]
    if not recipients:
        return {"message": "No recipients for payment alerts"}

    today = date.today().isoformat()
    overdue = []
    try:
        overdue = run_q("""
            SELECT si.invoice_number, si.due_date, si.total_amount, si.amount_paid,
                   c.name as customer_name, c.phone
            FROM sales_invoices si
            JOIN customers c ON si.customer_id = c.id
            WHERE si.status NOT IN ('paid', 'cancelled') AND si.due_date < :today
            ORDER BY si.due_date ASC LIMIT 50
        """, {"today": today})
    except Exception:
        pass

    if not overdue:
        return {"message": "No overdue invoices"}

    rows_html = "".join(
        f"<tr><td>{i['customer_name']}</td><td>{i['invoice_number']}</td><td>{i['due_date']}</td>"
        f"<td style='text-align:right'>{i['total_amount']}</td>"
        f"<td style='text-align:right;color:red'>{round(float(i['total_amount'] or 0) - float(i['amount_paid'] or 0), 3)}</td></tr>"
        for i in overdue
    )
    total_overdue = sum(float(i["total_amount"] or 0) - float(i["amount_paid"] or 0) for i in overdue)
    html = f"""
    <h2 style="color:#e67e22">Overdue Payment Alert</h2>
    <p>{len(overdue)} invoice(s) past due. Total outstanding: <strong>OMR {round(total_overdue, 3)}</strong></p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial">
    <tr style="background:#e67e22;color:white"><th>Customer</th><th>Invoice</th><th>Due Date</th><th>Total</th><th>Outstanding</th></tr>
    {rows_html}</table>
    <p style="color:#888;font-size:12px">Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} — AK Al Momaiza WMS</p>
    """

    result = send_email(settings, recipients, f"Overdue Payments — OMR {round(total_overdue, 3)}", html)
    status = "sent" if result is True else "failed"
    log_notification("overdue_payments", ",".join(recipients),
                     f"Overdue Payments — {len(overdue)} invoices", html, status,
                     str(result) if result is not True else "")
    return {"message": f"Overdue payment alert {status}", "invoices_count": len(overdue)}


# ── Trigger: Expiring Stock Alert ──
@router.post("/trigger/expiring-stock")
def trigger_expiring_stock():
    settings = get_smtp_settings()

    if settings.get("notify_expiring_stock") != "true":
        return {"message": "Expiry notifications disabled"}

    recipients = [e.strip() for e in settings.get("expiry_recipients", "").split(",") if e.strip()]
    if not recipients:
        return {"message": "No recipients for expiry alerts"}

    cutoff = (date.today() + timedelta(days=30)).isoformat()
    expiring = []
    try:
        expiring = run_q("""
            SELECT bi.batch_number, bi.expiry_date, bi.quantity_remaining,
                   p.name as product_name, p.sku
            FROM batch_inventory bi
            JOIN products p ON bi.product_id = p.id
            WHERE bi.status='active' AND bi.quantity_remaining > 0
              AND bi.expiry_date IS NOT NULL AND bi.expiry_date <= :cutoff
            ORDER BY bi.expiry_date ASC LIMIT 50
        """, {"cutoff": cutoff})
    except Exception:
        pass

    if not expiring:
        return {"message": "No stock expiring within 30 days"}

    rows_html = "".join(
        f"<tr><td>{i['product_name']}</td><td>{i['sku']}</td><td>{i['batch_number']}</td>"
        f"<td>{i['expiry_date']}</td><td>{i['quantity_remaining']}</td></tr>"
        for i in expiring
    )
    html = f"""
    <h2 style="color:#e74c3c">Stock Expiry Alert</h2>
    <p>{len(expiring)} batch(es) expiring within 30 days:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial">
    <tr style="background:#e74c3c;color:white"><th>Product</th><th>SKU</th><th>Batch</th><th>Expiry</th><th>Qty</th></tr>
    {rows_html}</table>
    <p style="color:#888;font-size:12px">Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
    """

    result = send_email(settings, recipients, f"Expiring Stock — {len(expiring)} batches", html)
    status = "sent" if result is True else "failed"
    log_notification("expiring_stock", ",".join(recipients),
                     f"Expiring Stock — {len(expiring)} batches", html, status,
                     str(result) if result is not True else "")
    return {"message": f"Expiry alert {status}", "batches_count": len(expiring)}


# ── Email Invoice to Customer ──
@router.post("/email-invoice")
def email_invoice(invoice_id: int = Query(...)):
    settings = get_smtp_settings()
    if not settings.get("smtp_host") or not settings.get("smtp_username"):
        raise HTTPException(400, "SMTP not configured. Go to Admin > Notifications to set up email.")

    # Fetch invoice + customer
    try:
        rows = run_q("""
            SELECT si.invoice_number, si.invoice_date, si.due_date, si.status,
                   si.total_amount, si.amount_paid,
                   (si.total_amount - si.amount_paid) as balance,
                   c.name as customer_name, c.email as customer_email
            FROM sales_invoices si
            JOIN customers c ON si.customer_id = c.id
            WHERE si.id = :iid
        """, {"iid": invoice_id})
    except Exception as e:
        raise HTTPException(500, f"Database error: {str(e)}")

    if not rows:
        raise HTTPException(404, "Invoice not found")

    inv = rows[0]
    email = inv.get("customer_email")
    if not email:
        raise HTTPException(400, f"No email on file for {inv['customer_name']}")

    # Fetch line items (optional — table may not exist)
    items_html = ""
    try:
        items = run_q("""
            SELECT sii.quantity, sii.unit_price, sii.discount_percent,
                   p.name as product_name, p.sku
            FROM sales_invoice_items sii
            JOIN products p ON sii.product_id = p.id
            WHERE sii.invoice_id = :iid
            ORDER BY sii.id
        """, {"iid": invoice_id})
        if items:
            item_rows = "".join(
                f"<tr><td>{it['product_name']}</td><td>{it['sku']}</td>"
                f"<td style='text-align:center'>{it['quantity']}</td>"
                f"<td style='text-align:right'>{round(float(it['unit_price']), 3)}</td>"
                f"<td style='text-align:center'>{it.get('discount_percent', 0)}%</td>"
                f"<td style='text-align:right'>{round(float(it['quantity']) * float(it['unit_price']) * (1 - float(it.get('discount_percent', 0)) / 100), 3)}</td></tr>"
                for it in items
            )
            items_html = f"""
            <h3 style="color:#1a2332;margin-top:20px">Items</h3>
            <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial;width:100%">
            <tr style="background:#f1f5f9"><th>Product</th><th>SKU</th><th>Qty</th><th>Price</th><th>Disc</th><th>Total</th></tr>
            {item_rows}</table>
            """
    except Exception:
        pass

    total = round(float(inv["total_amount"] or 0), 3)
    paid = round(float(inv["amount_paid"] or 0), 3)
    balance = round(float(inv["balance"] or 0), 3)

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#1a2332;padding:20px;text-align:center">
        <h1 style="color:#D4A017;margin:0">AK Al Momaiza Trading</h1>
    </div>
    <div style="padding:20px;border:1px solid #e2e8f0">
        <h2 style="color:#1a2332">Invoice {inv['invoice_number']}</h2>
        <table style="width:100%;font-size:14px;margin-bottom:16px">
            <tr><td style="padding:4px 0;color:#64748b">Customer:</td><td style="font-weight:600">{inv['customer_name']}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b">Date:</td><td>{inv['invoice_date']}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b">Due Date:</td><td>{inv['due_date']}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b">Status:</td><td style="text-transform:uppercase;font-weight:600">{inv['status']}</td></tr>
        </table>
        {items_html}
        <div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:6px">
            <table style="width:100%;font-size:14px">
                <tr><td style="padding:4px 0">Total Amount:</td><td style="text-align:right;font-weight:600">{total} OMR</td></tr>
                <tr><td style="padding:4px 0">Amount Paid:</td><td style="text-align:right;color:#16a34a">{paid} OMR</td></tr>
                <tr style="font-size:16px"><td style="padding:8px 0;border-top:2px solid #e2e8f0;font-weight:700">Balance Due:</td>
                    <td style="text-align:right;border-top:2px solid #e2e8f0;font-weight:700;color:{'#dc2626' if balance > 0 else '#16a34a'}">{balance} OMR</td></tr>
            </table>
        </div>
    </div>
    <div style="padding:12px;text-align:center;color:#94a3b8;font-size:11px">
        AK Al Momaiza Trading &middot; Oman &middot; Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}
    </div>
    </div>
    """

    subject = f"Invoice {inv['invoice_number']} — {balance} OMR — AK Al Momaiza Trading"
    result = send_email(settings, [email], subject, html)
    status = "sent" if result is True else "failed"
    log_notification("invoice_email", email, subject, html, status,
                     str(result) if result is not True else "",
                     "sales_invoice", invoice_id)

    if result is True:
        return {"message": f"Invoice emailed to {email}", "status": "sent"}
    raise HTTPException(500, f"Email failed: {result}")


# ── Notification Log ──
@router.get("/log")
def notification_log(limit: int = 50, notification_type: str = ""):
    try:
        if notification_type:
            rows = run_q(
                "SELECT * FROM notification_log WHERE notification_type = :ntype ORDER BY created_at DESC LIMIT :lim",
                {"ntype": notification_type, "lim": limit}
            )
        else:
            rows = run_q(
                "SELECT * FROM notification_log ORDER BY created_at DESC LIMIT :lim",
                {"lim": limit}
            )
        return {"log": rows}
    except Exception:
        return {"log": []}
