"""
Customer Collections & Aging Router — Phase 43
Tracks outstanding payments, aging buckets, and WhatsApp reminders.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from app.core.database import get_db
from app.api.auth import get_current_user
from datetime import datetime, date
from urllib.parse import quote

router = APIRouter(tags=["Collections"])


@router.get('/aging')
async def get_aging_report(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Customer aging report.
    For each customer with outstanding balance, calculate:
    - Total outstanding
    - How much falls in each aging bucket (0-30, 31-60, 61-90, 90+)
    """
    today = date.today()

    rows = db.execute(sql_text("""
        SELECT
            i.id as invoice_id,
            i.invoice_number,
            i.customer_id,
            c.name as customer_name,
            c.phone as customer_phone,
            c.area as customer_area,
            i.total_amount,
            i.amount_paid,
            (i.total_amount - COALESCE(i.amount_paid, 0)) as outstanding,
            i.created_at,
            COALESCE(i.due_date, i.invoice_date) as due_date
        FROM sales_invoices i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.total_amount > COALESCE(i.amount_paid, 0)
          AND COALESCE(i.status, '') NOT IN ('cancelled', 'credit_note')
        ORDER BY c.name, i.created_at
    """)).fetchall()

    customer_map = {}
    for r in rows:
        inv = dict(r._mapping)
        cid = inv['customer_id']
        if cid not in customer_map:
            customer_map[cid] = {
                'customer_id': cid,
                'customer_name': inv['customer_name'],
                'customer_phone': inv['customer_phone'] or '',
                'customer_area': inv['customer_area'] or '',
                'total_outstanding': 0,
                'bucket_0_30': 0,
                'bucket_31_60': 0,
                'bucket_61_90': 0,
                'bucket_90_plus': 0,
                'invoice_count': 0,
                'oldest_invoice_date': str(inv['created_at'] or '')[:10],
                'invoices': []
            }

        outstanding = float(inv['outstanding'] or 0)
        customer_map[cid]['total_outstanding'] += outstanding
        customer_map[cid]['invoice_count'] += 1

        # Calculate days overdue
        try:
            due = datetime.fromisoformat(str(inv['due_date'])[:10]).date()
        except Exception:
            due = today
        days_overdue = (today - due).days

        if days_overdue <= 30:
            customer_map[cid]['bucket_0_30'] += outstanding
        elif days_overdue <= 60:
            customer_map[cid]['bucket_31_60'] += outstanding
        elif days_overdue <= 90:
            customer_map[cid]['bucket_61_90'] += outstanding
        else:
            customer_map[cid]['bucket_90_plus'] += outstanding

        customer_map[cid]['invoices'].append({
            'invoice_id': inv['invoice_id'],
            'invoice_number': inv['invoice_number'],
            'outstanding': round(outstanding, 3),
            'due_date': str(inv['due_date'] or '')[:10],
            'days_overdue': max(0, days_overdue),
        })

    customers = list(customer_map.values())
    customers.sort(key=lambda x: x['bucket_90_plus'] + x['bucket_61_90'], reverse=True)

    for c in customers:
        c['total_outstanding'] = round(c['total_outstanding'], 3)
        c['bucket_0_30'] = round(c['bucket_0_30'], 3)
        c['bucket_31_60'] = round(c['bucket_31_60'], 3)
        c['bucket_61_90'] = round(c['bucket_61_90'], 3)
        c['bucket_90_plus'] = round(c['bucket_90_plus'], 3)

    summary = {
        'total_receivables': round(sum(c['total_outstanding'] for c in customers), 3),
        'current_0_30': round(sum(c['bucket_0_30'] for c in customers), 3),
        'overdue_31_60': round(sum(c['bucket_31_60'] for c in customers), 3),
        'late_61_90': round(sum(c['bucket_61_90'] for c in customers), 3),
        'very_late_90_plus': round(sum(c['bucket_90_plus'] for c in customers), 3),
        'customer_count': len(customers),
    }

    return {'summary': summary, 'customers': customers}


@router.get('/whatsapp-message/{customer_id}')
async def get_whatsapp_message(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Generate a WhatsApp payment reminder message for a customer."""
    row = db.execute(sql_text(
        "SELECT * FROM customers WHERE id = :cid"
    ), {"cid": customer_id}).fetchone()
    if not row:
        return {'message': '', 'phone': ''}
    customer = dict(row._mapping)

    inv_rows = db.execute(sql_text("""
        SELECT invoice_number, total_amount, amount_paid,
               (total_amount - COALESCE(amount_paid, 0)) as outstanding,
               created_at
        FROM sales_invoices
        WHERE customer_id = :cid
          AND total_amount > COALESCE(amount_paid, 0)
          AND COALESCE(status, '') NOT IN ('cancelled', 'credit_note')
        ORDER BY created_at
    """), {"cid": customer_id}).fetchall()

    invoices = [dict(r._mapping) for r in inv_rows]
    total = sum(float(inv.get('outstanding') or 0) for inv in invoices)
    invoice_list = '\n'.join([
        f"- {inv['invoice_number']}: {float(inv.get('outstanding') or 0):.3f} OMR"
        for inv in invoices
    ])

    message = (
        f"Dear {customer.get('name', '')},\n\n"
        f"This is a payment reminder from Al Mumayza Trading.\n\n"
        f"Outstanding invoices:\n{invoice_list}\n\n"
        f"Total Due: *{total:.3f} OMR*\n\n"
        f"Please arrange payment at your earliest convenience.\n"
        f"Thank you for your business."
    )

    phone = (customer.get('phone') or '').replace(' ', '').replace('+', '')
    if phone and not phone.startswith('968'):
        phone = '968' + phone

    return {
        'message': message,
        'phone': phone,
        'whatsapp_url': f"https://wa.me/{phone}?text={quote(message)}"
    }
