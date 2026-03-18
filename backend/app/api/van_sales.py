"""Van Sales / Route Accounting API — driver daily sales sheets"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import Optional, List
from datetime import date, datetime

from app.core.database import get_db
from app.models.van_sales import DriverRouteAccount, DriverRouteAccountItem, DriverSettlement
from app.models.user import User
from app.models.product import Product
from app.models.inventory import InventoryTransaction, StockLevel, TransactionType, Warehouse
from app.api.auth import get_current_user

router = APIRouter()


# ── List all route accounts (with filters) ──
@router.get("/accounts")
def list_route_accounts(
    driver_id: Optional[int] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(DriverRouteAccount).options(
        joinedload(DriverRouteAccount.driver)
    )
    if driver_id:
        q = q.filter(DriverRouteAccount.driver_id == driver_id)
    if status:
        q = q.filter(DriverRouteAccount.status == status)
    if from_date:
        q = q.filter(DriverRouteAccount.date >= from_date)
    if to_date:
        q = q.filter(DriverRouteAccount.date <= to_date)
    accounts = q.order_by(desc(DriverRouteAccount.date), desc(DriverRouteAccount.id)).all()
    return [_serialize_account(a) for a in accounts]


# ── Get single account with items ──
@router.get("/accounts/{account_id}")
def get_route_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    acc = db.query(DriverRouteAccount).options(
        joinedload(DriverRouteAccount.items),
        joinedload(DriverRouteAccount.driver)
    ).filter(DriverRouteAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Route account not found")
    return _serialize_account(acc, include_items=True)


# ── Create new route account ──
@router.post("/accounts", status_code=201)
def create_route_account(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get previous running due for this driver
    prev = db.query(DriverRouteAccount).filter(
        DriverRouteAccount.driver_id == data['driver_id'],
        DriverRouteAccount.date < data['date']
    ).order_by(desc(DriverRouteAccount.date), desc(DriverRouteAccount.id)).first()
    previous_running_due = float(prev.running_due or 0) if prev else 0

    # Build items
    items_data = data.get('items', [])
    total_sales = 0
    total_cost = 0
    db_items = []
    for i, item in enumerate(items_data):
        qty = float(item.get('quantity', 0) or 0)
        sell_p = float(item.get('sell_price', 0) or 0)
        purch_p = float(item.get('purchase_price', 0) or 0)
        t_sell = round(qty * sell_p, 3)
        t_purch = round(qty * purch_p, 3)
        profit = round(t_sell - t_purch, 3)
        total_sales += t_sell
        total_cost += t_purch
        db_items.append(DriverRouteAccountItem(
            sl_no=i + 1,
            product_id=item.get('product_id') or None,
            product_name=item.get('product_name', ''),
            unit=item.get('unit', 'CTN'),
            quantity=qty,
            sell_price=sell_p,
            total_sell=t_sell,
            purchase_price=purch_p,
            total_purchase=t_purch,
            profit=profit,
        ))

    total_profit = round(total_sales - total_cost, 3)
    profit_pct = round((total_profit / total_sales * 100) if total_sales > 0 else 0, 2)

    collection = float(data.get('collection_cash', 0) or 0)
    petrol = float(data.get('expense_petrol', 0) or 0)
    others = float(data.get('expense_others', 0) or 0)
    discounts = float(data.get('sales_discounts', 0) or 0)
    daily_due = round(total_sales - collection - discounts, 3)
    running_due = round(previous_running_due + daily_due, 3)

    acc = DriverRouteAccount(
        driver_id=data['driver_id'],
        date=data['date'],
        total_sales=total_sales,
        total_cost=total_cost,
        total_profit=total_profit,
        profit_percent=profit_pct,
        collection_cash=collection,
        expense_petrol=petrol,
        expense_others=others,
        sales_discounts=discounts,
        daily_due=daily_due,
        running_due=running_due,
        notes=data.get('notes', ''),
        status='open',
        created_by=current_user.id,
        items=db_items,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)

    # ── Phase 44: Deduct sold items from van stock ──
    try:
        driver = db.query(User).filter(User.id == data['driver_id']).first()
        van_wh = _get_van_warehouse(driver, db)
        if van_wh:
            for item in db_items:
                qty = float(item.quantity or 0)
                if qty <= 0 or not item.product_id:
                    continue
                van_stock = db.query(StockLevel).filter(
                    StockLevel.product_id == item.product_id,
                    StockLevel.warehouse_id == van_wh.id
                ).first()
                if van_stock and float(van_stock.quantity_on_hand) >= qty:
                    db.add(InventoryTransaction(
                        product_id=item.product_id, warehouse_id=van_wh.id,
                        transaction_type=TransactionType.ISSUE, quantity=qty,
                        reference_type="VAN_SALE", reference_id=acc.id,
                        reference_number=f"VS-{acc.id}",
                        notes=f"Van sale -- {driver.full_name or driver.username} -- {acc.date}",
                        created_by=current_user.id
                    ))
                    van_stock.quantity_on_hand -= qty
            db.commit()
    except Exception as e:
        print(f"Van stock deduction warning: {e}")

    return _serialize_account(acc, include_items=True)


# ── Update existing route account ──
@router.put("/accounts/{account_id}")
def update_route_account(
    account_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    acc = db.query(DriverRouteAccount).filter(DriverRouteAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Route account not found")

    # Get previous running due
    prev = db.query(DriverRouteAccount).filter(
        DriverRouteAccount.driver_id == acc.driver_id,
        DriverRouteAccount.date < acc.date
    ).order_by(desc(DriverRouteAccount.date), desc(DriverRouteAccount.id)).first()
    previous_running_due = float(prev.running_due or 0) if prev else 0

    # Clear old items
    db.query(DriverRouteAccountItem).filter(
        DriverRouteAccountItem.route_account_id == account_id
    ).delete()

    # Rebuild items
    items_data = data.get('items', [])
    total_sales = 0
    total_cost = 0
    for i, item in enumerate(items_data):
        qty = float(item.get('quantity', 0) or 0)
        sell_p = float(item.get('sell_price', 0) or 0)
        purch_p = float(item.get('purchase_price', 0) or 0)
        t_sell = round(qty * sell_p, 3)
        t_purch = round(qty * purch_p, 3)
        profit = round(t_sell - t_purch, 3)
        total_sales += t_sell
        total_cost += t_purch
        db.add(DriverRouteAccountItem(
            route_account_id=account_id,
            sl_no=i + 1,
            product_id=item.get('product_id') or None,
            product_name=item.get('product_name', ''),
            unit=item.get('unit', 'CTN'),
            quantity=qty, sell_price=sell_p, total_sell=t_sell,
            purchase_price=purch_p, total_purchase=t_purch, profit=profit,
        ))

    total_profit = round(total_sales - total_cost, 3)
    profit_pct = round((total_profit / total_sales * 100) if total_sales > 0 else 0, 2)

    collection = float(data.get('collection_cash', 0) or 0)
    discounts = float(data.get('sales_discounts', 0) or 0)
    daily_due = round(total_sales - collection - discounts, 3)
    running_due = round(previous_running_due + daily_due, 3)

    acc.total_sales = total_sales
    acc.total_cost = total_cost
    acc.total_profit = total_profit
    acc.profit_percent = profit_pct
    acc.collection_cash = collection
    acc.expense_petrol = float(data.get('expense_petrol', 0) or 0)
    acc.expense_others = float(data.get('expense_others', 0) or 0)
    acc.sales_discounts = discounts
    acc.daily_due = daily_due
    acc.running_due = running_due
    acc.notes = data.get('notes', '')

    db.commit()
    db.refresh(acc)
    return _serialize_account(acc, include_items=True)


# ── Record a settlement payment from a driver ──
@router.post("/settle")
def record_settlement(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Record a cash/bank settlement from a driver.
    data: { driver_id, amount, payment_method, bank_reference, notes, settlement_date }
    This reduces the driver's running_due.
    """
    driver_id = data.get("driver_id")
    amount = float(data.get("amount", 0) or 0)
    if amount <= 0:
        raise HTTPException(400, "Settlement amount must be positive")

    driver = db.query(User).filter(User.id == driver_id).first()
    if not driver:
        raise HTTPException(404, "Driver not found")

    # Get current running due from latest route account
    latest = db.query(DriverRouteAccount).filter(
        DriverRouteAccount.driver_id == driver_id
    ).order_by(desc(DriverRouteAccount.date), desc(DriverRouteAccount.id)).first()
    current_due = float(latest.running_due or 0) if latest else 0

    if amount > current_due + 0.001:
        raise HTTPException(400, f"Settlement amount ({amount:.3f}) exceeds running due ({current_due:.3f})")

    new_due = round(current_due - amount, 3)

    # Create settlement record
    settlement = DriverSettlement(
        driver_id=driver_id,
        settlement_date=data.get("settlement_date", date.today().isoformat()),
        amount=amount,
        payment_method=data.get("payment_method", "cash"),
        bank_reference=data.get("bank_reference"),
        running_due_before=current_due,
        running_due_after=new_due,
        notes=data.get("notes", ""),
        settled_by=current_user.id,
    )
    db.add(settlement)

    # Update the latest route account's running_due
    if latest:
        latest.running_due = new_due
        if new_due <= 0:
            latest.status = 'settled'

    db.commit()
    db.refresh(settlement)

    return {
        "message": f"Settlement recorded: OMR {amount:.3f}",
        "settlement_id": settlement.id,
        "running_due_before": current_due,
        "running_due_after": new_due,
        "driver_name": driver.full_name or driver.username,
    }


