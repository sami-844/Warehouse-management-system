"""Purchase module models — PO, receipts, invoices, landed costs, payments"""
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Numeric, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, )
    po_number = Column(String(50), unique=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey('suppliers.id'), nullable=False)
    order_date = Column(Date, nullable=False)
    expected_delivery_date = Column(Date)
    actual_delivery_date = Column(Date)
    received_date = Column(Date)
    status = Column(String(20), default='draft')
    subtotal = Column(Numeric(10, 3), default=0)
    tax_amount = Column(Numeric(10, 3), default=0)
    shipping_cost = Column(Numeric(10, 3), default=0)
    total_amount = Column(Numeric(10, 3), default=0)
    container_reference = Column(String(100))
    freight_cost = Column(Numeric(10, 3), default=0)
    customs_duty = Column(Numeric(10, 3), default=0)
    handling_cost = Column(Numeric(10, 3), default=0)
    insurance_cost = Column(Numeric(10, 3), default=0)
    local_transport_cost = Column(Numeric(10, 3), default=0)
    currency = Column(String(3), default='OMR')
    exchange_rate = Column(Numeric(10, 6), default=1)
    notes = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey('purchase_orders.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 3), nullable=False)
    total_price = Column(Numeric(10, 3))
    received_quantity = Column(Integer, default=0)
    batch_number = Column(String(100))
    expiry_date = Column(Date)
    notes = Column(Text)


class PurchaseReceipt(Base):
    __tablename__ = "purchase_receipts"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    receipt_number = Column(String(50), unique=True, nullable=False)
    purchase_order_id = Column(Integer, ForeignKey('purchase_orders.id'), nullable=False)
    warehouse_id = Column(Integer, ForeignKey('warehouses.id'), nullable=False)
    received_date = Column(Date, nullable=False)
    quality_notes = Column(Text)
    notes = Column(Text)
    received_by = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())


class PurchaseReceiptItem(Base):
    __tablename__ = "purchase_receipt_items"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey('purchase_receipts.id'), nullable=False)
    purchase_order_item_id = Column(Integer, ForeignKey('purchase_order_items.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)
    quantity_received = Column(Numeric(10, 2), nullable=False)
    batch_number = Column(String(100))
    expiry_date = Column(Date)
    quality_status = Column(String(20), default='accepted')
    notes = Column(Text)


class LandedCost(Base):
    __tablename__ = "landed_costs"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey('purchase_orders.id'), nullable=False)
    cost_type = Column(String(50), nullable=False)
    description = Column(String(200))
    amount = Column(Numeric(10, 3), nullable=False, default=0)
    currency = Column(String(3), default='OMR')
    allocation_method = Column(String(20), default='by_value')
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class PurchaseInvoice(Base):
    __tablename__ = "purchase_invoices"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    purchase_order_id = Column(Integer, ForeignKey('purchase_orders.id'))
    supplier_id = Column(Integer, ForeignKey('suppliers.id'), nullable=False)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    subtotal = Column(Numeric(10, 3), default=0)
    tax_amount = Column(Numeric(10, 3), default=0)
    total_amount = Column(Numeric(10, 3), default=0)
    amount_paid = Column(Numeric(10, 3), default=0)
    status = Column(String(20), default='pending')
    currency = Column(String(3), default='OMR')
    notes = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    payment_type = Column(String(20), nullable=False)
    reference_type = Column(String(30), nullable=False)
    reference_id = Column(Integer, nullable=False)
    amount = Column(Numeric(10, 3), nullable=False)
    payment_method = Column(String(20), default='bank_transfer')
    payment_date = Column(Date, nullable=False)
    bank_reference = Column(String(100))
    notes = Column(Text)
    recorded_by = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
