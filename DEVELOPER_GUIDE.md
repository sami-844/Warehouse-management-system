# Developer Guide - Warehouse Management System

This guide helps you understand the codebase and continue development.

---

## 🏗️ Architecture Overview

### Three-Tier Architecture

```
┌─────────────────────────────────────┐
│     Presentation Layer              │
│  (React/Vue.js - Phase 2)           │
└─────────────────────────────────────┘
                 │
                 │ HTTP/REST API
                 ▼
┌─────────────────────────────────────┐
│     Business Logic Layer            │
│  (FastAPI + Python)                 │
│  - API Routes                       │
│  - Business Services                │
│  - Data Validation                  │
└─────────────────────────────────────┘
                 │
                 │ SQLAlchemy ORM
                 ▼
┌─────────────────────────────────────┐
│     Data Layer                      │
│  (PostgreSQL / SQLite)              │
│  - Database Tables                  │
│  - Relationships                    │
└─────────────────────────────────────┘
```

---

## 📁 Code Organization

### Directory Structure Explained

```
backend/
├── app/
│   ├── api/              # API endpoints (routers)
│   │   ├── auth.py       # Authentication endpoints
│   │   ├── products.py   # Product CRUD endpoints
│   │   ├── inventory.py  # Inventory operations
│   │   └── users.py      # User management
│   │
│   ├── core/             # Core configuration
│   │   ├── config.py     # Settings and environment variables
│   │   ├── database.py   # Database connection
│   │   └── security.py   # Authentication utilities
│   │
│   ├── models/           # SQLAlchemy ORM models
│   │   ├── user.py       # User table
│   │   ├── product.py    # Product and category tables
│   │   ├── business_partner.py  # Suppliers and customers
│   │   └── inventory.py  # Warehouse and stock tables
│   │
│   ├── schemas/          # Pydantic validation schemas
│   │   ├── user.py       # User DTOs
│   │   └── product.py    # Product DTOs
│   │
│   ├── crud/             # Database operations
│   │   └── (to be created)
│   │
│   └── services/         # Business logic
│       └── (to be created)
│
├── tests/                # Unit and integration tests
├── main.py               # FastAPI app entry point
└── init_db.py            # Database initialization
```

---

## 🔑 Key Concepts

### 1. Models (Database Layer)

Models define your database structure using SQLAlchemy ORM.

**Example: Product Model**
```python
from sqlalchemy import Column, Integer, String, Numeric
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    selling_price = Column(Numeric(10, 3), nullable=True)
```

**Key Points:**
- Inherits from `Base`
- `__tablename__` defines table name in database
- Columns with types, constraints, indexes
- Relationships between tables

### 2. Schemas (Validation Layer)

Schemas validate API input/output using Pydantic.

**Example: Product Schema**
```python
from pydantic import BaseModel, Field

class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1)
    selling_price: Optional[Decimal] = None
```

**Key Points:**
- Define what data the API accepts
- Automatic validation
- Separate schemas for Create, Update, Response

### 3. CRUD Operations (Data Access Layer)

CRUD = Create, Read, Update, Delete operations.

**Example: Get Product by SKU**
```python
def get_product_by_sku(db: Session, sku: str):
    return db.query(Product).filter(Product.sku == sku).first()
```

### 4. API Routes (Endpoint Layer)

Routes define HTTP endpoints.

**Example: Get All Products**
```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db

router = APIRouter()

@router.get("/products")
def list_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    products = db.query(Product).offset(skip).limit(limit).all()
    return products
```

---

## 🔨 How to Add a New Feature

### Example: Adding "Purchase Orders"

**Step 1: Create the Model**
```python
# app/models/purchase.py
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from app.core.database import Base

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    
    id = Column(Integer, primary_key=True)
    po_number = Column(String(50), unique=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey('suppliers.id'))
    order_date = Column(DateTime, nullable=False)
    total_amount = Column(Numeric(12, 3), nullable=False)
    status = Column(String(20), default="draft")
```

**Step 2: Create Schemas**
```python
# app/schemas/purchase.py
from pydantic import BaseModel
from datetime import datetime

class PurchaseOrderCreate(BaseModel):
    po_number: str
    supplier_id: int
    order_date: datetime

class PurchaseOrder(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    total_amount: Decimal
    status: str
    
    class Config:
        from_attributes = True
```

**Step 3: Create CRUD Functions**
```python
# app/crud/purchase.py
from sqlalchemy.orm import Session
from app.models.purchase import PurchaseOrder

def create_purchase_order(db: Session, po_data):
    po = PurchaseOrder(**po_data.dict())
    db.add(po)
    db.commit()
    db.refresh(po)
    return po

def get_purchase_orders(db: Session):
    return db.query(PurchaseOrder).all()
```

