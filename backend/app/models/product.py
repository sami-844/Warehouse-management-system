"""
Product model - Product catalog with SKU, barcode, and pricing
"""
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ProductCategory(Base):
    """Product categories for organizing items"""
    __tablename__ = "product_categories"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey('product_categories.id'), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    products = relationship("Product", back_populates="category")
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<ProductCategory {self.name}>"


class Product(Base):
    """Product master data - catalog of all items"""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    barcode = Column(String(100), unique=True, nullable=True, index=True)
    
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    category_id = Column(Integer, ForeignKey('product_categories.id'), nullable=True)
    
    # Unit of measure (pieces, kg, liters, boxes, etc.)
    unit_of_measure = Column(String(20), nullable=False, default="pieces")
    
    # Pricing
    standard_cost = Column(Numeric(10, 3), nullable=True)  # What we pay
    selling_price = Column(Numeric(10, 3), nullable=True)  # What we charge
    
    # Tax
    tax_rate = Column(Numeric(5, 2), nullable=False, default=0.00)  # e.g., 5.00 for 5%
    
    # Inventory management
    reorder_level = Column(Integer, nullable=False, default=10)  # When to reorder
    minimum_stock = Column(Integer, nullable=False, default=5)
    maximum_stock = Column(Integer, nullable=True)
    
    # Product specifications
    weight = Column(Numeric(10, 3), nullable=True)  # in kg
    volume = Column(Numeric(10, 3), nullable=True)  # in liters
    
    # Supplier info
    default_supplier_id = Column(Integer, ForeignKey('suppliers.id'), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_perishable = Column(Boolean, default=False, nullable=False)  # Has expiry date?

    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(Integer, nullable=True)
    deleted_reason = Column(Text, nullable=True)
    
    # Relationships
    category = relationship("ProductCategory", back_populates="products")
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    
    def __repr__(self):
        return f"<Product {self.sku}: {self.name}>"


class DeletedItemsLog(Base):
    """Audit log for all deleted items (products, customers, etc.)"""
    __tablename__ = "deleted_items_log"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String(50), default="product")
    item_id = Column(Integer)
    item_name = Column(String(500))
    item_sku = Column(String(200))
    item_data = Column(Text)
    deleted_by_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    deleted_by_name = Column(String(200))
    deleted_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_reason = Column(Text)
    restored_at = Column(DateTime(timezone=True), nullable=True)
    restored_by_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    restored_by_name = Column(String(200), nullable=True)
    is_restored = Column(Boolean, default=False)
