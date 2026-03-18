"""Van Sales / Route Accounting — driver daily sales tracking"""
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class DriverRouteAccount(Base):
    """Daily van sales sheet for a driver"""
    __tablename__ = "driver_route_accounts"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    date = Column(Date, nullable=False)

    # Totals (auto-calculated from items)
    total_sales = Column(Numeric(12, 3), default=0)       # sum of sell totals
    total_cost = Column(Numeric(12, 3), default=0)         # sum of purchase totals
    total_profit = Column(Numeric(12, 3), default=0)       # sales - cost
    profit_percent = Column(Numeric(6, 2), default=0)      # profit / sales * 100

    # Collections & expenses
    collection_cash = Column(Numeric(12, 3), default=0)    # cash collected from customers
    expense_petrol = Column(Numeric(12, 3), default=0)
    expense_others = Column(Numeric(12, 3), default=0)
    sales_discounts = Column(Numeric(12, 3), default=0)

    # Due tracking
    daily_due = Column(Numeric(12, 3), default=0)          # total - collection - cash - discounts
    running_due = Column(Numeric(12, 3), default=0)        # cumulative balance driver owes

    notes = Column(Text, nullable=True)
    status = Column(String(20), default='open')            # open / settled

    # Relationships
    driver = relationship("User", foreign_keys=[driver_id])
    items = relationship("DriverRouteAccountItem", back_populates="route_account",
                         cascade="all, delete-orphan", order_by="DriverRouteAccountItem.sl_no")

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)

    def __repr__(self):
        return f"<DriverRouteAccount driver={self.driver_id} date={self.date}>"


class DriverRouteAccountItem(Base):
    """Line item in a daily van sales sheet"""
    __tablename__ = "driver_route_account_items"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    route_account_id = Column(Integer, ForeignKey('driver_route_accounts.id', ondelete='CASCADE'), nullable=False)
    sl_no = Column(Integer, nullable=False)                # serial number in sheet

    product_id = Column(Integer, ForeignKey('products.id'), nullable=True)
    product_name = Column(String(200), nullable=False)     # denormalized for print
    unit = Column(String(30), default='CTN')

    quantity = Column(Numeric(10, 3), default=0)
    sell_price = Column(Numeric(10, 3), default=0)         # per unit sell
    total_sell = Column(Numeric(12, 3), default=0)         # qty * sell_price
    purchase_price = Column(Numeric(10, 3), default=0)     # per unit cost
    total_purchase = Column(Numeric(12, 3), default=0)     # qty * purchase_price
    profit = Column(Numeric(12, 3), default=0)             # total_sell - total_purchase

    # Relationship
    route_account = relationship("DriverRouteAccount", back_populates="items")

    def __repr__(self):
        return f"<RouteItem #{self.sl_no} {self.product_name}>"


class DriverSettlement(Base):
    """Record of a cash settlement from a driver"""
    __tablename__ = "driver_settlements"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    settlement_date = Column(Date, nullable=False)

    amount = Column(Numeric(12, 3), nullable=False)           # amount collected
    payment_method = Column(String(30), default='cash')        # cash / bank
    bank_reference = Column(String(100), nullable=True)        # bank transfer ref if applicable

    running_due_before = Column(Numeric(12, 3), default=0)     # balance before this settlement
    running_due_after = Column(Numeric(12, 3), default=0)      # balance after

    notes = Column(Text, nullable=True)
    settled_by = Column(Integer, ForeignKey('users.id'), nullable=False)  # who processed it

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    driver = relationship("User", foreign_keys=[driver_id])

    def __repr__(self):
        return f"<DriverSettlement driver={self.driver_id} amount={self.amount} date={self.settlement_date}>"