# ── Settlement history for a driver ──
@router.get("/settlements")
def list_settlements(
    driver_id: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all settlement records, optionally filtered by driver."""
    q = db.query(DriverSettlement).options(
        joinedload(DriverSettlement.driver)
    )
    if driver_id:
        q = q.filter(DriverSettlement.driver_id == driver_id)
    if from_date:
        q = q.filter(DriverSettlement.settlement_date >= from_date)
    if to_date:
        q = q.filter(DriverSettlement.settlement_date <= to_date)

    settlements = q.order_by(desc(DriverSettlement.settlement_date), desc(DriverSettlement.id)).all()

    return [{
        "id": s.id,
        "driver_id": s.driver_id,
        "driver_name": (s.driver.full_name or s.driver.username) if s.driver else "",
        "settlement_date": s.settlement_date.isoformat() if s.settlement_date else None,
        "amount": float(s.amount or 0),
        "payment_method": s.payment_method,
        "bank_reference": s.bank_reference,
        "running_due_before": float(s.running_due_before or 0),
        "running_due_after": float(s.running_due_after or 0),
        "notes": s.notes or "",
        "settled_by": s.settled_by,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    } for s in settlements]


# ── Overdue check — which drivers owe too much? ──
@router.get("/overdue")
def check_overdue(
    threshold: float = 50.0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check which drivers have running_due above the threshold (default: 50 OMR)."""
    driver_ids_q = db.query(DriverRouteAccount.driver_id).distinct().all()
    overdue_drivers = []

    for (did,) in driver_ids_q:
        driver = db.query(User).filter(User.id == did).first()
        if not driver:
            continue
        latest = db.query(DriverRouteAccount).filter(
            DriverRouteAccount.driver_id == did
        ).order_by(desc(DriverRouteAccount.date), desc(DriverRouteAccount.id)).first()

        if latest and float(latest.running_due or 0) > threshold:
            # Days since last settlement
            last_settlement = db.query(DriverSettlement).filter(
                DriverSettlement.driver_id == did
            ).order_by(desc(DriverSettlement.settlement_date)).first()
            days_since = None
            if last_settlement:
                from datetime import date as date_type
                days_since = (date_type.today() - last_settlement.settlement_date).days

            overdue_drivers.append({
                "driver_id": did,
                "driver_name": driver.full_name or driver.username,
                "running_due": float(latest.running_due or 0),
                "last_sheet_date": latest.date.isoformat() if latest.date else None,
                "days_since_last_settlement": days_since,
                "last_settlement_amount": float(last_settlement.amount or 0) if last_settlement else None,
            })

    return {
        "threshold": threshold,
        "overdue_count": len(overdue_drivers),
        "drivers": sorted(overdue_drivers, key=lambda d: d["running_due"], reverse=True),
    }


# ── Driver due summary ──
@router.get("/driver-summary")
def driver_summary(
    driver_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Per-driver summary: total sales, collected, current running due."""
    from sqlalchemy import func as sqlfunc

    q = db.query(DriverRouteAccount)
    if driver_id:
        q = q.filter(DriverRouteAccount.driver_id == driver_id)

    # Get all drivers who have route accounts
    driver_ids_q = db.query(DriverRouteAccount.driver_id).distinct().all()
    driver_ids = [d[0] for d in driver_ids_q]
    if driver_id:
        driver_ids = [driver_id]

    summaries = []
    for did in driver_ids:
        driver = db.query(User).filter(User.id == did).first()
        if not driver:
            continue

        # Get the latest account for running due
        latest = db.query(DriverRouteAccount).filter(
            DriverRouteAccount.driver_id == did
        ).order_by(desc(DriverRouteAccount.date), desc(DriverRouteAccount.id)).first()

        # Aggregate totals
        totals = db.query(
            sqlfunc.coalesce(sqlfunc.sum(DriverRouteAccount.total_sales), 0),
            sqlfunc.coalesce(sqlfunc.sum(DriverRouteAccount.collection_cash), 0),
            sqlfunc.coalesce(sqlfunc.sum(DriverRouteAccount.total_profit), 0),
            sqlfunc.count(DriverRouteAccount.id),
        ).filter(DriverRouteAccount.driver_id == did).first()

        summaries.append({
            "driver_id": did,
            "driver_name": driver.full_name or driver.username,
            "total_sales": float(totals[0] or 0),
            "total_collected": float(totals[1] or 0),
            "total_profit": float(totals[2] or 0),
            "sheet_count": totals[3],
            "running_due": float(latest.running_due or 0) if latest else 0,
            "last_date": latest.date.isoformat() if latest else None,
        })

    return summaries


# ── Get drivers list (for dropdown) ──
@router.get("/drivers")
def list_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    drivers = db.query(User).filter(User.is_active == True).all()
    return [
        {"id": u.id, "name": u.full_name or u.username, "role": u.role.value if u.role else ""}
        for u in drivers
    ]


# ── Products for dropdown ──
@router.get("/products-list")
def products_for_van_sales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    products = db.query(Product).filter(
        Product.is_active == True,
        Product.is_deleted != True
    ).order_by(Product.name).all()
    return [
        {
            "id": p.id, "name": p.name, "sku": p.sku,
            "unit": p.unit_of_measure,
            "sell_price": float(p.selling_price or 0),
            "cost_price": float(p.standard_cost or 0),
        }
        for p in products
    ]


# ── Van stock for a driver ──
@router.get("/van-stock/{driver_id}")
def get_van_stock(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current stock levels on a driver's van."""
    driver = db.query(User).filter(User.id == driver_id).first()
    if not driver:
        raise HTTPException(404, "Driver not found")

    van_wh = _get_van_warehouse(driver, db)
    if not van_wh:
        return {"driver_id": driver_id, "driver_name": driver.full_name or driver.username,
                "van_warehouse": None, "items": [], "total_items": 0}

    stocks = db.query(
        StockLevel, Product.name, Product.sku, Product.unit_of_measure,
        Product.selling_price, Product.standard_cost
    ).join(Product, StockLevel.product_id == Product.id
    ).filter(
        StockLevel.warehouse_id == van_wh.id,
        StockLevel.quantity_on_hand > 0
    ).order_by(Product.name).all()

    items = [{
        "product_id": sl.product_id,
        "product_name": name,
        "sku": sku,
        "unit": uom or "CTN",
        "quantity_on_hand": float(sl.quantity_on_hand),
        "sell_price": float(sp or 0),
        "cost_price": float(sc or 0),
        "stock_value": round(float(sl.quantity_on_hand) * float(sc or 0), 3),
    } for sl, name, sku, uom, sp, sc in stocks]

    return {
        "driver_id": driver_id,
        "driver_name": driver.full_name or driver.username,
        "van_warehouse": {"id": van_wh.id, "code": van_wh.code, "name": van_wh.name},
        "items": items,
        "total_items": len(items),
        "total_value": round(sum(i["stock_value"] for i in items), 3),
    }


# ── Load van — transfer stock from main warehouse to van ──
@router.post("/load-van")
def load_van(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Transfer products from main warehouse to driver's van.
    data: { driver_id: int, items: [{ product_id: int, quantity: float }], notes: str }
    """
    driver_id = data.get("driver_id")
    driver = db.query(User).filter(User.id == driver_id).first()
    if not driver:
        raise HTTPException(404, "Driver not found")

    van_wh = _get_van_warehouse(driver, db)
    if not van_wh:
        raise HTTPException(400, f"No van warehouse assigned for {driver.full_name or driver.username}. Contact admin.")

    main_wh = db.query(Warehouse).filter(Warehouse.code == "WH-01").first()
    if not main_wh:
        raise HTTPException(400, "Main warehouse WH-01 not found")

    items_data = data.get("items", [])
    if not items_data:
        raise HTTPException(400, "No items to load")

    load_date = data.get("date", date.today().isoformat())
    ref_number = f"VAN-LOAD-{driver.full_name or driver.username}-{load_date}"
    notes = data.get("notes", "") or f"Van loading for {driver.full_name or driver.username} on {load_date}"

    results = []
    loaded_count = 0
    for item in items_data:
        product_id = item.get("product_id")
        qty = float(item.get("quantity", 0) or 0)
        if qty <= 0:
            continue

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            results.append({"product_id": product_id, "status": "error", "message": "Product not found"})
            continue

        # Check main warehouse stock
        main_stock = db.query(StockLevel).filter(
            StockLevel.product_id == product_id,
            StockLevel.warehouse_id == main_wh.id
        ).first()
        available = float(main_stock.quantity_on_hand) if main_stock else 0

        if available < qty:
            results.append({
                "product_id": product_id, "product_name": product.name,
                "status": "error",
                "message": f"Insufficient stock. Available: {available:.3f}, Requested: {qty:.3f}"
            })
            continue

        # TRANSFER_OUT from main
        db.add(InventoryTransaction(
            product_id=product_id, warehouse_id=main_wh.id,
            transaction_type=TransactionType.TRANSFER_OUT, quantity=qty,
            from_warehouse_id=main_wh.id, to_warehouse_id=van_wh.id,
            reference_number=ref_number, reference_type="VAN_LOADING",
            notes=notes, created_by=current_user.id
        ))
        main_stock.quantity_on_hand -= qty

        # TRANSFER_IN to van
        db.add(InventoryTransaction(
            product_id=product_id, warehouse_id=van_wh.id,
            transaction_type=TransactionType.TRANSFER_IN, quantity=qty,
            from_warehouse_id=main_wh.id, to_warehouse_id=van_wh.id,
            reference_number=ref_number, reference_type="VAN_LOADING",
            notes=notes, created_by=current_user.id
        ))
        van_stock = db.query(StockLevel).filter(
            StockLevel.product_id == product_id,
            StockLevel.warehouse_id == van_wh.id
        ).first()
        if van_stock:
            van_stock.quantity_on_hand += qty
        else:
            db.add(StockLevel(
                product_id=product_id, warehouse_id=van_wh.id,
                quantity_on_hand=qty
            ))

        loaded_count += 1
        results.append({
            "product_id": product_id, "product_name": product.name,
            "quantity": qty, "status": "loaded",
            "main_stock_remaining": round(float(main_stock.quantity_on_hand), 3)
        })

    db.commit()
    return {
        "message": f"Loaded {loaded_count} products onto {van_wh.name}",
        "reference": ref_number,
        "items": results,
        "loaded_count": loaded_count,
    }


# ── Return unsold stock from van to main warehouse ──
@router.post("/return-unsold/{account_id}")
def return_unsold(
    account_id: int,
    data: dict = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return unsold items from van back to main warehouse.
    data: { items: [{ product_id: int, quantity: float }] }
    If items not provided, returns ALL van stock back to main warehouse.
    """
    acc = db.query(DriverRouteAccount).options(
        joinedload(DriverRouteAccount.items)
    ).filter(DriverRouteAccount.id == account_id).first()
    if not acc:
        raise HTTPException(404, "Route account not found")

    driver = db.query(User).filter(User.id == acc.driver_id).first()
    van_wh = _get_van_warehouse(driver, db)
    if not van_wh:
        raise HTTPException(400, "No van warehouse found for driver")

    main_wh = db.query(Warehouse).filter(Warehouse.code == "WH-01").first()
    if not main_wh:
        raise HTTPException(400, "Main warehouse not found")

    ref_number = f"VAN-RETURN-{driver.full_name or driver.username}-{acc.date}"
    notes = f"Return unsold stock -- {driver.full_name or driver.username} -- {acc.date}"

    return_items = []
    if data and data.get("items"):
        return_items = data["items"]
    else:
        van_stocks = db.query(StockLevel).filter(
            StockLevel.warehouse_id == van_wh.id,
            StockLevel.quantity_on_hand > 0
        ).all()
        return_items = [{"product_id": s.product_id, "quantity": float(s.quantity_on_hand)} for s in van_stocks]

    returned_count = 0
    results = []
    for item in return_items:
        product_id = item.get("product_id")
        qty = float(item.get("quantity", 0) or 0)
        if qty <= 0:
            continue

        product = db.query(Product).filter(Product.id == product_id).first()
        van_stock = db.query(StockLevel).filter(
            StockLevel.product_id == product_id,
            StockLevel.warehouse_id == van_wh.id
        ).first()

        actual_qty = min(qty, float(van_stock.quantity_on_hand)) if van_stock else 0
        if actual_qty <= 0:
            continue

        # TRANSFER_OUT from van
        db.add(InventoryTransaction(
            product_id=product_id, warehouse_id=van_wh.id,
            transaction_type=TransactionType.TRANSFER_OUT, quantity=actual_qty,
            from_warehouse_id=van_wh.id, to_warehouse_id=main_wh.id,
            reference_number=ref_number, reference_type="VAN_RETURN",
            notes=notes, created_by=current_user.id
        ))
        van_stock.quantity_on_hand -= actual_qty

        # TRANSFER_IN to main
        db.add(InventoryTransaction(
            product_id=product_id, warehouse_id=main_wh.id,
            transaction_type=TransactionType.TRANSFER_IN, quantity=actual_qty,
            from_warehouse_id=van_wh.id, to_warehouse_id=main_wh.id,
            reference_number=ref_number, reference_type="VAN_RETURN",
            notes=notes, created_by=current_user.id
        ))
        main_stock = db.query(StockLevel).filter(
            StockLevel.product_id == product_id,
            StockLevel.warehouse_id == main_wh.id
        ).first()
        if main_stock:
            main_stock.quantity_on_hand += actual_qty
        else:
            db.add(StockLevel(product_id=product_id, warehouse_id=main_wh.id, quantity_on_hand=actual_qty))

        returned_count += 1
        results.append({
            "product_id": product_id,
            "product_name": product.name if product else "Unknown",
            "quantity_returned": actual_qty,
            "status": "returned"
        })

    db.commit()
    return {
        "message": f"Returned {returned_count} products from {van_wh.name} to main warehouse",
        "reference": ref_number,
        "items": results,
    }


def _get_van_warehouse(driver: User, db: Session):
    """Get the van warehouse for a driver. Tries van_warehouse_id first, then name-based lookup."""
    if hasattr(driver, 'van_warehouse_id') and driver.van_warehouse_id:
        return db.query(Warehouse).filter(Warehouse.id == driver.van_warehouse_id).first()
    # Fallback: look up by naming convention
    for suffix in [driver.full_name, driver.username]:
        if not suffix:
            continue
        wh = db.query(Warehouse).filter(
            Warehouse.location_type == 'van',
            Warehouse.name.ilike(f"%{suffix}%")
        ).first()
        if wh:
            return wh
    return None


# ── Phase 52: Driver Performance KPIs ──
@router.get("/performance")
def driver_performance(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Driver performance KPIs for comparison and ranking."""
    from sqlalchemy import func as sqlfunc

    q = db.query(DriverRouteAccount)
    if from_date:
        q = q.filter(DriverRouteAccount.date >= from_date)
    if to_date:
        q = q.filter(DriverRouteAccount.date <= to_date)

    driver_ids = db.query(DriverRouteAccount.driver_id).distinct().all()
    drivers = []

    for (did,) in driver_ids:
        driver = db.query(User).filter(User.id == did).first()
        if not driver:
            continue

        dq = q.filter(DriverRouteAccount.driver_id == did)

        totals = dq.with_entities(
            sqlfunc.count(DriverRouteAccount.id),
            sqlfunc.coalesce(sqlfunc.sum(DriverRouteAccount.total_sales), 0),
            sqlfunc.coalesce(sqlfunc.sum(DriverRouteAccount.total_cost), 0),
            sqlfunc.coalesce(sqlfunc.sum(DriverRouteAccount.total_profit), 0),
            sqlfunc.coalesce(sqlfunc.sum(DriverRouteAccount.collection_cash), 0),
            sqlfunc.coalesce(sqlfunc.sum(DriverRouteAccount.expense_petrol), 0),
            sqlfunc.coalesce(sqlfunc.sum(DriverRouteAccount.expense_others), 0),
            sqlfunc.coalesce(sqlfunc.avg(DriverRouteAccount.profit_percent), 0),
        ).first()

        sheet_count = totals[0] or 0
        total_sales = float(totals[1] or 0)
        total_cost = float(totals[2] or 0)
        total_profit = float(totals[3] or 0)
        total_collected = float(totals[4] or 0)
        total_petrol = float(totals[5] or 0)
        total_other_exp = float(totals[6] or 0)
        avg_margin = float(totals[7] or 0)

        # Best day
        best = dq.order_by(desc(DriverRouteAccount.total_sales)).first()
        # Latest running due
        latest = dq.order_by(desc(DriverRouteAccount.date), desc(DriverRouteAccount.id)).first()

        avg_daily = round(total_sales / sheet_count, 3) if sheet_count > 0 else 0
        collection_rate = round(total_collected / total_sales * 100, 1) if total_sales > 0 else 0

        drivers.append({
            "driver_id": did,
            "driver_name": driver.full_name or driver.username,
            "route_area": getattr(driver, 'route_area', '') or '',
            "sheet_count": sheet_count,
            "total_sales": round(total_sales, 3),
            "total_cost": round(total_cost, 3),
            "total_profit": round(total_profit, 3),
            "avg_margin_pct": round(avg_margin, 1),
            "avg_daily_sales": avg_daily,
            "total_collected": round(total_collected, 3),
            "collection_rate_pct": collection_rate,
            "total_expenses": round(total_petrol + total_other_exp, 3),
            "running_due": round(float(latest.running_due or 0), 3) if latest else 0,
            "best_day_sales": round(float(best.total_sales or 0), 3) if best else 0,
            "best_day_date": best.date.isoformat() if best else None,
        })

    drivers.sort(key=lambda d: d["total_sales"], reverse=True)

    return {
        "period": {"from": from_date, "to": to_date},
        "drivers": drivers,
        "top_seller": drivers[0]["driver_name"] if drivers else None,
        "highest_margin": max(drivers, key=lambda d: d["avg_margin_pct"])["driver_name"] if drivers else None,
        "best_collector": max(drivers, key=lambda d: d["collection_rate_pct"])["driver_name"] if drivers else None,
    }


def _serialize_account(acc, include_items=False):
    d = {
        "id": acc.id,
        "driver_id": acc.driver_id,
        "driver_name": (acc.driver.full_name or acc.driver.username) if acc.driver else "—",
        "date": acc.date.isoformat() if acc.date else None,
        "total_sales": float(acc.total_sales or 0),
        "total_cost": float(acc.total_cost or 0),
        "total_profit": float(acc.total_profit or 0),
        "profit_percent": float(acc.profit_percent or 0),
        "collection_cash": float(acc.collection_cash or 0),
        "expense_petrol": float(acc.expense_petrol or 0),
        "expense_others": float(acc.expense_others or 0),
        "sales_discounts": float(acc.sales_discounts or 0),
        "daily_due": float(acc.daily_due or 0),
        "running_due": float(acc.running_due or 0),
        "notes": acc.notes or "",
        "status": acc.status,
        "created_at": acc.created_at.isoformat() if acc.created_at else None,
    }
    if include_items:
        d["items"] = [
            {
                "id": it.id, "sl_no": it.sl_no,
                "product_id": it.product_id,
                "product_name": it.product_name,
                "unit": it.unit,
                "quantity": float(it.quantity or 0),
                "sell_price": float(it.sell_price or 0),
                "total_sell": float(it.total_sell or 0),
                "purchase_price": float(it.purchase_price or 0),
                "total_purchase": float(it.total_purchase or 0),
                "profit": float(it.profit or 0),
            }
            for it in (acc.items or [])
        ]
    return d
