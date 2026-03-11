"""Van Sales / Route Accounting API — driver daily sales sheets"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import Optional, List
from datetime import date, datetime

from app.core.database import get_db
from app.models.van_sales import DriverRouteAccount, DriverRouteAccountItem
from app.models.user import User
from app.models.product import Product
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


# ── Settle a driver's balance ──
@router.post("/accounts/{account_id}/settle")
def settle_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    acc = db.query(DriverRouteAccount).filter(DriverRouteAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Route account not found")
    acc.status = 'settled'
    db.commit()
    return {"message": "Account settled"}


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
