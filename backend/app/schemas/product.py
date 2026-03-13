"""
Pydantic schemas for Product model - API request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProductCategoryBase(BaseModel):
    """Base product category schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: bool = True


class ProductCategoryCreate(ProductCategoryBase):
    """Schema for creating a product category"""
    pass


class ProductCategoryUpdate(BaseModel):
    """Schema for updating a product category"""
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None


class ProductCategory(ProductCategoryBase):
    """Product category response schema"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    """Base product schema with common fields"""
    sku: str = Field(..., min_length=1, max_length=50)
    barcode: Optional[str] = Field(None, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category_id: Optional[int] = None
    unit_of_measure: str = Field(default="pieces", max_length=20)
    standard_cost: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = Field(default=0.00, ge=0, le=100)
    reorder_level: Optional[int] = Field(default=10, ge=0)
    minimum_stock: Optional[int] = Field(default=5, ge=0)
    maximum_stock: Optional[int] = None
    weight: Optional[Decimal] = None
    volume: Optional[Decimal] = None
    default_supplier_id: Optional[int] = None
    is_active: bool = True
    is_perishable: bool = False


class ProductCreate(ProductBase):
    """Schema for creating a new product"""
    brand_id: Optional[int] = None
    opening_qty: Optional[int] = 0
    opening_cost: Optional[Decimal] = None

    class Config:
        extra = 'allow'  # don't reject unknown fields from frontend


class ProductUpdate(BaseModel):
    """Schema for updating a product (all fields optional)"""
    sku: Optional[str] = None
    barcode: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    unit_of_measure: Optional[str] = None
    standard_cost: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    reorder_level: Optional[int] = None
    minimum_stock: Optional[int] = None
    maximum_stock: Optional[int] = None
    weight: Optional[Decimal] = None
    volume: Optional[Decimal] = None
    default_supplier_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_perishable: Optional[bool] = None
    brand_id: Optional[int] = None

    class Config:
        extra = 'allow'  # don't reject unknown fields from frontend


class Product(ProductBase):
    """Product response schema"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    # Optional relationships
    category: Optional[ProductCategory] = None
    
    class Config:
        from_attributes = True


class ProductWithStock(Product):
    """Product with current stock information"""
    current_stock: Decimal = 0
    stock_value: Decimal = 0
    warehouses_count: int = 0
