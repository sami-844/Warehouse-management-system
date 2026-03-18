"""
Fawtara E-Invoicing Router — Oman Tax Authority (OTA) Preparation
Phase 46 — Hash chain, XML archive, credit notes, compliance dashboard
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text, desc
from app.core.database import get_db, engine
from app.api.auth import get_current_user
from app.services.fawtara import generate_invoice_xml, generate_invoice_hash
import json
import base64
import hashlib
from datetime import datetime

router = APIRouter(tags=["Fawtara E-Invoicing"])


def _run_q(sql, params={}):
    with engine.connect() as conn:
        result = conn.execute(sql_text(sql), params)
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


def _run_s(sql, params={}):
    with engine.connect() as conn:
        result = conn.execute(sql_text(sql), params)
        row = result.fetchone()
        return row[0] if row and row[0] is not None else None


def _build_fawtara_json(invoice: dict, company_settings: dict, line_items: list) -> dict:
    """Build the Fawtara-compliant invoice JSON structure."""
    created_at = invoice.get('created_at') or invoice.get('invoice_date') or ''
    created_str = str(created_at) if created_at else ''
    issue_date = created_str[:10] if len(created_str) >= 10 else ''
    issue_time = created_str[11:19] if len(created_str) >= 19 else '00:00:00'

    inv_type = invoice.get('invoice_type', 'standard') or 'standard'
    type_code = "381" if inv_type == 'credit_note' else "388"

    return {
        "invoiceTypeCode": type_code,
        "invoiceTypeTransaction": "0200000",
        "id": invoice.get('invoice_number', ''),
        "issueDate": issue_date,
        "issueTime": issue_time,
        "note": invoice.get('notes', '') or '',
        "documentCurrencyCode": "OMR",
        "taxCurrencyCode": "OMR",
        "seller": {
            "registrationName": company_settings.get('company_name', 'Al Mumayza Trading'),
            "taxIdentificationNumber": company_settings.get('company_vat_number', '') or company_settings.get('company_tax_id', '') or '',
            "crNumber": company_settings.get('company_cr_number', '') or '',
            "address": {
                "streetName": company_settings.get('company_address', ''),
                "cityName": company_settings.get('company_city', 'Muscat'),
                "postalZone": company_settings.get('company_postal_code', ''),
                "country": "OM"
            }
        },
        "buyer": {
            "registrationName": invoice.get('customer_name', ''),
            "taxIdentificationNumber": invoice.get('buyer_vat_number', '') or '',
            "address": {"country": "OM"}
        },
        "taxTotal": {
            "taxAmount": round(float(invoice.get('tax_amount', 0) or 0), 3),
            "taxSubtotal": {
                "taxableAmount": round(float(invoice.get('subtotal', 0) or 0), 3),
                "taxAmount": round(float(invoice.get('tax_amount', 0) or 0), 3),
                "taxCategory": {"id": "S", "percent": 5, "taxScheme": "VAT"}
            }
        },
        "legalMonetaryTotal": {
            "lineExtensionAmount": round(float(invoice.get('subtotal', 0) or 0), 3),
            "taxExclusiveAmount": round(float(invoice.get('subtotal', 0) or 0), 3),
            "taxInclusiveAmount": round(float(invoice.get('total_amount', 0) or 0), 3),
            "allowanceTotalAmount": round(float(invoice.get('discount_amount', 0) or 0), 3),
            "payableAmount": round(float(invoice.get('total_amount', 0) or 0), 3)
        },
        "invoiceLines": [
            {
                "id": str(i + 1),
                "invoicedQuantity": round(float(item.get('quantity', 0) or 0), 3),
                "lineExtensionAmount": round(float(item.get('line_total', 0) or 0), 3),
                "item": {
                    "name": item.get('product_name', ''),
                    "classifiedTaxCategory": {"id": "S", "percent": 5, "taxScheme": "VAT"}
                },
                "price": {"priceAmount": round(float(item.get('unit_price', 0) or 0), 3)}
            }
            for i, item in enumerate(line_items)
        ]
    }


def _generate_qr_code_data(invoice_data: dict) -> str:
    """Generate TLV-encoded QR code data per Fawtara spec."""
    def tlv(tag: int, value: str) -> bytes:
        encoded = value.encode('utf-8')
        return bytes([tag, len(encoded)]) + encoded

    seller_name = invoice_data.get('seller', {}).get('registrationName', '')
    vat_number = invoice_data.get('seller', {}).get('taxIdentificationNumber', '')
    timestamp = invoice_data.get('issueDate', '') + 'T' + invoice_data.get('issueTime', '00:00:00')
    total = str(invoice_data.get('legalMonetaryTotal', {}).get('taxInclusiveAmount', 0))
    vat_amount = str(invoice_data.get('taxTotal', {}).get('taxAmount', 0))

    tlv_data = (
        tlv(1, seller_name) +
        tlv(2, vat_number) +
        tlv(3, timestamp) +
        tlv(4, total) +
        tlv(5, vat_amount)
    )
    return base64.b64encode(tlv_data).decode('utf-8')


def _get_previous_invoice_hash(db, invoice_id: int) -> str:
    """Get the SHA-256 hash of the most recent invoice before this one (hash chain)."""
    row = db.execute(sql_text("""
        SELECT invoice_hash FROM sales_invoices
        WHERE id < :inv_id AND invoice_hash IS NOT NULL
        ORDER BY id DESC LIMIT 1
    """), {"inv_id": invoice_id}).fetchone()
    return row[0] if row else "0" * 64  # Genesis hash for the very first invoice


# ===============================================
# PREPARE — Generate XML, hash chain, QR, archive
# ===============================================
@router.post('/prepare/{invoice_id}')
async def prepare_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Prepare an invoice for Fawtara submission:
    1. Build compliant JSON + UBL 2.1 XML
    2. Compute SHA-256 hash and chain to previous invoice
    3. Generate TLV QR code data
    4. Store XML archive, hash, QR, and JSON
    Status becomes 'ready'
    """
    row = db.execute(sql_text("""
        SELECT si.*, c.name as customer_name
        FROM sales_invoices si
        LEFT JOIN customers c ON si.customer_id = c.id
        WHERE si.id = :inv_id
    """), {"inv_id": invoice_id}).fetchone()
    if not row:
        raise HTTPException(404, 'Invoice not found')

    invoice = dict(row._mapping)

    # Load line items
    items_rows = db.execute(sql_text("""
        SELECT soi.quantity_ordered as quantity, soi.unit_price,
               soi.discount_percent, p.name as product_name,
               (soi.quantity_ordered * soi.unit_price * (1 - COALESCE(soi.discount_percent, 0) / 100.0)) as line_total
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.sales_order_id = :so_id
    """), {"so_id": invoice.get('sales_order_id')}).fetchall()
    line_items = [dict(r._mapping) for r in items_rows]

    # Load company settings
    try:
        settings_rows = db.execute(sql_text(
            "SELECT setting_key, setting_value FROM company_settings"
        )).fetchall()
        company_settings = {r.setting_key: r.setting_value for r in settings_rows}
    except Exception:
        company_settings = {}

    # Build Fawtara JSON
    fawtara_json = _build_fawtara_json(invoice, company_settings, line_items)

    # Generate UBL 2.1 XML
    company_data = {
        "name": company_settings.get('company_name', 'Al Mumayza Trading'),
        "vat_number": company_settings.get('company_vat_number', '') or company_settings.get('company_tax_id', '') or '',
        "address": company_settings.get('company_address', ''),
        "city": company_settings.get('company_city', 'Muscat'),
    }
    invoice_data_for_xml = {
        "invoice_number": invoice.get('invoice_number', ''),
        "invoice_date": str(invoice.get('invoice_date', '')),
        "due_date": str(invoice.get('due_date', '')),
        "customer_name": invoice.get('customer_name', ''),
        "customer_vat": invoice.get('buyer_vat_number', '') or '',
        "subtotal": float(invoice.get('subtotal', 0) or 0),
        "vat_amount": float(invoice.get('tax_amount', 0) or 0),
        "total_amount": float(invoice.get('total_amount', 0) or 0),
        "items": [
            {
                "description": item.get('product_name', ''),
                "quantity": float(item.get('quantity', 0) or 0),
                "unit_price": float(item.get('unit_price', 0) or 0),
                "tax_rate": 5,
                "line_total": float(item.get('line_total', 0) or 0),
            }
            for item in line_items
        ]
    }
    xml_string = generate_invoice_xml(invoice_data_for_xml, company_data)

    # Hash chain
    invoice_hash = generate_invoice_hash(xml_string)
    previous_hash = _get_previous_invoice_hash(db, invoice_id)

    # QR code
    qr_data = _generate_qr_code_data(fawtara_json)

    # UUID
    import uuid as uuid_lib
    fawtara_uuid = str(uuid_lib.uuid4())

    # Save everything
    db.execute(sql_text("""
        UPDATE sales_invoices SET
           fawtara_status = 'ready',
           fawtara_uuid = :uuid,
           qr_code_data = :qr,
           fawtara_response = :resp,
           fawtara_xml = :xml,
           invoice_hash = :hash,
           previous_invoice_hash = :prev_hash
        WHERE id = :inv_id
    """), {
        "uuid": fawtara_uuid,
        "qr": qr_data,
        "resp": json.dumps(fawtara_json),
        "xml": xml_string,
        "hash": invoice_hash,
        "prev_hash": previous_hash,
        "inv_id": invoice_id
    })
    db.commit()

    return {
        'message': 'Invoice prepared for Fawtara',
        'invoice_id': invoice_id,
        'fawtara_uuid': fawtara_uuid,
        'invoice_hash': invoice_hash,
        'previous_invoice_hash': previous_hash,
        'qr_code_data': qr_data,
        'status': 'ready'
    }


