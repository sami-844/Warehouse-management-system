"""Reports API — All business reports"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date, timedelta
from sqlalchemy import text
from app.core.database import engine
from app.api.auth import get_current_user
from app.models.user import User

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


# ── Balance Sheet ──
@router.get("/balance-sheet")
async def balance_sheet(as_of_date: Optional[str] = None,
                        current_user: User = Depends(get_current_user)):
    """Balance Sheet as of a given date — Assets = Liabilities + Equity"""
    as_of = as_of_date or date.today().isoformat()

    def account_balance(account_type: str):
        """Sum journal entry lines for all accounts of a given type up to as_of date."""
        rows = run_q("""
            SELECT a.code, a.name,
                   COALESCE(SUM(jel.debit_amount), 0) as total_debit,
                   COALESCE(SUM(jel.credit_amount), 0) as total_credit
            FROM accounts a
            LEFT JOIN journal_entry_lines jel ON jel.account_code = a.code
            LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
                AND DATE(je.entry_date) <= :as_of
            WHERE a.account_type = :atype AND a.is_active = true
            GROUP BY a.code, a.name
            ORDER BY a.code
        """, {"atype": account_type, "as_of": as_of})
        return rows

    try:
        # Assets: debit-normal (balance = debits - credits)
        asset_rows = account_balance("Asset")
        assets = []
        total_assets = 0
        for r in asset_rows:
            bal = round(float(r["total_debit"] or 0) - float(r["total_credit"] or 0), 3)
            assets.append({"code": r["code"], "name": r["name"], "balance": bal})
            total_assets += bal

        # COGS: debit-normal
        cogs_rows = account_balance("COGS")
        for r in cogs_rows:
            bal = round(float(r["total_debit"] or 0) - float(r["total_credit"] or 0), 3)
            # COGS doesn't go on balance sheet, but we include for retained earnings calc

        # Liabilities: credit-normal (balance = credits - debits)
        liability_rows = account_balance("Liability")
        liabilities = []
        total_liabilities = 0
        for r in liability_rows:
            bal = round(float(r["total_credit"] or 0) - float(r["total_debit"] or 0), 3)
            liabilities.append({"code": r["code"], "name": r["name"], "balance": bal})
            total_liabilities += bal

        # Equity: credit-normal
        equity_rows = account_balance("Equity")
        equity_items = []
        total_equity_direct = 0
        for r in equity_rows:
            bal = round(float(r["total_credit"] or 0) - float(r["total_debit"] or 0), 3)
            equity_items.append({"code": r["code"], "name": r["name"], "balance": bal})
            total_equity_direct += bal

        # Retained Earnings = Income - Expenses - COGS (up to as_of date)
        income_rows = account_balance("Income")
        total_income = sum(round(float(r["total_credit"] or 0) - float(r["total_debit"] or 0), 3) for r in income_rows)

        expense_rows = account_balance("Expense")
        total_expenses = sum(round(float(r["total_debit"] or 0) - float(r["total_credit"] or 0), 3) for r in expense_rows)

        total_cogs = sum(round(float(r["total_debit"] or 0) - float(r["total_credit"] or 0), 3) for r in cogs_rows)

        retained_earnings = round(total_income - total_expenses - total_cogs, 3)
        equity_items.append({"code": "RE", "name": "Retained Earnings", "balance": retained_earnings})

        total_equity = round(total_equity_direct + retained_earnings, 3)

        return {
            "as_of_date": as_of,
            "assets": assets,
            "total_assets": round(total_assets, 3),
            "liabilities": liabilities,
            "total_liabilities": round(total_liabilities, 3),
            "equity": equity_items,
            "total_equity": total_equity,
            "total_liabilities_equity": round(total_liabilities + total_equity, 3),
            "is_balanced": abs(total_assets - (total_liabilities + total_equity)) < 0.01,
        }
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(500, f"Failed to generate balance sheet: {str(e)}")


# ── Trial Balance ──
@router.get("/trial-balance")
async def trial_balance(from_date: Optional[str] = None, to_date: Optional[str] = None,
                        current_user: User = Depends(get_current_user)):
    """Trial Balance — all accounts with debit/credit totals for a period."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()

    try:
        rows = run_q("""
            SELECT a.code, a.name, a.account_type,
                   COALESCE(SUM(jel.debit_amount), 0) as total_debit,
                   COALESCE(SUM(jel.credit_amount), 0) as total_credit
            FROM accounts a
            LEFT JOIN journal_entry_lines jel ON jel.account_code = a.code
            LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
                AND je.entry_date BETWEEN :start AND :end
            WHERE a.is_active = true
            GROUP BY a.code, a.name, a.account_type
            ORDER BY a.code
        """, {"start": start, "end": end})

        accounts = []
        grand_debit = 0
        grand_credit = 0
        for r in rows:
            debit = round(float(r["total_debit"] or 0), 3)
            credit = round(float(r["total_credit"] or 0), 3)
            net = round(debit - credit, 3)
            if debit == 0 and credit == 0:
                continue  # Skip accounts with no activity
            accounts.append({
                "code": r["code"],
                "name": r["name"],
                "account_type": r["account_type"],
                "debit": debit,
                "credit": credit,
                "net_balance": net,
            })
            grand_debit += debit
            grand_credit += credit

        return {
            "period": {"from": start, "to": end},
            "accounts": accounts,
            "total_debit": round(grand_debit, 3),
            "total_credit": round(grand_credit, 3),
            "difference": round(grand_debit - grand_credit, 3),
            "is_balanced": abs(grand_debit - grand_credit) < 0.01,
            "account_count": len(accounts),
        }
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(500, f"Failed to generate trial balance: {str(e)}")


