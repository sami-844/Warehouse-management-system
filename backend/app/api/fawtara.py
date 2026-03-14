"""
Fawtara E-Invoicing Router — Oman Tax Authority (OTA) Preparation
Phase 41 — Prepare, Submit (simulation), and Status endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from app.core.database import get_db
from app.api.auth import get_current_user
import json
import base64
from datetime import datetime

router = APIRouter(tags=["Fawtara E-Invoicing"])


def build_fawtara_json(invoice: dict, company_settings: dict, line_items: list) -> dict:
    """
    Build the Fawtara-compliant invoice JSON structure.
    Based on OTA e-invoicing specifications for Oman.
    This format will be submitted to the OTA API when live.
    """
    created_at = invoice.get('created_at') or invoice.get('invoice_date') or ''
    created_str = str(created_at) if created_at else ''
    issue_date = created_str[:10] if len(created_str) >= 10 else ''
    issue_time = created_str[11:19] if len(created_str) >= 19 else '00:00:00'

    return {
        "invoiceTypeCode": "388",  # 388 = Tax Invoice, 381 = Credit Note
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
            "address": {
                "country": "OM"
            }
        },
        "taxTotal": {
            "taxAmount": round(float(invoice.get('tax_amount', 0) or 0), 3),
            "taxSubtotal": {
                "taxableAmount": round(float(invoice.get('subtotal', 0) or 0), 3),
                "taxAmount": round(float(invoice.get('tax_amount', 0) or 0), 3),
                "taxCategory": {
                    "id": "S",
                    "percent": 5,
                    "taxScheme": "VAT"
                }
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
                    "classifiedTaxCategory": {
                        "id": "S",
                        "percent": 5,
                        "taxScheme": "VAT"
                    }
                },
                "price": {
                    "priceAmount": round(float(item.get('unit_price', 0) or 0), 3)
                }
            }
            for i, item in enumerate(line_items)
        ]
    }


def generate_qr_code_data(invoice_data: dict) -> str:
    """
    Generate QR code data string per Fawtara spec.
    Format: base64 encoded TLV (Tag-Length-Value) structure.
    Tags: 1=seller name, 2=VAT number, 3=timestamp, 4=total, 5=VAT amount
    """
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


@router.post('/prepare/{invoice_id}')
async def prepare_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Prepare an invoice for Fawtara submission:
    1. Build the compliant JSON structure
    2. Generate the QR code data
    3. Save both to the invoice record
    Status becomes 'ready' — not yet submitted to OTA
    """
    # Load invoice with customer name
    row = db.execute(sql_text("""
        SELECT si.*, c.name as customer_name
        FROM sales_invoices si
        LEFT JOIN customers c ON si.customer_id = c.id
        WHERE si.id = :inv_id
    """), {"inv_id": invoice_id}).fetchone()
    if not row:
        raise HTTPException(404, 'Invoice not found')

    invoice = dict(row._mapping)

    # Load line items via sales order
    items_rows = db.execute(sql_text("""
        SELECT soi.quantity_ordered as quantity, soi.unit_price,
               soi.discount_percent, p.name as product_name,
               (soi.quantity_ordered * soi.unit_price * (1 - COALESCE(soi.discount_percent, 0) / 100.0)) as line_total
        FROM sales_order_items soi
        JOIN products p ON soi.product_id = p.id
        WHERE soi.sales_order_id = :so_id
    """), {"so_id": invoice.get('sales_order_id')}).fetchall()
    line_items = [dict(r._mapping) for r in items_rows]

    # Load company settings as key-value dict
    try:
        settings_rows = db.execute(sql_text(
            "SELECT setting_key, setting_value FROM company_settings"
        )).fetchall()
        company_settings = {r.setting_key: r.setting_value for r in settings_rows}
    except Exception:
        company_settings = {}

    # Build Fawtara JSON and QR code
    fawtara_json = build_fawtara_json(invoice, company_settings, line_items)
    qr_data = generate_qr_code_data(fawtara_json)

    # Save to invoice
    db.execute(sql_text("""
        UPDATE sales_invoices SET
           fawtara_status = 'ready',
           qr_code_data = :qr,
           fawtara_response = :resp
        WHERE id = :inv_id
    """), {"qr": qr_data, "resp": json.dumps(fawtara_json), "inv_id": invoice_id})
    db.commit()

    return {
        'message': 'Invoice prepared for Fawtara',
        'qr_code_data': qr_data,
        'fawtara_json': fawtara_json,
        'status': 'ready'
    }


@router.post('/submit/{invoice_id}')
async def submit_to_fawtara(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Submit invoice to Fawtara OTA API.
    Currently returns a simulation response.
    When OTA credentials are ready, replace the simulation block
    with a real HTTP call to the OTA endpoint.
    """
    row = db.execute(sql_text(
        "SELECT fawtara_status FROM sales_invoices WHERE id = :inv_id"
    ), {"inv_id": invoice_id}).fetchone()
    if not row:
        raise HTTPException(404, 'Invoice not found')

    status_val = row.fawtara_status
    if status_val not in ('ready', 'failed'):
        raise HTTPException(400, 'Invoice must be prepared first. Call /prepare first.')

    # ── SIMULATION MODE ──
    # When OTA API credentials are available, replace this block with:
    #
    # import httpx
    # async with httpx.AsyncClient() as client:
    #     response = await client.post(
    #         'https://api.fawtara.gov.om/invoices/submit',
    #         json=json.loads(invoice['fawtara_response']),
    #         headers={
    #             'Authorization': f'Bearer {OTA_API_KEY}',
    #             'Content-Type': 'application/json'
    #         }
    #     )
    #     ota_response = response.json()
    #     status = 'submitted' if response.status_code == 200 else 'failed'
    #     uuid_val = ota_response.get('uuid', '')
    # ── END SIMULATION ──

    import uuid as uuid_lib
    simulated_uuid = str(uuid_lib.uuid4())
    submit_status = 'submitted'
    ota_response = {
        'uuid': simulated_uuid,
        'status': 'ACCEPTED',
        'message': 'SIMULATION - Invoice accepted (OTA API not yet connected)',
        'timestamp': datetime.utcnow().isoformat()
    }

    db.execute(sql_text("""
        UPDATE sales_invoices SET
           fawtara_status = :status,
           fawtara_uuid = :uuid,
           fawtara_submitted_at = :submitted_at,
           fawtara_response = :resp
        WHERE id = :inv_id
    """), {
        "status": submit_status,
        "uuid": simulated_uuid,
        "submitted_at": datetime.utcnow().isoformat(),
        "resp": json.dumps(ota_response),
        "inv_id": invoice_id
    })
    db.commit()

    return {
        'message': 'Invoice submitted to Fawtara (simulation)',
        'uuid': simulated_uuid,
        'status': submit_status,
        'ota_response': ota_response
    }


@router.get('/status')
async def get_fawtara_status(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get counts of invoices by Fawtara status."""
    rows = db.execute(sql_text("""
        SELECT fawtara_status, COUNT(*) as count
        FROM sales_invoices
        GROUP BY fawtara_status
    """)).fetchall()
    return {(r.fawtara_status or 'pending'): r.count for r in rows}
