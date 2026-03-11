"""Sales module models — SO, delivery, invoice, pricing"""
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Numeric, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class SalesOrder(Base):
    __tablename__ = "sales_orders"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey('customers.id'), nullable=False)
    order_date = Column(Date, nullable=False)
    required_date = Column(Date)
    shipped_date = Column(Date)
    delivered_date = Column(Date)
    status = Column(String(20), default='draft')
    priority = Column(String(20), default='normal')
    subtotal = Column(Numeric(10, 3), default=0)
    tax_amount = Column(Numeric(10, 3), default=0)
    shipping_cost = Column(Numeric(10, 3), default=0)
    discount_amount = Column(Numeric(10, 3), default=0)
    discount_type = Column(String(20), default='none')
    total_amount = Column(Numeric(10, 3), default=0)
    delivery_address = Column(Text)
    delivery_method = Column(String(50))
    driver_id = Column(Integer)
    driver_name = Column(String(100))
    vehicle = Column(String(50))
    route_area = Column(String(100))
    invoice_id = Column(Integer)
    is_complete = Column(Boolean, default=False)
    notes = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    sales_order_id = Column(Integer, ForeignKey('sales_orders.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)
    quantity_ordered = Column(Integer, nullable=False)
    quantity_shipped = Column(Integer, default=0)
    unit_price = Column(Numeric(10, 3), nullable=False)
    unit_cost = Column(Numeric(10, 3))
    discount_percent = Column(Numeric(5, 2), default=0)
    total_price = Column(Numeric(10, 3))
    batch_number = Column(String(100))
    notes = Column(Text)


class Delivery(Base):
    __tablename__ = "deliveries"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    sales_order_id = Column(Integer, ForeignKey('sales_orders.id'))
    vehicle = Column(String(20))
    driver_name = Column(String(100))
    status = Column(String(20), default='scheduled')
    scheduled_date = Column(Date)
    actual_delivery_date = Column(Date)
    delivery_time = Column(String(10))
    delivery_latitude = Column(Numeric(10, 8))
    delivery_longitude = Column(Numeric(11, 8))
    signature_image = Column(Text)
    route_area = Column(String(100))
    customer_name = Column(String(200))
    delivery_notes = Column(Text)
    items_delivered = Column(Text)
    notes = Column(Text)
    pod_photo_base64 = Column(Text, nullable=True)
    pod_captured_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class SalesInvoice(Base):
    __tablename__ = "sales_invoices"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    sales_order_id = Column(Integer, ForeignKey('sales_orders.id'))
    customer_id = Column(Integer, ForeignKey('customers.id'), nullable=False)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    subtotal = Column(Numeric(10, 3), default=0)
    tax_amount = Column(Numeric(10, 3), default=0)
    discount_amount = Column(Numeric(10, 3), default=0)
    total_amount = Column(Numeric(10, 3), default=0)
    amount_paid = Column(Numeric(10, 3), default=0)
    status = Column(String(20), default='pending')
    currency = Column(String(3), default='OMR')
    notes = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class PricingRule(Base):
    __tablename__ = "pricing_rules"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100))
    product_id = Column(Integer, ForeignKey('products.id'))
    customer_id = Column(Integer, ForeignKey('customers.id'))
    min_quantity = Column(Integer, default=1)
    discount_percent = Column(Numeric(5, 2), default=0)
    special_price = Column(Numeric(10, 3))
    valid_from = Column(Date)
    valid_to = Column(Date)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())


class Estimate(Base):
    """Pre-invoice quotation that can be converted to a Sales Order"""
    __tablename__ = "estimates"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    estimate_number = Column(String(50), unique=True, nullable=False)
    estimate_date = Column(Date, nullable=False)
    valid_until = Column(Date)
    customer_id = Column(Integer, ForeignKey('customers.id'))
    po_number = Column(String(100))
    notes = Column(Text)
    terms = Column(Text)
    subtotal = Column(Numeric(14, 3), default=0)
    discount_amount = Column(Numeric(14, 3), default=0)
    tax_amount = Column(Numeric(14, 3), default=0)
    total_amount = Column(Numeric(14, 3), default=0)
    status = Column(String(20), default='draft')
    created_by = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EstimateItem(Base):
    """Line item on an estimate"""
    __tablename__ = "estimate_items"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True)
    estimate_id = Column(Integer, ForeignKey('estimates.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.id'))
    description = Column(String(500))
    quantity = Column(Numeric(12, 3), default=1)
    unit_price = Column(Numeric(12, 3), default=0)
    discount = Column(Numeric(5, 2), default=0)
    tax_rate = Column(Numeric(5, 2), default=0)
    line_total = Column(Numeric(14, 3), default=0)


# Payment model lives in purchase.py — re-export here for backward compat
from app.models.purchase import Payment  # noqa: F401