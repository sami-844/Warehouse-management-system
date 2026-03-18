"""
Dashboard Summary API — Phase 32
Consolidated endpoint for all dashboard widget data.
"""
from fastapi import APIRouter
from datetime import date, timedelta
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


@router.get("/summary")
def dashboard_summary():
    result = {}

    # ── Invoice Summary ──
    try:
        row = run_q("""
            SELECT COUNT(*) as cnt,
                   COALESCE(SUM(total_amount), 0) as total_amount,
                   COALESCE(SUM(amount_paid), 0) as paid_amount
            FROM sales_invoices
        """)
        r = row[0] if row else {}
        total = float(r.get("total_amount", 0))
        paid = float(r.get("paid_amount", 0))
        result["invoice_summary"] = {
            "total_amount": round(total, 3),
            "count": r.get("cnt", 0),
            "paid_amount": round(paid, 3),
            "paid_pct": round(paid / total * 100, 1) if total > 0 else 0,
        }
    except Exception:
        result["invoice_summary"] = {"total_amount": 0, "count": 0, "paid_amount": 0, "paid_pct": 0}

    # ── Entity Counts ──
    try:
        customers = run_s("SELECT COUNT(*) FROM customers WHERE is_active = true")
    except Exception:
        customers = 0
    try:
        vendors = run_s("SELECT COUNT(*) FROM suppliers WHERE is_active = true")
    except Exception:
        vendors = 0
    try:
        products = run_s("SELECT COUNT(*) FROM products WHERE is_active = true")
    except Exception:
        products = 0
    result["counts"] = {"customers": customers, "vendors": vendors, "products": products}

    # ── Expense Breakdown (last 30 days) ──
    try:
        d30 = (date.today() - timedelta(days=30)).isoformat()
        expenses = run_q("""
            SELECT a.name as category, COALESCE(SUM(ABS(jel.amount)), 0) as amount
            FROM journal_entry_lines jel
            JOIN accounts a ON jel.account_id = a.id
            JOIN journal_entries je ON jel.journal_entry_id = je.id
            WHERE a.account_type IN ('Expense', 'COGS')
              AND je.entry_date >= :d30
            GROUP BY a.name
            ORDER BY amount DESC
            LIMIT 5
        """, {"d30": d30})
        total_exp = sum(float(e["amount"]) for e in expenses)
        result["expense_breakdown"] = {
            "total": round(total_exp, 3),
            "items": [{"category": e["category"], "amount": round(float(e["amount"]), 3)} for e in expenses],
        }
    except Exception:
        result["expense_breakdown"] = {"total": 0, "items": []}

    # ── Overdue Invoices (top 5) ──
    try:
        today_str = date.today().isoformat()
        overdue = run_q("""
            SELECT si.id, si.invoice_number, c.name as customer_name,
                   si.due_date, (si.total_amount - si.amount_paid) as balance
            FROM sales_invoices si
            JOIN customers c ON si.customer_id = c.id
            WHERE si.status != 'paid' AND si.due_date < :today
            ORDER BY si.due_date ASC
            LIMIT 5
        """, {"today": today_str})
        today_d = date.today()
        result["overdue_invoices"] = [{
            "id": r["id"],
            "invoice_number": r["invoice_number"],
            "customer_name": r["customer_name"],
            "days_overdue": (today_d - (r["due_date"] if isinstance(r["due_date"], date) else date.fromisoformat(str(r["due_date"])[:10]))).days,
            "amount": round(float(r["balance"]), 3),
        } for r in overdue]
    except Exception:
        result["overdue_invoices"] = []

    # ── Payable Bills (top 5 due soon) ──
    try:
        payable = run_q("""
            SELECT pi.id, pi.invoice_number as bill_number, s.name as vendor_name,
                   pi.due_date, (pi.total_amount - pi.amount_paid) as balance
            FROM purchase_invoices pi
            JOIN suppliers s ON pi.supplier_id = s.id
            WHERE pi.status != 'paid'
            ORDER BY pi.due_date ASC
            LIMIT 5
        """)
        result["payable_bills"] = [{
            "id": r["id"],
            "vendor_name": r["vendor_name"],
            "bill_number": r["bill_number"],
            "due_date": str(r["due_date"])[:10] if r["due_date"] else "",
            "amount": round(float(r["balance"]), 3),
        } for r in payable]
    except Exception:
        result["payable_bills"] = []

    # ── Cash Flow (last 12 months) ──
    try:
        months = []
        today_d = date.today()
        for i in range(11, -1, -1):
            m_start = date(today_d.year, today_d.month, 1) - timedelta(days=i * 30)
            m_start = date(m_start.year, m_start.month, 1)
            if m_start.month == 12:
                m_end = date(m_start.year + 1, 1, 1) - timedelta(days=1)
            else:
                m_end = date(m_start.year, m_start.month + 1, 1) - timedelta(days=1)
            months.append((m_start, m_end))

        cash_flow = []
        for m_start, m_end in months:
            cash_in = run_s("""
                SELECT COALESCE(SUM(amount), 0) FROM payments
                WHERE payment_type = 'customer' AND payment_date BETWEEN :s AND :e
            """, {"s": m_start.isoformat(), "e": m_end.isoformat()})
            cash_out = run_s("""
                SELECT COALESCE(SUM(amount), 0) FROM payments
                WHERE payment_type = 'supplier' AND payment_date BETWEEN :s AND :e
            """, {"s": m_start.isoformat(), "e": m_end.isoformat()})
            cash_flow.append({
                "month": m_start.strftime("%b %y"),
                "cash_in": round(float(cash_in), 3),
                "cash_out": round(float(cash_out), 3),
            })
        result["cash_flow"] = cash_flow
    except Exception:
        result["cash_flow"] = []

    # ── Bank Balances ──
    try:
        banks = run_q("""
            SELECT account_name as name, account_type as type,
                   current_balance as balance, currency
            FROM bank_accounts
            WHERE is_active = true
            ORDER BY is_default DESC, account_name
        """)
        result["bank_balances"] = [{
            "name": b["name"],
            "type": b["type"],
            "balance": round(float(b["balance"]), 3),
        } for b in banks]
    except Exception:
        result["bank_balances"] = []

    # ── Expiry Alerts Count ──
    try:
        d90 = (date.today() + timedelta(days=90)).isoformat()
        result["expiry_alerts_count"] = run_s("""
            SELECT COUNT(*) FROM batch_inventory
            WHERE status = 'active' AND quantity_remaining > 0
              AND expiry_date IS NOT NULL AND expiry_date <= :d90
        """, {"d90": d90})
    except Exception:
        result["expiry_alerts_count"] = 0

    return result