# ===============================================
# SUBMIT — Simulation (real ASP integration later)
# ===============================================
@router.post('/submit/{invoice_id}')
async def submit_to_fawtara(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Submit invoice to Fawtara OTA — SIMULATION MODE until ASP credentials are available."""
    row = db.execute(sql_text(
        "SELECT fawtara_status, fawtara_uuid FROM sales_invoices WHERE id = :inv_id"
    ), {"inv_id": invoice_id}).fetchone()
    if not row:
        raise HTTPException(404, 'Invoice not found')

    if row.fawtara_status not in ('ready', 'failed'):
        raise HTTPException(400, f'Invoice status is "{row.fawtara_status}". Must be "ready" first — call /prepare.')

    # -- SIMULATION MODE --
    import uuid as uuid_lib
    ota_response = {
        'uuid': row.fawtara_uuid or str(uuid_lib.uuid4()),
        'status': 'ACCEPTED',
        'message': 'SIMULATION — Invoice accepted (ASP not yet connected)',
        'timestamp': datetime.utcnow().isoformat()
    }

    db.execute(sql_text("""
        UPDATE sales_invoices SET
           fawtara_status = 'submitted',
           fawtara_submitted_at = :submitted_at,
           fawtara_response = :resp
        WHERE id = :inv_id
    """), {
        "submitted_at": datetime.utcnow().isoformat(),
        "resp": json.dumps(ota_response),
        "inv_id": invoice_id
    })
    db.commit()

    return {
        'message': 'Invoice submitted to Fawtara (simulation)',
        'uuid': ota_response['uuid'],
        'status': 'submitted',
        'ota_response': ota_response
    }


# ===============================================
# DOWNLOAD XML — archived invoice XML
# ===============================================
@router.get('/xml/{invoice_id}')
async def download_xml(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Download the archived UBL 2.1 XML for an invoice."""
    row = db.execute(sql_text(
        "SELECT invoice_number, fawtara_xml FROM sales_invoices WHERE id = :inv_id"
    ), {"inv_id": invoice_id}).fetchone()
    if not row:
        raise HTTPException(404, 'Invoice not found')
    if not row.fawtara_xml:
        raise HTTPException(400, 'Invoice has not been prepared for Fawtara yet. Call /prepare first.')

    return Response(
        content=row.fawtara_xml,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="fawtara_{row.invoice_number}.xml"'}
    )


# ===============================================
# DASHBOARD — compliance overview
# ===============================================
@router.get('/dashboard')
async def fawtara_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Fawtara compliance dashboard — counts by status + recent invoices."""
    # Status counts
    status_rows = _run_q("""
        SELECT COALESCE(fawtara_status, 'pending') as status, COUNT(*) as count
        FROM sales_invoices
        GROUP BY fawtara_status
        ORDER BY count DESC
    """)
    status_counts = {r['status']: r['count'] for r in status_rows}

    # Total invoices
    total = sum(status_counts.values())

    # Recent invoices with Fawtara info
    recent = _run_q("""
        SELECT si.id, si.invoice_number, si.invoice_date, si.total_amount,
               si.fawtara_status, si.fawtara_uuid, si.invoice_hash,
               si.fawtara_submitted_at, c.name as customer_name
        FROM sales_invoices si
        LEFT JOIN customers c ON si.customer_id = c.id
        ORDER BY si.id DESC
        LIMIT 50
    """)

    # Hash chain integrity check (verify chain is unbroken)
    hash_check = _run_q("""
        SELECT id, invoice_number, invoice_hash, previous_invoice_hash
        FROM sales_invoices
        WHERE invoice_hash IS NOT NULL
        ORDER BY id
    """)
    chain_valid = True
    chain_errors = []
    for i, row in enumerate(hash_check):
        if i == 0:
            continue
        prev = hash_check[i - 1]
        if row['previous_invoice_hash'] != prev['invoice_hash']:
            chain_valid = False
            chain_errors.append(f"Break at {row['invoice_number']}: expected {prev['invoice_hash'][:12]}..., got {(row['previous_invoice_hash'] or 'NULL')[:12]}...")

    return {
        "total_invoices": total,
        "status_counts": status_counts,
        "compliance_rate": round((status_counts.get('submitted', 0) + status_counts.get('ready', 0)) / total * 100, 1) if total > 0 else 0,
        "hash_chain_valid": chain_valid,
        "hash_chain_errors": chain_errors,
        "recent_invoices": [{
            "id": r["id"],
            "invoice_number": r["invoice_number"],
            "invoice_date": str(r["invoice_date"]) if r["invoice_date"] else None,
            "total_amount": round(float(r["total_amount"] or 0), 3),
            "customer_name": r["customer_name"] or "Unknown",
            "fawtara_status": r["fawtara_status"] or "pending",
            "fawtara_uuid": r["fawtara_uuid"],
            "invoice_hash": (r["invoice_hash"] or "")[:16] + "..." if r.get("invoice_hash") else None,
            "submitted_at": r["fawtara_submitted_at"],
        } for r in recent],
    }


# ===============================================
# BULK PREPARE — prepare all pending invoices
# ===============================================
@router.post('/prepare-all')
async def prepare_all_pending(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Prepare all invoices that haven't been prepared yet."""
    pending = _run_q("""
        SELECT id FROM sales_invoices
        WHERE fawtara_status IS NULL OR fawtara_status = 'pending'
        ORDER BY id
    """)
    prepared = 0
    errors = []
    for row in pending:
        try:
            await prepare_invoice(row['id'], db, current_user)
            prepared += 1
        except Exception as e:
            errors.append({"invoice_id": row['id'], "error": str(e)})

    return {
        "message": f"Prepared {prepared} invoices",
        "prepared": prepared,
        "errors": errors,
    }


# ===============================================
# STATUS endpoint (kept for backward compat)
# ===============================================
@router.get('/status')
async def get_fawtara_status(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get counts of invoices by Fawtara status."""
    rows = db.execute(sql_text("""
        SELECT COALESCE(fawtara_status, 'pending') as status, COUNT(*) as count
        FROM sales_invoices
        GROUP BY fawtara_status
    """)).fetchall()
    return {r.status: r.count for r in rows}