# ── Cash Flow Statement ──
@router.get("/cash-flow")
async def cash_flow_statement(from_date: Optional[str] = None, to_date: Optional[str] = None,
                              current_user: User = Depends(get_current_user)):
    """Cash Flow Statement — cash inflows/outflows by activity type."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()

    try:
        # All journal lines that hit cash or bank accounts
        cash_lines = run_q("""
            SELECT jel.account_code, jel.debit_amount, jel.credit_amount,
                   jel.description, je.entry_date, je.reference_type, je.description as je_desc,
                   a.name as account_name, a.account_type
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            JOIN accounts a ON a.code = jel.account_code
            WHERE jel.account_code IN ('1110', '1120')
              AND je.entry_date BETWEEN :start AND :end
            ORDER BY je.entry_date
        """, {"start": start, "end": end})

        operating = []
        investing = []
        financing = []
        total_operating = 0
        total_investing = 0
        total_financing = 0

        for r in cash_lines:
            debit = float(r["debit_amount"] or 0)
            credit = float(r["credit_amount"] or 0)
            net = round(debit - credit, 3)  # positive = cash in, negative = cash out
            ref_type = (r["reference_type"] or "").upper()
            desc = r["je_desc"] or r["description"] or ""

            item = {
                "date": str(r["entry_date"]),
                "description": desc,
                "amount": net,
                "reference_type": ref_type,
            }

            # Classify by reference type
            if ref_type in ("ADVANCE_PAYMENT", "ADVANCE_APPLIED", "LOAN", "EQUITY"):
                financing.append(item)
                total_financing += net
            elif ref_type in ("ASSET_PURCHASE", "ASSET_SALE", "INVESTMENT"):
                investing.append(item)
                total_investing += net
            else:
                # Default: operating (sales, purchases, expenses, etc.)
                operating.append(item)
                total_operating += net

        # Opening and closing cash
        opening_cash = run_s("""
            SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE jel.account_code IN ('1110', '1120')
              AND je.entry_date < :start
        """, {"start": start})

        net_change = round(total_operating + total_investing + total_financing, 3)
        closing_cash = round(float(opening_cash) + net_change, 3)

        return {
            "period": {"from": start, "to": end},
            "operating": {
                "items": operating,
                "total": round(total_operating, 3),
            },
            "investing": {
                "items": investing,
                "total": round(total_investing, 3),
            },
            "financing": {
                "items": financing,
                "total": round(total_financing, 3),
            },
            "net_change_in_cash": net_change,
            "opening_cash_balance": round(float(opening_cash), 3),
            "closing_cash_balance": closing_cash,
        }
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(500, f"Failed to generate cash flow statement: {str(e)}")


# ── General Ledger ──
@router.get("/general-ledger")
async def general_ledger(account_code: str = Query(...),
                         from_date: Optional[str] = None, to_date: Optional[str] = None,
                         current_user: User = Depends(get_current_user)):
    """Transaction history for a single account with running balance."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()

    try:
        # Verify account exists
        acct = run_q("SELECT code, name, account_type FROM accounts WHERE code = :code", {"code": account_code})
        if not acct:
            from fastapi import HTTPException
            raise HTTPException(404, "Account not found")
        account = acct[0]
        is_debit_normal = account["account_type"] in ("Asset", "COGS", "Expense")

        # Opening balance: sum of all JE lines before start date
        opening_rows = run_q("""
            SELECT COALESCE(SUM(jel.debit_amount), 0) as total_debit,
                   COALESCE(SUM(jel.credit_amount), 0) as total_credit
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE jel.account_code = :code AND DATE(je.entry_date) < :start
        """, {"code": account_code, "start": start})

        if opening_rows:
            ob_debit = float(opening_rows[0]["total_debit"] or 0)
            ob_credit = float(opening_rows[0]["total_credit"] or 0)
        else:
            ob_debit = ob_credit = 0
        opening_balance = round((ob_debit - ob_credit) if is_debit_normal else (ob_credit - ob_debit), 3)

        # Transactions in period
        rows = run_q("""
            SELECT je.entry_number, je.entry_date, je.description as je_description,
                   je.reference_type, jel.description as line_description,
                   jel.debit_amount as debit, jel.credit_amount as credit
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE jel.account_code = :code
              AND DATE(je.entry_date) BETWEEN :start AND :end
            ORDER BY je.entry_date ASC, je.id ASC
        """, {"code": account_code, "start": start, "end": end})

        running = opening_balance
        transactions = []
        for r in rows:
            debit = round(float(r["debit"] or 0), 3)
            credit = round(float(r["credit"] or 0), 3)
            if is_debit_normal:
                running = round(running + debit - credit, 3)
            else:
                running = round(running + credit - debit, 3)
            transactions.append({
                "entry_number": r["entry_number"],
                "date": str(r["entry_date"])[:10],
                "description": r["line_description"] or r["je_description"] or "",
                "reference_type": r["reference_type"] or "",
                "debit": debit,
                "credit": credit,
                "balance": running,
            })

        total_debit = sum(t["debit"] for t in transactions)
        total_credit = sum(t["credit"] for t in transactions)

        return {
            "account": {"code": account["code"], "name": account["name"], "type": account["account_type"]},
            "period": {"from": start, "to": end},
            "opening_balance": opening_balance,
            "closing_balance": running,
            "total_debit": round(total_debit, 3),
            "total_credit": round(total_credit, 3),
            "transactions": transactions,
        }
    except Exception as e:
        if "HTTPException" in type(e).__name__:
            raise
        from fastapi import HTTPException
        raise HTTPException(500, f"Failed to load general ledger: {str(e)}")


