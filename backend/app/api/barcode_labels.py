"""
Barcode Label Generator API — Phase 5c
Generates SVG barcodes for printing labels. No external dependencies.
Uses Code128B encoding rendered as SVG.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from sqlalchemy import text
from app.core.database import engine

router = APIRouter()


def run_q(sql: str, params: dict = {}):
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


# ── Code128B barcode encoding ──
CODE128B_START = 104
CODE128B_STOP = 106
CODE128B_PATTERNS = [
    "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
    "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
    "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
    "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
    "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
    "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
    "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
    "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
    "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
    "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
    "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
    "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
    "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
    "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
    "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
    "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
    "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
    "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
    "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
    "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
    "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
    "11010011100", "1100011101011",
]


def encode_code128(text_val):
    values = [CODE128B_START]
    for char in text_val:
        val = ord(char) - 32
        if 0 <= val <= 94:
            values.append(val)
    checksum = values[0]
    for i, val in enumerate(values[1:], 1):
        checksum += i * val
    checksum %= 103
    values.append(checksum)
    values.append(CODE128B_STOP)
    pattern = ""
    for val in values:
        pattern += CODE128B_PATTERNS[val]
    return pattern


def barcode_to_svg(text_val, width=200, height=60, show_text=True):
    pattern = encode_code128(text_val)
    bar_width = width / len(pattern)
    text_height = 16 if show_text else 0
    total_height = height + text_height + 4
    bars = ""
    for i, bit in enumerate(pattern):
        if bit == "1":
            x = round(i * bar_width, 2)
            w = round(bar_width, 2)
            bars += f'<rect x="{x}" y="0" width="{w}" height="{height}" fill="black"/>'
    text_svg = ""
    if show_text:
        text_svg = f'<text x="{width/2}" y="{height + text_height}" text-anchor="middle" font-family="monospace" font-size="12">{text_val}</text>'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{total_height}" '
        f'viewBox="0 0 {width} {total_height}">'
        f'<rect width="{width}" height="{total_height}" fill="white"/>'
        f'{bars}{text_svg}</svg>'
    )


# ── Generate Single Barcode ──
@router.get("/generate")
def generate_barcode(
    text: str = Query(...),
    width: int = Query(default=200),
    height: int = Query(default=60),
    show_text: bool = Query(default=True)
):
    if not text or len(text) > 50:
        raise HTTPException(400, "Text must be 1-50 characters")
    svg = barcode_to_svg(text, width, height, show_text)
    return {"barcode": text, "svg": svg}


# ── Generate Labels for Products ──
@router.get("/product-labels")
def product_labels(
    product_ids: str = Query(default=""),
    category_id: Optional[int] = None,
    limit: int = 50,
    label_size: str = Query(default="medium"),
):
    if product_ids:
        ids = [int(x.strip()) for x in product_ids.split(",") if x.strip().isdigit()]
        if not ids:
            products = []
        else:
            products = run_q(
                "SELECT id, name, sku, barcode, selling_price, unit_of_measure "
                "FROM products WHERE id = ANY(:ids)",
                {"ids": ids}
            )
    elif category_id:
        products = run_q(
            "SELECT id, name, sku, barcode, selling_price, unit_of_measure "
            "FROM products WHERE category_id = :cat LIMIT :lim",
            {"cat": category_id, "lim": limit}
        )
    else:
        products = run_q(
            "SELECT id, name, sku, barcode, selling_price, unit_of_measure "
            "FROM products WHERE is_active = true LIMIT :lim",
            {"lim": limit}
        )

    sizes = {
        "small":  {"w": 150, "h": 40, "cols": 4},
        "medium": {"w": 200, "h": 60, "cols": 3},
        "large":  {"w": 300, "h": 80, "cols": 2},
    }
    sz = sizes.get(label_size, sizes["medium"])

    labels = []
    for p in products:
        barcode_text = p.get("barcode") or p.get("sku") or f"P{p['id']}"
        svg = barcode_to_svg(barcode_text, sz["w"], sz["h"])
        labels.append({
            "product_id": p["id"],
            "product_name": p["name"],
            "sku": p["sku"],
            "barcode": barcode_text,
            "price": p.get("selling_price"),
            "unit": p.get("unit_of_measure"),
            "svg": svg,
        })

    return {"labels": labels, "total": len(labels), "columns": sz["cols"], "label_size": label_size}


# ── Generate Batch Labels (for FIFO) ──
@router.get("/batch-labels")
def batch_labels(batch_ids: str = Query(default="")):
    if not batch_ids:
        raise HTTPException(400, "Provide batch_ids (comma-separated)")
    ids = [int(x.strip()) for x in batch_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return {"labels": [], "total": 0}

    # batch_inventory table may not exist — graceful fallback
    try:
        batches = run_q("""
            SELECT bi.id, bi.batch_number, bi.expiry_date, bi.quantity_remaining,
                   p.name as product_name, p.sku
            FROM batch_inventory bi
            JOIN products p ON bi.product_id = p.id
            WHERE bi.id = ANY(:ids)
        """, {"ids": ids})
    except Exception:
        return {"labels": [], "total": 0}

    labels = []
    for b in batches:
        barcode_text = b["batch_number"] or f"BATCH-{b['id']}"
        svg = barcode_to_svg(barcode_text, 250, 60)
        labels.append({
            "batch_id": b["id"],
            "product_name": b["product_name"],
            "batch_number": barcode_text,
            "expiry_date": b["expiry_date"],
            "quantity": b["quantity_remaining"],
            "svg": svg,
        })
    return {"labels": labels, "total": len(labels)}
