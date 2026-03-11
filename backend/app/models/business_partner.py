"""
Business partner models - Suppliers and Customers
"""
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Supplier(Base):
    """Supplier master data - companies we buy from"""
    __tablename__ = "suppliers"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    
    # Contact information
    contact_person = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    mobile = Column(String(20), nullable=True)
    
    # Address
    address_line1 = Column(String(200), nullable=True)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    
    # Payment terms
    payment_terms_days = Column(Integer, nullable=False, default=30)  # e.g., Net 30
    credit_limit = Column(Numeric(12, 3), nullable=True)
    
    # Tax information
    tax_id = Column(String(50), nullable=True)  # VAT number, etc.
    
    # Banking
    bank_name = Column(String(100), nullable=True)
    bank_account = Column(String(50), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)

    # Vendor classification
    vendor_type = Column(String(20), default='supplier')  # supplier, delivery_vendor

    is_active = Column(Boolean, default=True, nullable=False)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

    def __repr__(self):
        return f"<Supplier {self.code}: {self.name}>"


class Customer(Base):
    """Customer master data - shops and markets we sell to"""
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    
    # Business type
    business_type = Column(String(50), nullable=True)  # Grocery, Market, Supermarket
    
    # Contact information
    contact_person = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    mobile = Column(String(20), nullable=True)
    
    # Address
    address_line1 = Column(String(200), nullable=True)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    area = Column(String(100), nullable=True)  # Territory/Route
    postal_code = Column(String(20), nullable=True)
    
    # GPS coordinates for delivery routing
    latitude = Column(Numeric(10, 8), nullable=True)
    longitude = Column(Numeric(11, 8), nullable=True)
    
    # Payment terms
    payment_terms_days = Column(Integer, nullable=False, default=7)  # e.g., Net 7
    credit_limit = Column(Numeric(12, 3), nullable=True)
    current_balance = Column(Numeric(12, 3), nullable=False, default=0.00)
    
    # Tax information
    tax_id = Column(String(50), nullable=True)
    
    # Delivery preferences
    preferred_delivery_day = Column(String(20), nullable=True)  # Monday, Tuesday, etc.
    delivery_instructions = Column(Text, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    
    def __repr__(self):
        return f"<Customer {self.code}: {self.name}>"
