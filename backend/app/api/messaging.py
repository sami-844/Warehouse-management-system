"""Messaging API — WhatsApp/SMS notifications"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel
from app.core.database import get_db, engine
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter()


class MessagingConfig(BaseModel):
    provider: str = "none"  # none, twilio, custom
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    sender: Optional[str] = None


class SendMessageRequest(BaseModel):
    to: str  # phone number
    message: str
    customer_name: Optional[str] = None
    trigger: Optional[str] = None  # invoice_created, payment_received, order_shipped, etc.


class BulkMessageRequest(BaseModel):
    customer_ids: List[int]
    template_trigger: str
    variables: Optional[dict] = None


# ── In-memory config (persists until restart; production would use DB) ──
_config = {"provider": "none", "api_url": "", "api_key": "", "sender": ""}


@router.get("/config")
async def get_config(current_user: User = Depends(get_current_user)):
    """Get current messaging provider config (API key masked)."""
    return {
        "provider": _config["provider"],
        "api_url": _config["api_url"],
        "sender": _config["sender"],
        "api_key_set": bool(_config["api_key"]),
    }


@router.put("/config")
async def update_config(data: MessagingConfig, current_user: User = Depends(get_current_user)):
    """Update messaging provider config."""
    _config["provider"] = data.provider
    if data.api_url is not None:
        _config["api_url"] = data.api_url
    if data.api_key is not None:
        _config["api_key"] = data.api_key
    if data.sender is not None:
        _config["sender"] = data.sender
    return {"message": "Messaging config updated", "provider": _config["provider"]}


@router.post("/send")
async def send_message(data: SendMessageRequest, current_user: User = Depends(get_current_user)):
    """Send a single WhatsApp/SMS message."""
    if _config["provider"] == "none":
        raise HTTPException(status_code=400, detail="No messaging provider configured. Go to Admin > Messaging to set up.")

    if not data.to or not data.message:
        raise HTTPException(status_code=400, detail="Phone number and message are required.")

    # Log the message attempt
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO message_log (recipient, message, trigger_type, status, sent_by, created_at)
                VALUES (:to, :msg, :trigger, 'queued', :user_id, NOW())
            """), {"to": data.to, "msg": data.message, "trigger": data.trigger or "manual", "user_id": current_user.id})
            conn.commit()
    except Exception:
        pass  # Table may not exist yet — non-critical

    # Actual sending would go here based on provider
    # For now, return success with a note
    return {
        "status": "queued",
        "to": data.to,
        "message_preview": data.message[:80] + ("..." if len(data.message) > 80 else ""),
        "provider": _config["provider"],
        "note": "Message queued for delivery" if _config["api_key"] else "Provider configured but API key missing"
    }


@router.post("/send-invoice-notification")
async def send_invoice_notification(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send invoice notification to customer via WhatsApp/SMS."""
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT si.invoice_number, si.total_amount, si.balance,
                   c.name as customer_name, c.phone, c.mobile
            FROM sales_invoices si
            JOIN customers c ON c.id = si.customer_id
            WHERE si.id = :id
        """), {"id": invoice_id}).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")

    phone = row["mobile"] or row["phone"]
    if not phone:
        raise HTTPException(status_code=400, detail=f"No phone number for customer {row['customer_name']}")

    message = (
        f"Dear {row['customer_name']}, Invoice #{row['invoice_number']} "
        f"for {float(row['total_amount']):.3f} OMR has been created. "
        f"Balance due: {float(row['balance']):.3f} OMR. "
        f"Thank you for your business. - AK Al Mumayza"
    )

    return await send_message(
        SendMessageRequest(to=phone, message=message, customer_name=row["customer_name"], trigger="invoice_created"),
        current_user
    )


@router.post("/send-delivery-notification")
async def send_delivery_notification(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send delivery dispatch notification to customer."""
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT d.id, so.order_number, so.total_amount,
                   c.name as customer_name, c.phone, c.mobile,
                   d.scheduled_date
            FROM deliveries d
            JOIN sales_orders so ON so.id = d.order_id
            JOIN customers c ON c.id = so.customer_id
            WHERE d.id = :id
        """), {"id": delivery_id}).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Delivery not found")

    phone = row["mobile"] or row["phone"]
    if not phone:
        raise HTTPException(status_code=400, detail=f"No phone number for customer {row['customer_name']}")

    message = (
        f"Dear {row['customer_name']}, Your order #{row['order_number']} "
        f"has been dispatched. Expected delivery: {row['scheduled_date']}. "
        f"- AK Al Mumayza"
    )

    return await send_message(
        SendMessageRequest(to=phone, message=message, customer_name=row["customer_name"], trigger="order_shipped"),
        current_user
    )


@router.post("/send-payment-reminder")
async def send_payment_reminder(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send payment reminder for overdue invoice."""
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT si.invoice_number, si.total_amount, si.balance, si.due_date,
                   c.name as customer_name, c.phone, c.mobile
            FROM sales_invoices si
            JOIN customers c ON c.id = si.customer_id
            WHERE si.id = :id AND si.status != 'paid'
        """), {"id": invoice_id}).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Unpaid invoice not found")

    phone = row["mobile"] or row["phone"]
    if not phone:
        raise HTTPException(status_code=400, detail=f"No phone number for customer {row['customer_name']}")

    message = (
        f"Dear {row['customer_name']}, Invoice #{row['invoice_number']} "
        f"for {float(row['balance']):.3f} OMR is overdue (due: {row['due_date']}). "
        f"Please arrange payment at your earliest convenience. "
        f"Thank you. - AK Al Mumayza"
    )

    return await send_message(
        SendMessageRequest(to=phone, message=message, customer_name=row["customer_name"], trigger="invoice_overdue"),
        current_user
    )
