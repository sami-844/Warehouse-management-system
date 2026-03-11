"""
Product Management API endpoints
Create, Read, Update, Delete products
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

from app.core.database import get_db
from app.models.product import Product, ProductCategory
from app.models.user import User
from app.schemas.product import (
    Product as ProductSchema,
    ProductCreate,
    ProductUpdate,
    ProductCategory as CategorySchema,
    ProductCategoryCreate,
    ProductCategoryUpdate
)
from app.api.auth import get_current_user

router = APIRouter()


# ==================== PRODUCT CATEGORIES ====================

@router.get("/categories", response_model=List[CategorySchema])
def list_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all product categories
    
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum number of records to return
    """
    categories = db.query(ProductCategory).offset(skip).limit(limit).all()
    return categories


@router.post("/categories", response_model=CategorySchema, status_code=201)
def create_category(
    category: ProductCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new product category
    
    Requires authentication
    """
    # Check if category name already exists
    existing = db.query(ProductCategory).filter(ProductCategory.name == category.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")
    
    db_category = ProductCategory(**category.dict())
    db.add(db_category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Category name already exists")
    db.refresh(db_category)
    return db_category


@router.get("/categories/{category_id}", response_model=CategorySchema)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific category by ID
    """
    category = db.query(ProductCategory).filter(ProductCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.put("/categories/{category_id}", response_model=CategorySchema)
def update_category(
    category_id: int,
    category_update: ProductCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a product category."""
    db_cat = db.query(ProductCategory).filter(ProductCategory.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    update_data = category_update.dict(exclude_unset=True)
    if "name" in update_data and update_data["name"] != db_cat.name:
        existing = db.query(ProductCategory).filter(ProductCategory.name == update_data["name"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category name already exists")
    for field, value in update_data.items():
        setattr(db_cat, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Category name already exists")
    db.refresh(db_cat)
    return db_cat


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft-delete a product category. Blocks if products are assigned."""
    db_cat = db.query(ProductCategory).filter(ProductCategory.id == category_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    product_count = db.query(Product).filter(Product.category_id == category_id, Product.is_active == True).count()
    if product_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {product_count} active products assigned")
    db_cat.is_active = False
    db.commit()
    return None


# ==================== PRODUCTS ====================

@router.get("/products", response_model=List[ProductSchema])
def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all products with optional filters
    
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum number of records to return
    - **category_id**: Filter by category
    - **search**: Search in product name or SKU
    - **is_active**: Filter by active status
    """
    query = db.query(Product)
    
    # Apply filters
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Product.name.ilike(search_filter)) | 
            (Product.sku.ilike(search_filter)) |
            (Product.barcode.ilike(search_filter))
        )
    
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    
    products = query.offset(skip).limit(limit).all()
    return products


@router.post("/products", response_model=ProductSchema, status_code=201)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new product
    
    Requires authentication
    """
    # Check if SKU already exists
    existing = db.query(Product).filter(Product.sku == product.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    # Check if barcode already exists (if provided)
    if product.barcode:
        existing_barcode = db.query(Product).filter(Product.barcode == product.barcode).first()
        if existing_barcode:
            raise HTTPException(status_code=400, detail="Barcode already exists")
    
    # Create product
    db_product = Product(**product.dict(), created_by=current_user.id)
    db.add(db_product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="SKU or barcode already exists")
    db.refresh(db_product)
    return db_product


@router.get("/products/{product_id}", response_model=ProductSchema)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific product by ID
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/sku/{sku}", response_model=ProductSchema)
def get_product_by_sku(
    sku: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific product by SKU
    
    Useful for barcode scanning operations
    """
    product = db.query(Product).filter(Product.sku == sku).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/barcode/{barcode}", response_model=ProductSchema)
def get_product_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific product by barcode
    
    Useful for barcode scanning operations
    """
    product = db.query(Product).filter(Product.barcode == barcode).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/products/{product_id}", response_model=ProductSchema)
def update_product(
    product_id: int,
    product_update: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing product
    
    Only provided fields will be updated
    """
    # Get existing product
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update only provided fields
    update_data = product_update.dict(exclude_unset=True)
    
    # Check for SKU conflict if SKU is being updated
    if "sku" in update_data and update_data["sku"] != db_product.sku:
        existing = db.query(Product).filter(Product.sku == update_data["sku"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="SKU already exists")
    
    # Check for barcode conflict if barcode is being updated
    if "barcode" in update_data and update_data["barcode"] and update_data["barcode"] != db_product.barcode:
        existing = db.query(Product).filter(Product.barcode == update_data["barcode"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Barcode already exists")
    
    # Update fields
    for field, value in update_data.items():
        setattr(db_product, field, value)
    
    db_product.updated_by = current_user.id
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="SKU or barcode conflict with existing product")
    db.refresh(db_product)
    return db_product


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a product (soft delete - sets is_active to False)
    
    Note: This doesn't actually delete from database, just marks as inactive
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Soft delete
    product.is_active = False
    product.updated_by = current_user.id
    db.commit()

    return None


@router.post("/products/import", status_code=201)
def import_products(
    rows: List[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk import products from CSV rows. Skips rows with duplicate SKU."""
    created, skipped, errors = 0, 0, []
    for i, row in enumerate(rows):
        try:
            sku = str(row.get('sku', '') or '').strip()
            name = str(row.get('name', '') or '').strip()
            if not sku or not name:
                skipped += 1
                continue
            if db.query(Product).filter(Product.sku == sku).first():
                skipped += 1
                continue
            barcode = str(row.get('barcode', '') or '').strip() or None
            if barcode and db.query(Product).filter(Product.barcode == barcode).first():
                barcode = None
            p = Product(
                sku=sku, name=name,
                unit=str(row.get('unit', 'PCS') or 'PCS').strip(),
                selling_price=float(row.get('selling_price', 0) or 0),
                standard_cost=float(row.get('standard_cost', 0) or 0),
                barcode=barcode,
                description=str(row.get('description', '') or '').strip() or None,
                is_active=True, created_by=current_user.id
            )
            db.add(p)
            created += 1
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
            skipped += 1
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Import failed — database constraint error")
    return {"created": created, "skipped": skipped, "errors": errors[:10]}


@router.get("/products/avg-costs")
def product_avg_costs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Average cost per product from purchase order items."""
    from sqlalchemy import text
    from app.core.database import engine
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT poi.product_id,
                       ROUND(COALESCE(SUM(poi.quantity * poi.unit_price), 0) /
                             NULLIF(COALESCE(SUM(poi.quantity), 0), 0), 3) as avg_cost,
                       COALESCE(SUM(poi.quantity), 0) as total_qty
                FROM purchase_order_items poi
                GROUP BY poi.product_id
            """))
            keys = rows.keys()
            data = {r[0]: {"avg_cost": float(r[1] or 0), "total_qty": int(r[2] or 0)}
                    for r in rows.fetchall()}
        return {"costs": data}
    except Exception:
        return {"costs": {}}