# ── Vendor / Supplier Ledger ──
@router.get("/vendor-ledger")
async def vendor_ledger(supplier_id: int = Query(...),
                        from_date: Optional[str] = None, to_date: Optional[str] = None,
                        current_user: User = Depends(get_current_user)):
    """Per-supplier purchase invoices and payment history."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()

    try:
        supplier = run_q("SELECT id, code, name FROM suppliers WHERE id = :id", {"id": supplier_id})
        if not supplier:
            from fastapi import HTTPException
            raise HTTPException(404, "Supplier not found")
        sup = supplier[0]

        rows = run_q("""
            SELECT pi.invoice_number, pi.invoice_date as date,
                   pi.total_amount as total, pi.amount_paid as paid,
                   (pi.total_amount - pi.amount_paid) as balance,
                   pi.status
            FROM purchase_invoices pi
            WHERE pi.supplier_id = :sid AND pi.invoice_date BETWEEN :start AND :end
            ORDER BY pi.invoice_date ASC
        """, {"sid": supplier_id, "start": start, "end": end})

        grand_total = sum(float(r["total"] or 0) for r in rows)
        grand_paid = sum(float(r["paid"] or 0) for r in rows)

        data = [{
            "invoice": r["invoice_number"], "date": str(r["date"])[:10],
            "total": round(float(r["total"] or 0), 3),
            "paid": round(float(r["paid"] or 0), 3),
            "balance": round(float(r["balance"] or 0), 3),
            "status": r["status"],
        } for r in rows]

        return {
            "supplier": {"id": sup["id"], "code": sup["code"], "name": sup["name"]},
            "period": {"from": start, "to": end},
            "data": data,
            "grand_total": round(grand_total, 3),
            "grand_paid": round(grand_paid, 3),
            "grand_balance": round(grand_total - grand_paid, 3),
        }
    except Exception as e:
        if "HTTPException" in type(e).__name__:
            raise
        from fastapi import HTTPException
        raise HTTPException(500, f"Failed to load vendor ledger: {str(e)}")


@router.get("/sales-by-customer")
async def sales_by_customer(from_date: Optional[str] = None, to_date: Optional[str] = None,
                            current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = run_q("""
        SELECT c.code, c.name, c.area, COUNT(so.id) as orders,
               COALESCE(SUM(so.total_amount), 0) as revenue,
               COALESCE(SUM(so.discount_amount), 0) as discounts,
               COALESCE(SUM(so.tax_amount), 0) as tax
        FROM customers c
        LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.order_date BETWEEN :start AND :end
        WHERE c.is_active = true
        GROUP BY c.id, c.code, c.name, c.area
        ORDER BY revenue DESC
    """, {"start": start, "end": end})
    total_rev = sum(float(r['revenue'] or 0) for r in rows)
    return {
        "period": {"from": start, "to": end},
        "total_revenue": round(total_rev, 3),
        "data": [{
            "code": r['code'], "name": r['name'], "area": r['area'],
            "orders": r['orders'],
            "revenue": round(float(r['revenue'] or 0), 3),
            "discounts": round(float(r['discounts'] or 0), 3),
            "pct_of_total": round(float(r['revenue'] or 0) / total_rev * 100, 1) if total_rev > 0 else 0,
        } for r in rows],
    }


@router.get("/sales-by-product")
async def sales_by_product(from_date: Optional[str] = None, to_date: Optional[str] = None,
                           current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = run_q("""
        SELECT p.sku, p.name,
               COALESCE(SUM(soi.quantity_ordered), 0) as qty_sold,
               COALESCE(SUM(soi.total_price), 0) as revenue,
               COALESCE(SUM(soi.quantity_ordered * COALESCE(soi.unit_cost, 0)), 0) as cost
        FROM products p
        LEFT JOIN sales_order_items soi ON p.id = soi.product_id
        LEFT JOIN sales_orders so ON soi.sales_order_id = so.id AND so.order_date BETWEEN :start AND :end
        WHERE p.is_active = true AND (p.is_deleted = false OR p.is_deleted IS NULL)
        GROUP BY p.id, p.sku, p.name
        ORDER BY revenue DESC
    """, {"start": start, "end": end})
    return {
        "period": {"from": start, "to": end},
        "data": [{
            "sku": r['sku'], "name": r['name'], "qty_sold": r['qty_sold'],
            "revenue": round(float(r['revenue'] or 0), 3),
            "cost": round(float(r['cost'] or 0), 3),
            "profit": round(float(r['revenue'] or 0) - float(r['cost'] or 0), 3),
            "margin_pct": round(
                (float(r['revenue'] or 0) - float(r['cost'] or 0)) / float(r['revenue']) * 100, 1
            ) if float(r['revenue'] or 0) > 0 else 0,
        } for r in rows],
    }


@router.get("/purchase-by-supplier")
async def purchase_by_supplier(from_date: Optional[str] = None, to_date: Optional[str] = None,
                               current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    rows = run_q("""
        SELECT s.code, s.name, COUNT(po.id) as orders,
               COALESCE(SUM(po.total_amount), 0) as total,
               COALESCE(SUM(po.shipping_cost), 0) as freight
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.order_date BETWEEN :start AND :end
        WHERE s.is_active = true
        GROUP BY s.id, s.code, s.name
        ORDER BY total DESC
    """, {"start": start, "end": end})
    return {
        "period": {"from": start, "to": end},
        "data": [{
            "code": r['code'], "name": r['name'], "orders": r['orders'],
            "total": round(float(r['total'] or 0), 3),
            "freight": round(float(r['freight'] or 0), 3),
        } for r in rows],
    }


@router.get("/stock-valuation")
async def stock_valuation(current_user: User = Depends(get_current_user)):
    rows = run_q("""
        SELECT p.sku, p.name, p.unit_of_measure,
               COALESCE(p.standard_cost, 0) as unit_cost,
               COALESCE(p.selling_price, 0) as sell_price,
               COALESCE(SUM(sl.quantity_on_hand), 0) as qty_on_hand,
               COALESCE(SUM(sl.quantity_on_hand), 0) * COALESCE(p.standard_cost, 0) as stock_value,
               COALESCE(SUM(sl.quantity_on_hand), 0) * COALESCE(p.selling_price, 0) as retail_value
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        WHERE p.is_active = true AND (p.is_deleted = false OR p.is_deleted IS NULL)
        GROUP BY p.id, p.sku, p.name, p.unit_of_measure, p.standard_cost, p.selling_price
        ORDER BY stock_value DESC
    """)
    total_cost = sum(float(r['stock_value'] or 0) for r in rows)
    total_retail = sum(float(r['retail_value'] or 0) for r in rows)
    return {
        "total_cost_value": round(total_cost, 3),
        "total_retail_value": round(total_retail, 3),
        "potential_profit": round(total_retail - total_cost, 3),
        "data": [{
            "sku": r['sku'], "name": r['name'], "unit": r['unit_of_measure'],
            "unit_cost": round(float(r['unit_cost'] or 0), 3),
            "sell_price": round(float(r['sell_price'] or 0), 3),
            "qty": r['qty_on_hand'],
            "stock_value": round(float(r['stock_value'] or 0), 3),
            "retail_value": round(float(r['retail_value'] or 0), 3),
        } for r in rows],
    }


@router.get("/inventory-movements")
async def inventory_movements(from_date: Optional[str] = None, to_date: Optional[str] = None,
                              product_id: Optional[int] = None,
                              current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or (today - timedelta(days=30)).isoformat()
    end = to_date or today.isoformat()
    where = ["it.transaction_date BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end, "limit": 500}
    if product_id:
        where.append("it.product_id = :product_id")
        params["product_id"] = product_id
    rows = run_q(f"""
        SELECT it.transaction_date, it.transaction_type, it.quantity,
               it.reference_number, it.notes,
               p.name as product, w.name as warehouse
        FROM inventory_transactions it
        JOIN products p ON it.product_id = p.id
        JOIN warehouses w ON it.warehouse_id = w.id
        WHERE {" AND ".join(where)} AND (p.is_deleted = false OR p.is_deleted IS NULL)
        ORDER BY it.transaction_date DESC LIMIT :limit
    """, params)
    return {
        "period": {"from": start, "to": end},
        "count": len(rows),
        "data": [{
            "date": str(r['transaction_date']), "type": r['transaction_type'],
            "qty": r['quantity'], "product": r['product'], "warehouse": r['warehouse'],
            "reference": r['reference_number'], "notes": r['notes'],
        } for r in rows],
    }


@router.get("/dead-stock")
async def dead_stock(days: int = 90, current_user: User = Depends(get_current_user)):
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    rows = run_q("""
        SELECT p.sku, p.name,
               COALESCE(SUM(sl.quantity_on_hand), 0) as qty,
               COALESCE(SUM(sl.quantity_on_hand), 0) * COALESCE(p.standard_cost, 0) as value,
               MAX(it.transaction_date) as last_movement
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        LEFT JOIN inventory_transactions it ON p.id = it.product_id AND it.transaction_type = 'issue'
        WHERE p.is_active = true AND (p.is_deleted = false OR p.is_deleted IS NULL)
        GROUP BY p.id, p.sku, p.name, p.standard_cost
        HAVING COALESCE(SUM(sl.quantity_on_hand), 0) > 0
           AND (MAX(it.transaction_date) IS NULL OR MAX(it.transaction_date) < :cutoff)
        ORDER BY value DESC
    """, {"cutoff": cutoff})
    total = sum(float(r['value'] or 0) for r in rows)
    return {
        "threshold_days": days,
        "total_dead_stock_value": round(total, 3),
        "count": len(rows),
        "data": [{
            "sku": r['sku'], "name": r['name'], "qty": r['qty'],
            "value": round(float(r['value'] or 0), 3),
            "last_sold": str(r['last_movement']) if r['last_movement'] else "Never",
        } for r in rows],
    }


@router.get("/delivery-performance")
async def delivery_performance(from_date: Optional[str] = None, to_date: Optional[str] = None,
                               current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT d.driver_name, d.vehicle, COUNT(*) as total,
                   SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                   SUM(CASE WHEN d.status IN ('pending', 'scheduled') THEN 1 ELSE 0 END) as pending
            FROM deliveries d
            WHERE d.scheduled_date BETWEEN :start AND :end
            GROUP BY d.driver_name, d.vehicle
            ORDER BY total DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []
    return {
        "period": {"from": start, "to": end},
        "data": [{
            "driver": r['driver_name'] or 'Unassigned', "vehicle": r['vehicle'] or '-',
            "total": r['total'], "delivered": r['delivered'], "pending": r['pending'],
            "completion_pct": round(r['delivered'] / r['total'] * 100, 1) if r['total'] > 0 else 0,
        } for r in rows],
    }


@router.get("/receivables-aging")
async def receivables_aging(current_user: User = Depends(get_current_user)):
    today = date.today()
    try:
        rows = run_q("""
            SELECT si.invoice_number, c.name, c.area, c.phone,
                   si.invoice_date, si.due_date,
                   si.total_amount, si.amount_paid,
                   (si.total_amount - si.amount_paid) as balance
            FROM sales_invoices si
            JOIN customers c ON si.customer_id = c.id
            WHERE si.status != 'paid'
            ORDER BY si.due_date ASC
        """)
    except Exception:
        rows = []
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    items = []
    for r in rows:
        bal = float(r['balance'] or 0)
        try:
            days = (today - date.fromisoformat(str(r['due_date'])[:10])).days
        except Exception:
            days = 0
        if days <= 0:
            buckets["current"] += bal
        elif days <= 30:
            buckets["1_30"] += bal
        elif days <= 60:
            buckets["31_60"] += bal
        elif days <= 90:
            buckets["61_90"] += bal
        else:
            buckets["over_90"] += bal
        items.append({
            "invoice": r['invoice_number'], "customer": r['name'],
            "area": r.get('area'), "phone": r['phone'],
            "due_date": str(r['due_date']),
            "total": round(float(r['total_amount'] or 0), 3),
            "paid": round(float(r['amount_paid'] or 0), 3),
            "balance": round(bal, 3), "days_overdue": max(days, 0),
        })
    return {"buckets": {k: round(v, 3) for k, v in buckets.items()},
            "total": round(sum(buckets.values()), 3), "items": items}


@router.get("/payables-aging")
async def payables_aging(current_user: User = Depends(get_current_user)):
    today = date.today()
    try:
        rows = run_q("""
            SELECT pi.invoice_number, s.name, pi.invoice_date, pi.due_date,
                   pi.total_amount, pi.amount_paid,
                   (pi.total_amount - pi.amount_paid) as balance
            FROM purchase_invoices pi
            JOIN suppliers s ON pi.supplier_id = s.id
            WHERE pi.status != 'paid'
            ORDER BY pi.due_date ASC
        """)
    except Exception:
        rows = []
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    items = []
    for r in rows:
        bal = float(r['balance'] or 0)
        try:
            days = (today - date.fromisoformat(str(r['due_date'])[:10])).days
        except Exception:
            days = 0
        if days <= 0:
            buckets["current"] += bal
        elif days <= 30:
            buckets["1_30"] += bal
        elif days <= 60:
            buckets["31_60"] += bal
        elif days <= 90:
            buckets["61_90"] += bal
        else:
            buckets["over_90"] += bal
        items.append({
            "invoice": r['invoice_number'], "supplier": r['name'],
            "due_date": str(r['due_date']),
            "total": round(float(r['total_amount'] or 0), 3),
            "paid": round(float(r['amount_paid'] or 0), 3),
            "balance": round(bal, 3), "days_overdue": max(days, 0),
        })
    return {"buckets": {k: round(v, 3) for k, v in buckets.items()},
            "total": round(sum(buckets.values()), 3), "items": items}


@router.get("/expiry-report")
async def expiry_report(days: int = 90, current_user: User = Depends(get_current_user)):
    cutoff = (date.today() + timedelta(days=days)).isoformat()
    today_str = date.today().isoformat()
    try:
        rows = run_q("""
            SELECT p.sku, p.name, bi.batch_number, bi.expiry_date,
                   bi.quantity_remaining as quantity,
                   COALESCE(p.standard_cost, 0) as unit_cost,
                   w.name as warehouse
            FROM batch_inventory bi
            JOIN products p ON bi.product_id = p.id
            LEFT JOIN warehouses w ON bi.warehouse_id = w.id
            WHERE bi.expiry_date IS NOT NULL AND bi.expiry_date <= :cutoff
              AND bi.quantity_remaining > 0 AND bi.status = 'active'
            ORDER BY bi.expiry_date ASC
        """, {"cutoff": cutoff})
    except Exception:
        rows = []
    expired = [r for r in rows if str(r['expiry_date'])[:10] <= today_str]
    expiring = [r for r in rows if str(r['expiry_date'])[:10] > today_str]

    def fmt(r):
        return {
            "sku": r['sku'], "name": r['name'],
            "batch": r['batch_number'], "expiry": str(r['expiry_date']),
            "qty": r['quantity'],
            "value": round(float(r['quantity'] or 0) * float(r['unit_cost'] or 0), 3),
            "warehouse": r.get('warehouse'),
        }

    return {
        "expired_count": len(expired), "expiring_count": len(expiring),
        "threshold_days": days,
        "expired_value": round(
            sum(float(r['quantity'] or 0) * float(r['unit_cost'] or 0) for r in expired), 3
        ),
        "expired": [fmt(r) for r in expired],
        "expiring_soon": [fmt(r) for r in expiring],
    }


@router.get("/sales-payments")
async def sales_payments(from_date: Optional[str] = None, to_date: Optional[str] = None,
                         current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT p.payment_date as date, c.name as customer,
                   si.invoice_number as invoice, p.payment_method as method,
                   p.bank_reference as reference, p.amount
            FROM payments p
            JOIN sales_invoices si ON p.reference_id = si.id AND p.reference_type = 'sales_invoice'
            JOIN customers c ON si.customer_id = c.id
            WHERE p.payment_date BETWEEN :start AND :end
            ORDER BY p.payment_date DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []
    total = sum(float(r['amount'] or 0) for r in rows)
    data = [{
        "date": str(r['date']), "customer": r['customer'], "invoice": r['invoice'],
        "method": r['method'], "reference": r['reference'] or '',
        "amount": round(float(r['amount'] or 0), 3),
    } for r in rows]
    return {"data": data, "total": round(total, 3), "count": len(data),
            "period": {"from": start, "to": end}}


@router.get("/purchase-payments")
async def purchase_payments(from_date: Optional[str] = None, to_date: Optional[str] = None,
                            current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT p.payment_date as date, s.name as supplier,
                   pi.invoice_number as invoice, p.payment_method as method,
                   p.bank_reference as reference, p.amount
            FROM payments p
            JOIN purchase_invoices pi ON p.reference_id = pi.id AND p.reference_type = 'purchase_invoice'
            JOIN suppliers s ON pi.supplier_id = s.id
            WHERE p.payment_date BETWEEN :start AND :end
            ORDER BY p.payment_date DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []
    total = sum(float(r['amount'] or 0) for r in rows)
    data = [{
        "date": str(r['date']), "supplier": r['supplier'], "invoice": r['invoice'],
        "method": r['method'], "reference": r['reference'] or '',
        "amount": round(float(r['amount'] or 0), 3),
    } for r in rows]
    return {"data": data, "total": round(total, 3), "count": len(data),
            "period": {"from": start, "to": end}}


@router.get("/customer-orders")
async def customer_orders_report(from_date: Optional[str] = None, to_date: Optional[str] = None,
                                 current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT c.code, c.name, c.area,
                   COUNT(so.id) as orders,
                   COALESCE(SUM(so.total_amount), 0) as total,
                   MAX(so.order_date) as last_order
            FROM customers c
            LEFT JOIN sales_orders so ON so.customer_id = c.id
                AND so.order_date BETWEEN :start AND :end
            GROUP BY c.id, c.code, c.name, c.area
            HAVING COUNT(so.id) > 0
            ORDER BY total DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []
    data = [{
        "code": r['code'], "name": r['name'], "area": r['area'] or '',
        "orders": r['orders'], "total": round(float(r['total'] or 0), 3),
        "last_order": str(r['last_order'])[:10] if r['last_order'] else '-',
    } for r in rows]
    return {"data": data, "count": len(data), "period": {"from": start, "to": end}}


@router.get("/sales-by-item")
async def sales_by_item(from_date: Optional[str] = None, to_date: Optional[str] = None,
                        category_id: Optional[int] = None, customer_id: Optional[int] = None,
                        current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    where = ["so.order_date BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end}
    if category_id:
        where.append("p.category_id = :category_id")
        params["category_id"] = category_id
    if customer_id:
        where.append("so.customer_id = :customer_id")
        params["customer_id"] = customer_id
    wc = " AND ".join(where)
    rows = run_q(f"""
        SELECT p.sku, p.name as product, c.name as customer,
               soi.quantity_ordered as qty, soi.unit_price, soi.unit_cost,
               soi.total_price as total,
               so.order_number, so.order_date
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.sales_order_id = so.id
        JOIN products p ON soi.product_id = p.id
        LEFT JOIN customers c ON so.customer_id = c.id
        WHERE {wc}
        ORDER BY so.order_date DESC, so.id DESC
    """, params)
    grand_total = sum(float(r['total'] or 0) for r in rows)
    grand_profit = sum(float(r['total'] or 0) - float(r['qty'] or 0) * float(r['unit_cost'] or 0) for r in rows)
    data = [{
        "sku": r['sku'], "product": r['product'], "customer": r['customer'],
        "order": r['order_number'], "date": str(r['order_date'])[:10],
        "qty": r['qty'], "unit_price": round(float(r['unit_price'] or 0), 3),
        "total": round(float(r['total'] or 0), 3),
        "profit": round(float(r['total'] or 0) - float(r['qty'] or 0) * float(r['unit_cost'] or 0), 3),
    } for r in rows]
    return {"data": data, "count": len(data), "grand_total": round(grand_total, 3),
            "grand_profit": round(grand_profit, 3), "period": {"from": start, "to": end}}


@router.get("/return-items")
async def return_items(from_date: Optional[str] = None, to_date: Optional[str] = None,
                       product_id: Optional[int] = None,
                       current_user: User = Depends(get_current_user)):
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    where = ["r.return_date BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end}
    if product_id:
        where.append("ri.product_id = :product_id")
        params["product_id"] = product_id
    wc = " AND ".join(where)
    try:
        rows = run_q(f"""
            SELECT r.return_number, r.return_date, r.return_type, r.status,
                   c.name as customer,
                   p.name as product, p.sku,
                   ri.quantity, ri.unit_price, ri.reason, ri.condition,
                   (ri.quantity * ri.unit_price) as amount
            FROM return_items ri
            JOIN returns r ON ri.return_id = r.id
            JOIN products p ON ri.product_id = p.id
            LEFT JOIN customers c ON r.customer_id = c.id
            WHERE {wc}
            ORDER BY r.return_date DESC
        """, params)
    except Exception:
        rows = []
    total_value = sum(float(r['amount'] or 0) for r in rows)
    total_qty = sum(float(r['quantity'] or 0) for r in rows)
    data = [{
        "return_number": r['return_number'], "date": str(r['return_date'])[:10],
        "type": r['return_type'], "status": r['status'],
        "customer": r['customer'], "product": r['product'], "sku": r['sku'],
        "qty": r['quantity'], "unit_price": round(float(r['unit_price'] or 0), 3),
        "amount": round(float(r['amount'] or 0), 3),
        "reason": r['reason'] or '', "condition": r['condition'] or '',
    } for r in rows]
    return {"data": data, "count": len(data), "total_value": round(total_value, 3),
            "total_qty": round(total_qty, 3), "period": {"from": start, "to": end}}


# ── VAT Return Report ──

@router.get("/vat-return")
async def vat_return(start_date: str, end_date: str,
                     current_user: User = Depends(get_current_user)):
    """
    Calculate VAT return figures for the given period.
    Oman VAT return boxes:
      Box 1: Standard-rated sales (5% VAT)
      Box 2: Zero-rated sales (0% VAT)
      Box 3: Output VAT (5% of Box 1)
      Box 4: Standard-rated purchases (input VAT claimable)
      Box 5: Input VAT (5% of Box 4)
      Box 6: Net VAT payable (Box 3 - Box 5)
    """
    # Standard-rated sales (invoices with tax > 0)
    standard_sales = run_q("""
        SELECT COALESCE(SUM(si.subtotal), 0) as total
        FROM sales_invoices si
        WHERE si.invoice_date BETWEEN :s AND :e
          AND si.tax_amount > 0
    """, {"s": start_date, "e": end_date})
    box1 = float(standard_sales[0]["total"]) if standard_sales else 0

    # Zero-rated sales (invoices with tax = 0)
    zero_sales = run_q("""
        SELECT COALESCE(SUM(si.subtotal), 0) as total
        FROM sales_invoices si
        WHERE si.invoice_date BETWEEN :s AND :e
          AND (si.tax_amount = 0 OR si.tax_amount IS NULL)
    """, {"s": start_date, "e": end_date})
    box2 = float(zero_sales[0]["total"]) if zero_sales else 0

    # Output VAT collected
    output_vat = run_q("""
        SELECT COALESCE(SUM(si.tax_amount), 0) as total
        FROM sales_invoices si
        WHERE si.invoice_date BETWEEN :s AND :e
    """, {"s": start_date, "e": end_date})
    box3 = float(output_vat[0]["total"]) if output_vat else 0

    # Standard-rated purchases
    standard_purchases = run_q("""
        SELECT COALESCE(SUM(pi.subtotal), 0) as total
        FROM purchase_invoices pi
        WHERE pi.invoice_date BETWEEN :s AND :e
          AND pi.tax_amount > 0
    """, {"s": start_date, "e": end_date})
    box4 = float(standard_purchases[0]["total"]) if standard_purchases else 0

    # Input VAT on purchases
    input_vat = run_q("""
        SELECT COALESCE(SUM(pi.tax_amount), 0) as total
        FROM purchase_invoices pi
        WHERE pi.invoice_date BETWEEN :s AND :e
    """, {"s": start_date, "e": end_date})
    box5 = float(input_vat[0]["total"]) if input_vat else 0

    box6 = box3 - box5

    return {
        "period_start": start_date,
        "period_end": end_date,
        "box1_standard_sales": round(box1, 3),
        "box2_zero_rated_sales": round(box2, 3),
        "box3_output_vat": round(box3, 3),
        "box4_standard_purchases": round(box4, 3),
        "box5_input_vat": round(box5, 3),
        "box6_net_vat_payable": round(box6, 3),
        "total_sales": round(box1 + box2, 3),
        "total_purchases": round(box4, 3),
    }


# ── All Sales Report ──
@router.get("/all-sales")
async def all_sales_report(from_date: Optional[str] = None, to_date: Optional[str] = None,
                           current_user: User = Depends(get_current_user)):
    """All sales invoices with KPI totals."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT si.invoice_number, si.invoice_date, c.name as customer,
                   si.subtotal, si.tax_amount, si.discount_amount,
                   si.total_amount, si.amount_paid,
                   (si.total_amount - si.amount_paid) as balance,
                   si.status
            FROM sales_invoices si
            LEFT JOIN customers c ON si.customer_id = c.id
            WHERE si.invoice_date BETWEEN :start AND :end
            ORDER BY si.invoice_date DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []

    total_sales = sum(float(r['total_amount'] or 0) for r in rows)
    total_collected = sum(float(r['amount_paid'] or 0) for r in rows)
    total_discount = sum(float(r['discount_amount'] or 0) for r in rows)
    total_tax = sum(float(r['tax_amount'] or 0) for r in rows)
    total_due = total_sales - total_collected

    # Count returns
    try:
        ret = run_s("""
            SELECT COALESCE(SUM(ri.quantity * ri.unit_price), 0)
            FROM return_items ri
            JOIN returns r ON ri.return_id = r.id
            WHERE r.return_type = 'sales' AND r.return_date BETWEEN :start AND :end
        """, {"start": start, "end": end})
        total_returns = round(float(ret), 3)
    except Exception:
        total_returns = 0

    data = [{
        "invoice": r['invoice_number'], "date": str(r['invoice_date'])[:10],
        "customer": r['customer'] or '', "subtotal": round(float(r['subtotal'] or 0), 3),
        "tax": round(float(r['tax_amount'] or 0), 3),
        "discount": round(float(r['discount_amount'] or 0), 3),
        "total": round(float(r['total_amount'] or 0), 3),
        "paid": round(float(r['amount_paid'] or 0), 3),
        "balance": round(float(r['balance'] or 0), 3),
        "status": r['status'],
    } for r in rows]

    return {
        "period": {"from": start, "to": end},
        "total_sales": round(total_sales, 3),
        "total_collected": round(total_collected, 3),
        "total_returns": total_returns,
        "total_due": round(total_due, 3),
        "total_discount": round(total_discount, 3),
        "total_tax": round(total_tax, 3),
        "invoice_count": len(data),
        "data": data,
    }


