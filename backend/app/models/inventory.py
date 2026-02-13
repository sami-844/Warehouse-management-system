"""
Warehouse and Inventory models - Stock tracking across locations
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text, Enum as SQLEnum, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
from enum import Enum


class TransactionType(str, Enum):
    """Types of inventory transactions"""
    RECEIPT = "RECEIPT"           # Goods coming in
    ISSUE = "ISSUE"               # Goods going out
    TRANSFER_IN = "TRANSFER_IN"   # Transfer into location
    TRANSFER_OUT = "TRANSFER_OUT" # Transfer out of location
    ADJUSTMENT = "ADJUSTMENT"     # Stock correction


class Warehouse(Base):
    """Warehouse locations - main warehouse with zones/sections"""
    __tablename__ = "warehouses"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    
    # Location details
    address_line1 = Column(String(200), nullable=True)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    
    # Type: main, zone, aisle, shelf
    location_type = Column(String(20), nullable=False, default="main")
    parent_id = Column(Integer, ForeignKey('warehouses.id'), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Warehouse {self.code}: {self.name}>"


class InventoryTransaction(Base):
    """
    Inventory movements - all stock in/out/transfer transactions
    This is the core table for tracking stock movements
    """
    __tablename__ = "inventory_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # What product moved
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False, index=True)
    
    # Where it moved
    warehouse_id = Column(Integer, ForeignKey('warehouses.id'), nullable=False, index=True)
    
    # Movement details
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)  
    # Types: RECEIPT, ISSUE, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT
    
    quantity = Column(Numeric(10, 3), nullable=False)  # Positive for IN, Negative for OUT
    
    # Batch/Lot tracking
    batch_number = Column(String(50), nullable=True, index=True)
    expiry_date = Column(Date, nullable=True)
    
    # Costing
    unit_cost = Column(Numeric(10, 3), nullable=True)  # Cost per unit at time of transaction
    total_cost = Column(Numeric(12, 3), nullable=True)  # quantity * unit_cost
    
    # Reference to source document
    reference_type = Column(String(50), nullable=True)  # PurchaseReceipt, SalesOrder, etc.
    reference_id = Column(Integer, nullable=True)
    reference_number = Column(String(50), nullable=True, index=True)
    
    # Transfer details (if type is TRANSFER)
    from_warehouse_id = Column(Integer, ForeignKey('warehouses.id'), nullable=True)
    to_warehouse_id = Column(Integer, ForeignKey('warehouses.id'), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Transaction date/time
    transaction_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Who did it
    created_by = Column(Integer, nullable=False)
    
    def __repr__(self):
        return f"<InventoryTransaction {self.transaction_type} - Product:{self.product_id} Qty:{self.quantity}>"


class StockLevel(Base):
    """
    Current stock levels - aggregated view of inventory
    This table is updated by triggers/background jobs for performance
    """
    __tablename__ = "stock_levels"
    
    id = Column(Integer, primary_key=True, index=True)
    
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey('warehouses.id'), nullable=False, index=True)
    
    # Current quantities
    quantity_on_hand = Column(Numeric(10, 3), nullable=False, default=0)  # Physical stock
    quantity_reserved = Column(Numeric(10, 3), nullable=False, default=0)  # Reserved for orders
    quantity_available = Column(Numeric(10, 3), nullable=False, default=0)  # on_hand - reserved
    
    # Valuation
    total_value = Column(Numeric(12, 3), nullable=False, default=0)
    average_cost = Column(Numeric(10, 3), nullable=True)
    
    # Last movement
    last_transaction_date = Column(DateTime(timezone=True), nullable=True)
    
    # Audit
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<StockLevel Product:{self.product_id} Warehouse:{self.warehouse_id} Qty:{self.quantity_on_hand}>"
