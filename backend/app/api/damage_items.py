"""
Damage Items API — Phase 31
Track damaged goods with stock deduction and journal entries.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
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


class DamageItemCreate(BaseModel):
    date: str
    product_id: int
    warehouse_id: Optional[int] = None
    quantity: float
    reason: Optional[str] = None
    batch_number: Optional[str] = None


@router.get("/damage-items")
def list_damage_items(from_date: Optional[str] = None, to_date: Optional[str] = None,
                      product_id: Optional[int] = None):
    where = ["1=1"]
    params: dict = {}
    if from_date:
        where.append("d.date >= :from_date")
        params["from_date"] = from_date
    if to_date:
        where.append("d.date <= :to_date")
        params["to_date"] = to_date
    if product_id:
        where.append("d.product_id = :product_id")
        params["product_id"] = product_id
    wc = " AND ".join(where)
    try:
        rows = run_q(f"""
            SELECT d.id, d.date, d.product_id, p.name as product_name, p.sku,
                   w.name as warehouse_name, d.quantity, d.unit_cost,
                   ROUND(d.quantity * d.unit_cost, 3) as total_value,
                   d.reason, d.batch_number, d.created_at
            FROM damage_items d
            JOIN products p ON d.product_id = p.id
            LEFT JOIN warehouses w ON d.warehouse_id = w.id
            WHERE {wc}
            ORDER BY d.date DESC, d.id DESC
        """, params)
    except Exception:
        rows = []
    total_qty = sum(float(r['quantity'] or 0) for r in rows)
    total_value = sum(float(r['total_value'] or 0) for r in rows)
    return {
        "items": rows,
        "total": len(rows),
        "total_qty": round(total_qty, 3),
        "total_value": round(total_value, 3),
    }


@router.post("/damage-items")
def create_damage_item(data: DamageItemCreate):
    if data.quantity <= 0:
        raise HTTPException(400, "Quantity must be positive")

    # Get product cost
    products = run_q("SELECT id, name, standard_cost FROM products WHERE id = :id", {"id": data.product_id})
    if not products:
        raise HTTPException(404, "Product not found")
    product = products[0]
    unit_cost = round(float(product['standard_cost'] or 0), 3)
    total_value = round(unit_cost * data.quantity, 3)

    # Determine warehouse
    wh_id = data.warehouse_id
    if not wh_id:
        whs = run_q("SELECT id FROM warehouses WHERE is_active = true ORDER BY id LIMIT 1")
        wh_id = whs[0]['id'] if whs else None

    with engine.begin() as conn:
        # 1. Insert damage record
        result = conn.execute(text("""
            INSERT INTO damage_items (date, product_id, warehouse_id, quantity, unit_cost, reason, batch_number)
            VALUES (:date, :product_id, :wh_id, :qty, :cost, :reason, :batch)
            RETURNING id
        """), {
            "date": data.date, "product_id": data.product_id, "wh_id": wh_id,
            "qty": data.quantity, "cost": unit_cost,
            "reason": data.reason, "batch": data.batch_number,
        })
        damage_id = result.fetchone()[0]

        # 2. Deduct from stock_levels
        if wh_id:
            conn.execute(text("""
                UPDATE stock_levels
                SET quantity_on_hand = quantity_on_hand - :qty,
                    quantity_available = quantity_available - :qty
                WHERE product_id = :pid AND warehouse_id = :wid
            """), {"qty": data.quantity, "pid": data.product_id, "wid": wh_id})

        # 3. Create inventory transaction
        conn.execute(text("""
            INSERT INTO inventory_transactions
                (product_id, warehouse_id, transaction_type, quantity,
                 unit_cost, total_cost, reference_type, reference_id,
                 reference_number, notes, transaction_date)
            VALUES (:pid, :wid, 'damage', :qty,
                    :cost, :total, 'damage', :did,
                    :ref, :notes, :date)
        """), {
            "pid": data.product_id, "wid": wh_id, "qty": -abs(data.quantity),
            "cost": unit_cost, "total": total_value, "did": damage_id,
            "ref": f"DMG-{damage_id}", "notes": data.reason or "Damage write-off",
            "date": data.date,
        })

        # 4. Create journal entry: DR Damage Expense (6600), CR Inventory (1310)
        try:
            je_result = conn.execute(text("""
                INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id)
                VALUES (:num, :date, :desc, 'DAMAGE', :did)
                RETURNING id
            """), {
                "num": f"JE-DMG-{damage_id}", "date": data.date,
                "desc": f"Damage write-off: {product['name']} x{data.quantity}",
                "did": damage_id,
            })
            je_id = je_result.fetchone()[0]

            # Debit: Damage Expense
            conn.execute(text("""
                INSERT INTO journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
                VALUES (:je_id, '6600', 'Damage & Write-off', :amount, 0, :desc)
            """), {"je_id": je_id, "amount": total_value, "desc": f"Damage: {product['name']}"})

            # Credit: Inventory
            conn.execute(text("""
                INSERT INTO journal_entry_lines (journal_entry_id, account_code, account_name, debit_amount, credit_amount, description)
                VALUES (:je_id, '1310', 'Inventory', 0, :amount, :desc)
            """), {"je_id": je_id, "amount": total_value, "desc": f"Damage: {product['name']}"})
        except Exception:
            pass  # Journal entry creation is best-effort

    return {
        "message": f"Damage recorded: {product['name']} x{data.quantity}",
        "id": damage_id,
        "value": total_value,
    }


@router.get("/damage-items/summary")
def damage_summary():
    try:
        rows = run_q("""
            SELECT p.name, p.sku, SUM(d.quantity) as total_qty,
                   SUM(ROUND(d.quantity * d.unit_cost, 3)) as total_value,
                   COUNT(*) as incidents
            FROM damage_items d
            JOIN products p ON d.product_id = p.id
            GROUP BY d.product_id, p.name, p.sku
            ORDER BY total_value DESC
        """)
        return {"summary": rows, "total": len(rows)}
    except Exception:
        return {"summary": [], "total": 0}