# ── Customer Sales Summary ──
@router.get("/customer-sales-summary")
async def customer_sales_summary(from_date: Optional[str] = None, to_date: Optional[str] = None,
                                  current_user: User = Depends(get_current_user)):
    """Per-customer sales totals from sales invoices."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT c.code, c.name, c.area,
                   COUNT(si.id) as invoice_count,
                   COALESCE(SUM(si.total_amount), 0) as total_invoiced,
                   COALESCE(SUM(si.amount_paid), 0) as total_paid,
                   COALESCE(SUM(si.total_amount - si.amount_paid), 0) as total_due
            FROM customers c
            LEFT JOIN sales_invoices si ON c.id = si.customer_id
                AND si.invoice_date BETWEEN :start AND :end
            WHERE c.is_active = true
            GROUP BY c.id, c.code, c.name, c.area
            HAVING COUNT(si.id) > 0
            ORDER BY total_invoiced DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []

    grand_invoiced = sum(float(r['total_invoiced'] or 0) for r in rows)
    grand_paid = sum(float(r['total_paid'] or 0) for r in rows)
    grand_due = sum(float(r['total_due'] or 0) for r in rows)

    data = [{
        "code": r['code'], "name": r['name'], "area": r['area'] or '',
        "invoice_count": r['invoice_count'],
        "total_invoiced": round(float(r['total_invoiced'] or 0), 3),
        "total_paid": round(float(r['total_paid'] or 0), 3),
        "total_due": round(float(r['total_due'] or 0), 3),
    } for r in rows]

    return {
        "period": {"from": start, "to": end},
        "customer_count": len(data),
        "grand_invoiced": round(grand_invoiced, 3),
        "grand_paid": round(grand_paid, 3),
        "grand_due": round(grand_due, 3),
        "data": data,
    }


# ── Product Sales Report ──
@router.get("/product-sales")
async def product_sales_report(from_date: Optional[str] = None, to_date: Optional[str] = None,
                                product_id: Optional[int] = None,
                                current_user: User = Depends(get_current_user)):
    """Product-wise sales breakdown from sales order items."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()

    where = ["so.order_date BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end}
    if product_id:
        where.append("p.id = :product_id")
        params["product_id"] = product_id
    wc = " AND ".join(where)

    try:
        rows = run_q(f"""
            SELECT p.sku, p.name,
                   COALESCE(SUM(soi.quantity_ordered), 0) as sales_qty,
                   COALESCE(SUM(soi.total_price), 0) as total_amount,
                   COALESCE(SUM(soi.quantity_ordered * COALESCE(soi.unit_cost, 0)), 0) as total_cost,
                   COALESCE(SUM(soi.quantity_ordered * soi.unit_price * soi.discount_percent / 100), 0) as total_discount
            FROM products p
            LEFT JOIN sales_order_items soi ON p.id = soi.product_id
            LEFT JOIN sales_orders so ON soi.sales_order_id = so.id AND {wc}
            WHERE p.is_active = true AND (p.is_deleted = false OR p.is_deleted IS NULL)
            GROUP BY p.id, p.sku, p.name
            HAVING COALESCE(SUM(soi.quantity_ordered), 0) > 0
            ORDER BY total_amount DESC
        """, params)
    except Exception:
        rows = []

    # Return quantities
    try:
        ret_rows = run_q("""
            SELECT ri.product_id, COALESCE(SUM(ri.quantity), 0) as return_qty
            FROM return_items ri
            JOIN returns r ON ri.return_id = r.id
            WHERE r.return_type = 'sales' AND r.return_date BETWEEN :start AND :end
            GROUP BY ri.product_id
        """, {"start": start, "end": end})
        return_map = {r['product_id']: int(r['return_qty'] or 0) for r in ret_rows}
    except Exception:
        return_map = {}

    grand_qty = sum(int(r['sales_qty'] or 0) for r in rows)
    grand_amount = sum(float(r['total_amount'] or 0) for r in rows)
    grand_discount = sum(float(r['total_discount'] or 0) for r in rows)
    grand_return_qty = sum(return_map.values())

    data = [{
        "sku": r['sku'], "name": r['name'],
        "sales_qty": int(r['sales_qty'] or 0),
        "return_qty": return_map.get(r.get('id'), 0),
        "total_amount": round(float(r['total_amount'] or 0), 3),
        "total_cost": round(float(r['total_cost'] or 0), 3),
        "total_discount": round(float(r['total_discount'] or 0), 3),
        "profit": round(float(r['total_amount'] or 0) - float(r['total_cost'] or 0), 3),
    } for r in rows]

    return {
        "period": {"from": start, "to": end},
        "grand_qty": grand_qty,
        "grand_return_qty": grand_return_qty,
        "grand_amount": round(grand_amount, 3),
        "grand_discount": round(grand_discount, 3),
        "data": data,
    }


# ── All Purchases Report ──
@router.get("/all-purchases")
async def all_purchases_report(from_date: Optional[str] = None, to_date: Optional[str] = None,
                                current_user: User = Depends(get_current_user)):
    """All purchase invoices with vendor summary."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT pi.invoice_number, pi.invoice_date, s.name as vendor,
                   pi.subtotal, pi.tax_amount,
                   pi.total_amount, pi.amount_paid,
                   (pi.total_amount - pi.amount_paid) as balance,
                   pi.status
            FROM purchase_invoices pi
            LEFT JOIN suppliers s ON pi.supplier_id = s.id
            WHERE pi.invoice_date BETWEEN :start AND :end
            ORDER BY pi.invoice_date DESC
        """, {"start": start, "end": end})
    except Exception:
        rows = []

    total_purchases = sum(float(r['total_amount'] or 0) for r in rows)
    total_paid = sum(float(r['amount_paid'] or 0) for r in rows)
    total_due = total_purchases - total_paid

    data = [{
        "invoice": r['invoice_number'], "date": str(r['invoice_date'])[:10],
        "vendor": r['vendor'] or '', "subtotal": round(float(r['subtotal'] or 0), 3),
        "tax": round(float(r['tax_amount'] or 0), 3),
        "total": round(float(r['total_amount'] or 0), 3),
        "paid": round(float(r['amount_paid'] or 0), 3),
        "balance": round(float(r['balance'] or 0), 3),
        "status": r['status'],
    } for r in rows]

    # Vendor summary
    try:
        vendor_rows = run_q("""
            SELECT s.code, s.name,
                   COUNT(pi.id) as invoice_count,
                   COALESCE(SUM(pi.total_amount), 0) as total,
                   COALESCE(SUM(pi.amount_paid), 0) as paid,
                   COALESCE(SUM(pi.total_amount - pi.amount_paid), 0) as due
            FROM suppliers s
            LEFT JOIN purchase_invoices pi ON s.id = pi.supplier_id
                AND pi.invoice_date BETWEEN :start AND :end
            WHERE s.is_active = true
            GROUP BY s.id, s.code, s.name
            HAVING COUNT(pi.id) > 0
            ORDER BY total DESC
        """, {"start": start, "end": end})
    except Exception:
        vendor_rows = []

    vendor_summary = [{
        "code": r['code'], "name": r['name'],
        "invoice_count": r['invoice_count'],
        "total": round(float(r['total'] or 0), 3),
        "paid": round(float(r['paid'] or 0), 3),
        "due": round(float(r['due'] or 0), 3),
    } for r in vendor_rows]

    return {
        "period": {"from": start, "to": end},
        "total_purchases": round(total_purchases, 3),
        "total_paid": round(total_paid, 3),
        "total_due": round(total_due, 3),
        "invoice_count": len(data),
        "data": data,
        "vendor_summary": vendor_summary,
    }