**Step 4: Create API Router**
```python
# app/api/purchases.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.purchase import PurchaseOrderCreate, PurchaseOrder
from app.crud import purchase as crud

router = APIRouter()

@router.post("/purchase-orders", response_model=PurchaseOrder)
def create_po(po: PurchaseOrderCreate, db: Session = Depends(get_db)):
    return crud.create_purchase_order(db, po)

@router.get("/purchase-orders", response_model=List[PurchaseOrder])
def list_pos(db: Session = Depends(get_db)):
    return crud.get_purchase_orders(db)
```

**Step 5: Register Router in main.py**
```python
# main.py
from app.api import purchases

app.include_router(
    purchases.router,
    prefix="/api",
    tags=["Purchase Orders"]
)
```

**Step 6: Update Database**
```bash
# Create migration
alembic revision --autogenerate -m "Add purchase orders"

# Apply migration
alembic upgrade head
```

---

## 🔒 Authentication Flow

### How It Works

1. **User logs in** → POST `/api/auth/login`
2. **Server validates** credentials
3. **Server generates** JWT token
4. **Client stores** token
5. **Client sends** token with each request
6. **Server validates** token on protected endpoints

### Code Example

```python
# Login endpoint
@router.post("/login", response_model=Token)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    # 1. Find user
    user = db.query(User).filter(User.username == credentials.username).first()
    
    # 2. Verify password
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # 3. Create token
    token = create_access_token(data={"sub": user.username})
    
    return {"access_token": token, "token_type": "bearer"}

# Protected endpoint
@router.get("/me")
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Decode token
    payload = decode_access_token(token)
    username = payload.get("sub")
    
    # Get user
    user = db.query(User).filter(User.username == username).first()
    return user
```

---

## 📊 Database Best Practices

### 1. Always Use Indexes

```python
# Index frequently queried columns
sku = Column(String(50), unique=True, index=True)
barcode = Column(String(100), unique=True, index=True)
```

### 2. Use Relationships

```python
# In Product model
category = relationship("ProductCategory", back_populates="products")

# In ProductCategory model
products = relationship("Product", back_populates="category")
```

### 3. Add Audit Fields

```python
created_at = Column(DateTime, server_default=func.now())
updated_at = Column(DateTime, onupdate=func.now())
created_by = Column(Integer)
updated_by = Column(Integer)
```

### 4. Use Transactions

```python
try:
    # Multiple operations
    db.add(object1)
    db.add(object2)
    db.commit()
except Exception as e:
    db.rollback()
    raise
```

---

## 🧪 Testing

### Unit Test Example

```python
# tests/test_products.py
import pytest
from app.models.product import Product

def test_create_product(db):
    product = Product(
        sku="TEST-001",
        name="Test Product",
        selling_price=10.00
    )
    db.add(product)
    db.commit()
    
    assert product.id is not None
    assert product.sku == "TEST-001"
```

### API Test Example

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_list_products():
    response = client.get("/api/products")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

---

## 🚀 Deployment Checklist

Before going to production:

- [ ] Change all default passwords
- [ ] Update SECRET_KEY in .env
- [ ] Set DEBUG=False
- [ ] Configure CORS properly
- [ ] Use PostgreSQL (not SQLite)
- [ ] Set up SSL/HTTPS
- [ ] Configure backup strategy
- [ ] Set up monitoring
- [ ] Test all endpoints
- [ ] Write documentation
- [ ] Train users

---

## 🐛 Common Issues & Solutions

### Issue: Import Error
```bash
# Solution: Set PYTHONPATH
export PYTHONPATH=/path/to/warehouse_system/backend:$PYTHONPATH
```

### Issue: Database Lock (SQLite)
```python
# Solution: Use PostgreSQL for concurrent access
DATABASE_URL=postgresql://user:pass@localhost/warehouse_db
```

### Issue: CORS Error
```python
# Solution: Add frontend URL to CORS_ORIGINS in .env
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
```

---

## 📚 Useful Resources

- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/
- **Pydantic Docs**: https://docs.pydantic.dev/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

## 💡 Tips for Success

1. **Start Small**: Build one feature completely before moving to the next
2. **Test Often**: Test each endpoint as you build it
3. **Use Git**: Commit your code regularly
4. **Document**: Add comments to complex code
5. **Follow Patterns**: Keep consistent structure across features
6. **Ask Questions**: Reference this guide and the spec document

---

**Happy Coding! 🎉**