@router.get("/search")
def global_search(q: str = ""):
    """Search across products, customers, suppliers, invoices, POs, and SOs."""
    if not q or len(q.strip()) < 2:
        return {"results": [], "query": q}

    term = f"%{q.strip()}%"
    results = []

    # Products
    try:
        rows = run_q("""
            SELECT id, name, sku, barcode, 'product' as entity_type
            FROM products
            WHERE is_active = true AND COALESCE(is_deleted, false) = false
              AND (name ILIKE :q OR sku ILIKE :q OR barcode ILIKE :q)
            LIMIT 8
        """, {"q": term})
        for r in rows:
            results.append({
                "id": r["id"], "type": "product",
                "title": r["name"],
                "subtitle": f"SKU: {r['sku'] or '—'}",
                "page": "products",
            })
    except Exception:
        pass

    # Customers
    try:
        rows = run_q("""
            SELECT id, name, code, phone, 'customer' as entity_type
            FROM customers
            WHERE is_active = true AND (name ILIKE :q OR code ILIKE :q OR phone ILIKE :q)
            LIMIT 8
        """, {"q": term})
        for r in rows:
            results.append({
                "id": r["id"], "type": "customer",
                "title": r["name"],
                "subtitle": f"Code: {r['code'] or '—'}",
                "page": "customers",
            })
    except Exception:
        pass

    # Suppliers
    try:
        rows = run_q("""
            SELECT id, name, code, 'supplier' as entity_type
            FROM suppliers
            WHERE is_active = true AND (name ILIKE :q OR code ILIKE :q)
            LIMIT 5
        """, {"q": term})
        for r in rows:
            results.append({
                "id": r["id"], "type": "supplier",
                "title": r["name"],
                "subtitle": f"Code: {r['code'] or '—'}",
                "page": "suppliers",
            })
    except Exception:
        pass

    # Sales Invoices
    try:
        rows = run_q("""
            SELECT si.id, si.invoice_number, si.total_amount, c.name as customer_name
            FROM sales_invoices si
            LEFT JOIN customers c ON si.customer_id = c.id
            WHERE si.invoice_number ILIKE :q OR c.name ILIKE :q
            LIMIT 5
        """, {"q": term})
        for r in rows:
            results.append({
                "id": r["id"], "type": "invoice",
                "title": r["invoice_number"],
                "subtitle": f"{r['customer_name'] or '—'} — OMR {float(r['total_amount'] or 0):.3f}",
                "page": "sales-invoices",
            })
    except Exception:
        pass

    # Sales Orders
    try:
        rows = run_q("""
            SELECT so.id, so.order_number, so.total_amount, c.name as customer_name
            FROM sales_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            WHERE so.order_number ILIKE :q OR c.name ILIKE :q
            LIMIT 5
        """, {"q": term})
        for r in rows:
            results.append({
                "id": r["id"], "type": "sales_order",
                "title": r["order_number"],
                "subtitle": f"{r['customer_name'] or '—'} — OMR {float(r['total_amount'] or 0):.3f}",
                "page": "sales-orders",
            })
    except Exception:
        pass

    # Purchase Orders
    try:
        rows = run_q("""
            SELECT po.id, po.po_number, po.total_amount, s.name as supplier_name
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            WHERE po.po_number ILIKE :q OR s.name ILIKE :q
            LIMIT 5
        """, {"q": term})
        for r in rows:
            results.append({
                "id": r["id"], "type": "purchase_order",
                "title": r["po_number"],
                "subtitle": f"{r['supplier_name'] or '—'} — OMR {float(r['total_amount'] or 0):.3f}",
                "page": "purchase-orders",
            })
    except Exception:
        pass

    return {"results": results, "query": q, "total": len(results)}