# ── Expense Breakdown ──
@router.get("/expense-breakdown")
async def expense_breakdown(from_date: Optional[str] = None, to_date: Optional[str] = None,
                             current_user: User = Depends(get_current_user)):
    """Expenses grouped by account category from journal entries."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()
    try:
        rows = run_q("""
            SELECT jel.account_code, jel.account_name,
                   a.account_type,
                   COALESCE(SUM(jel.debit_amount), 0) as total_debit,
                   COALESCE(SUM(jel.credit_amount), 0) as total_credit
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            LEFT JOIN accounts a ON a.code = jel.account_code
            WHERE DATE(je.entry_date) BETWEEN :start AND :end
              AND (a.account_type IN ('Expense', 'COGS') OR jel.account_code LIKE '5%' OR jel.account_code LIKE '6%')
            GROUP BY jel.account_code, jel.account_name, a.account_type
            ORDER BY jel.account_code
        """, {"start": start, "end": end})
    except Exception:
        rows = []

    # Also pull bills as a separate expense source
    try:
        bill_rows = run_q("""
            SELECT b.expense_account as account_code,
                   COALESCE(a.name, b.description) as account_name,
                   'Expense' as account_type,
                   COALESCE(SUM(b.total_amount), 0) as total
            FROM bills b
            LEFT JOIN accounts a ON a.code = b.expense_account
            WHERE b.bill_date BETWEEN :start AND :end AND b.status != 'cancelled'
            GROUP BY b.expense_account, a.name, b.description
        """, {"start": start, "end": end})
    except Exception:
        bill_rows = []

    total_expenses = 0
    total_cogs = 0
    data = []
    for r in rows:
        amount = round(float(r['total_debit'] or 0) - float(r['total_credit'] or 0), 3)
        atype = r['account_type'] or 'Expense'
        if atype == 'COGS':
            total_cogs += amount
        else:
            total_expenses += amount
        data.append({
            "account_code": r['account_code'],
            "account_name": r['account_name'] or r['account_code'],
            "account_type": atype,
            "amount": amount,
        })

    return {
        "period": {"from": start, "to": end},
        "total_expenses": round(total_expenses, 3),
        "total_cogs": round(total_cogs, 3),
        "grand_total": round(total_expenses + total_cogs, 3),
        "data": data,
    }


# ── Sales Tax Report ──
@router.get("/sales-tax")
async def sales_tax_report(from_date: Optional[str] = None, to_date: Optional[str] = None,
                            current_user: User = Depends(get_current_user)):
    """Tax summary — taxable vs zero-rated sales and purchases."""
    today = date.today()
    start = from_date or today.replace(month=1, day=1).isoformat()
    end = to_date or today.isoformat()

    # Sales tax breakdown
    try:
        taxable_sales = run_q("""
            SELECT COALESCE(SUM(si.subtotal), 0) as sales_amount,
                   COALESCE(SUM(si.tax_amount), 0) as tax_amount,
                   COUNT(*) as invoice_count
            FROM sales_invoices si
            WHERE si.invoice_date BETWEEN :start AND :end AND si.tax_amount > 0
        """, {"start": start, "end": end})
    except Exception:
        taxable_sales = [{"sales_amount": 0, "tax_amount": 0, "invoice_count": 0}]

    try:
        zero_sales = run_q("""
            SELECT COALESCE(SUM(si.subtotal), 0) as sales_amount,
                   COUNT(*) as invoice_count
            FROM sales_invoices si
            WHERE si.invoice_date BETWEEN :start AND :end
              AND (si.tax_amount = 0 OR si.tax_amount IS NULL)
        """, {"start": start, "end": end})
    except Exception:
        zero_sales = [{"sales_amount": 0, "invoice_count": 0}]

    # Purchase tax breakdown
    try:
        taxable_purchases = run_q("""
            SELECT COALESCE(SUM(pi.subtotal), 0) as purchase_amount,
                   COALESCE(SUM(pi.tax_amount), 0) as tax_amount,
                   COUNT(*) as invoice_count
            FROM purchase_invoices pi
            WHERE pi.invoice_date BETWEEN :start AND :end AND pi.tax_amount > 0
        """, {"start": start, "end": end})
    except Exception:
        taxable_purchases = [{"purchase_amount": 0, "tax_amount": 0, "invoice_count": 0}]

    try:
        zero_purchases = run_q("""
            SELECT COALESCE(SUM(pi.subtotal), 0) as purchase_amount,
                   COUNT(*) as invoice_count
            FROM purchase_invoices pi
            WHERE pi.invoice_date BETWEEN :start AND :end
              AND (pi.tax_amount = 0 OR pi.tax_amount IS NULL)
        """, {"start": start, "end": end})
    except Exception:
        zero_purchases = [{"purchase_amount": 0, "invoice_count": 0}]

    ts = taxable_sales[0] if taxable_sales else {}
    zs = zero_sales[0] if zero_sales else {}
    tp = taxable_purchases[0] if taxable_purchases else {}
    zp = zero_purchases[0] if zero_purchases else {}

    output_vat = round(float(ts.get('tax_amount', 0)), 3)
    input_vat = round(float(tp.get('tax_amount', 0)), 3)
    net_vat = round(output_vat - input_vat, 3)

    return {
        "period": {"from": start, "to": end},
        "taxable_sales": round(float(ts.get('sales_amount', 0)), 3),
        "taxable_sales_count": int(ts.get('invoice_count', 0)),
        "output_vat": output_vat,
        "zero_rated_sales": round(float(zs.get('sales_amount', 0)), 3),
        "zero_rated_sales_count": int(zs.get('invoice_count', 0)),
        "taxable_purchases": round(float(tp.get('purchase_amount', 0)), 3),
        "taxable_purchases_count": int(tp.get('invoice_count', 0)),
        "input_vat": input_vat,
        "zero_rated_purchases": round(float(zp.get('purchase_amount', 0)), 3),
        "zero_rated_purchases_count": int(zp.get('invoice_count', 0)),
        "net_vat_payable": net_vat,
        "total_sales": round(float(ts.get('sales_amount', 0)) + float(zs.get('sales_amount', 0)), 3),
        "total_purchases": round(float(tp.get('purchase_amount', 0)) + float(zp.get('purchase_amount', 0)), 3),
    }
