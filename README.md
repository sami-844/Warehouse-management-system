# Warehouse Management System 🏭

**Custom-built Wholesale Distribution Management System for AK Al Momaiza Trading**

A complete inventory, purchasing, sales, and accounting system designed specifically for FMCG wholesale distribution in Oman.

---

## 📋 Features

### Phase 1 - Foundation (Current)
✅ **User Management**
- Role-based access control (Admin, Warehouse Manager, Staff, Sales, Drivers, Accountant)
- Secure authentication with JWT tokens
- Password hashing with bcrypt

✅ **Product Catalog**
- Product management with SKU and barcode
- Product categories
- Pricing and costing
- Unit of measure support
- Reorder level tracking
- Perishable item flags

✅ **Business Partners**
- Supplier management
- Customer management with credit limits
- Contact information and addresses
- Payment terms tracking

✅ **Warehouse Management**
- Multi-location support (main warehouse + zones)
- Hierarchical warehouse structure
- Location codes for easy identification

✅ **Inventory Tracking**
- Stock transactions (receipt, issue, transfer, adjustment)
- Batch/lot number tracking
- Expiry date management
- Stock level monitoring
- Inventory valuation

### Coming in Phase 2 & 3
- 📦 Purchase Order Management
- 🚚 Sales Order & Delivery Management
- 💰 Accounting Integration
- 📱 Mobile App for Drivers
- 📊 Reports & Analytics
- 📧 Email Notifications

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12 or higher
- PostgreSQL 15+ (or SQLite for testing)
- 8GB RAM minimum

### Installation

1. **Clone/Download the project**
```bash
cd warehouse_system
```

2. **Install Python dependencies**
```bash
cd backend
pip install -r requirements.txt --break-system-packages
```

3. **Configure environment**
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings (use nano, vim, or any text editor)
nano .env
```

**For Quick Testing - Use SQLite (No PostgreSQL needed):**
In your `.env` file, set:
```
DATABASE_URL=sqlite:///./warehouse.db
```

**For Production - Use PostgreSQL:**
```
DATABASE_URL=postgresql://username:password@localhost:5432/warehouse_db
```

4. **Initialize database with sample data**
```bash
python init_db.py
```

This creates:
- Database tables
- Admin user (username: `admin`, password: `admin123`)
- Sample users for testing
- Product categories (Beverages, Oils, Groceries, Snacks)
- Sample products with barcodes
- Main warehouse with zones
- Sample supplier and customers

5. **Start the API server**
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

6. **Access the system**
- API Documentation: http://localhost:8000/api/docs
- Alternative Docs: http://localhost:8000/api/redoc
- Health Check: http://localhost:8000/api/health

---

## 👥 Default User Accounts

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| Administrator | `admin` | `admin123` | Full system access |
| Warehouse Manager | `warehouse_mgr` | `warehouse123` | Warehouse operations |
| Sales Staff | `sales1` | `sales123` | Sales & customers |
| Delivery Driver | `driver1` | `driver123` | Delivery operations |

⚠️ **IMPORTANT**: Change all passwords before production use!

---

## 🗂️ Project Structure

```
warehouse_system/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints (routers)
│   │   ├── core/         # Configuration, database, security
│   │   ├── models/       # SQLAlchemy database models
│   │   ├── schemas/      # Pydantic validation schemas
│   │   ├── crud/         # Database operations
│   │   └── services/     # Business logic
│   ├── tests/            # Unit and integration tests
│   ├── alembic/          # Database migrations
│   ├── main.py           # FastAPI application entry point
│   ├── init_db.py        # Database initialization script
│   └── requirements.txt  # Python dependencies
├── frontend/             # React/Vue.js frontend (Phase 2)
├── .env.example          # Environment variables template
└── README.md             # This file
```

---

## 🔧 Configuration

### Environment Variables

Key settings in `.env` file:

```bash
# Database
DATABASE_URL=sqlite:///./warehouse.db  # or PostgreSQL connection string

# Security
SECRET_KEY=your-super-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application
DEBUG=True
APP_NAME=Warehouse Management System

# Company Info
COMPANY_NAME=AK Al Momaiza Trading
CURRENCY=OMR
```

---

## 📊 Database Models

### Core Tables Created:

1. **users** - System users with roles
2. **products** - Product catalog
3. **product_categories** - Product categorization
4. **suppliers** - Supplier information
5. **customers** - Customer database
6. **warehouses** - Warehouse locations/zones
7. **inventory_transactions** - All stock movements
8. **stock_levels** - Current stock by location

---

## 🧪 Testing the API

### Using the Interactive Docs

1. Open http://localhost:8000/api/docs
2. Click "Authorize" button
3. Login with credentials (e.g., username: `admin`, password: `admin123`)
4. Try the endpoints

### Using curl

```bash
# Health check
curl http://localhost:8000/api/health

# Get API info
curl http://localhost:8000/

# Login (get token)
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Use token for authenticated requests
curl -X GET "http://localhost:8000/api/products" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🔐 Security Features

- **Password Hashing**: Bcrypt with salt
- **JWT Tokens**: Secure authentication
- **Role-Based Access**: Different permissions per role
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Controlled cross-origin access

---

## 📈 Next Steps - Phase 2 Development

To continue development:

1. **Create API Routers** (in `app/api/`)
   - Authentication endpoints
   - Product CRUD operations
   - Inventory management endpoints
   - User management endpoints

2. **Build Frontend** (React or Vue.js)
   - Dashboard
   - Product management screens
   - Inventory tracking interface
   - User login and profile

3. **Add Business Logic** (in `app/services/`)
   - Stock movement calculations
   - Inventory valuation
   - Reorder notifications

4. **Testing**
   - Write unit tests in `tests/`
   - Integration testing
   - API endpoint testing

---

## 🐛 Troubleshooting

### Database Connection Error
```
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Or use SQLite for testing
DATABASE_URL=sqlite:///./warehouse.db
```

### Import Error
```
# Make sure you're in the backend directory
cd backend

# Check Python path
export PYTHONPATH=/home/claude/warehouse_system/backend:$PYTHONPATH
```

### Port Already in Use
```
# Change port in main.py or use:
uvicorn main:app --port 8001
```

---

## 📞 Support

For questions or issues:
- Review the technical specification document
- Check API documentation at `/api/docs`
- Examine error logs in terminal

---

## 📝 License

Custom software for AK Al Momaiza Trading.

---

## 🎯 Development Roadmap

**Phase 1: Foundation** ✅ (Current)
- Database models
- Authentication
- Basic API structure

**Phase 2: Core Operations** (Next - 4 weeks)
- Purchase order management
- Sales order processing
- Delivery management

**Phase 3: Advanced Features** (8-11 weeks)
- Landed cost calculation
- Full accounting integration
- Mobile driver app
- Advanced reporting

**Phase 4: Polish & Launch** (12-14 weeks)
- Performance optimization
- Security hardening
- User training
- Production deployment

---

**Built with ❤️ for AK Al Momaiza Trading**
