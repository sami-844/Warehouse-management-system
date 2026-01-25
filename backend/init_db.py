"""
Database initialization script
Creates initial admin user and sample data for testing
"""
import sys
sys.path.append('/home/claude/warehouse_system/backend')

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.product import Product, ProductCategory
from app.models.business_partner import Supplier, Customer
from app.models.inventory import Warehouse


def init_database():
    """Initialize database with sample data"""
    
    print("🔨 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created")
    
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
            print("⚠️  Admin user already exists")
        else:
            # Create admin user
            admin_user = User(
                username="admin",
                email="admin@akalmomiaiza.com",
                full_name="System Administrator",
                hashed_password=get_password_hash("admin"),  # Change this in production!
                role=UserRole.ADMIN,
                is_superuser=True,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("✅ Admin user created (username: admin, password: admin123)")
        
        # Create sample users
        sample_users = [
            {
                "username": "warehouse_mgr",
                "email": "warehouse@akalmomiaiza.com",
                "full_name": "Warehouse Manager",
                "password": "warehouse123",
                "role": UserRole.WAREHOUSE_MANAGER
            },
            {
                "username": "sales1",
                "email": "sales@akalmomiaiza.com",
                "full_name": "Sales Representative",
                "password": "sales123",
                "role": UserRole.SALES_STAFF
            },
            {
                "username": "driver1",
                "email": "driver1@akalmomiaiza.com",
                "full_name": "Delivery Driver 1",
                "password": "driver123",
                "role": UserRole.DELIVERY_DRIVER,
                "employee_id": "DRV001"
            }
        ]
        
        for user_data in sample_users:
            existing = db.query(User).filter(User.username == user_data["username"]).first()
            if not existing:
                user = User(
                    username=user_data["username"],
                    email=user_data["email"],
                    full_name=user_data["full_name"],
                    hashed_password=get_password_hash(user_data["password"]),
                    role=user_data["role"],
                    employee_id=user_data.get("employee_id"),
                    is_active=True
                )
                db.add(user)
        
        db.commit()
        print("✅ Sample users created")
        
        # Create product categories
        categories_data = [
            {"name": "Beverages", "description": "Drinks and beverages"},
            {"name": "Oils", "description": "Cooking oils"},
            {"name": "Groceries", "description": "General grocery items"},
            {"name": "Snacks", "description": "Chips and snacks"},
        ]
        
        for cat_data in categories_data:
            existing = db.query(ProductCategory).filter(ProductCategory.name == cat_data["name"]).first()
            if not existing:
                category = ProductCategory(**cat_data)
                db.add(category)
        
        db.commit()
        print("✅ Product categories created")
        
        # Get category IDs
        beverages = db.query(ProductCategory).filter(ProductCategory.name == "Beverages").first()
        oils = db.query(ProductCategory).filter(ProductCategory.name == "Oils").first()
        groceries = db.query(ProductCategory).filter(ProductCategory.name == "Groceries").first()
        
        # Create sample products
        sample_products = [
            {
                "sku": "BEV-COLA-001",
                "barcode": "8901030123456",
                "name": "Cola Drink 330ml",
                "description": "Carbonated cola drink",
                "category_id": beverages.id if beverages else None,
                "unit_of_measure": "pieces",
                "standard_cost": 0.250,
                "selling_price": 0.400,
                "tax_rate": 5.00,
                "reorder_level": 100,
                "minimum_stock": 50
            },
            {
                "sku": "OIL-VEG-001",
                "barcode": "8901030234567",
                "name": "Vegetable Oil 1L",
                "description": "Pure vegetable cooking oil",
                "category_id": oils.id if oils else None,
                "unit_of_measure": "bottles",
                "standard_cost": 1.500,
                "selling_price": 2.200,
                "tax_rate": 5.00,
                "reorder_level": 50,
                "minimum_stock": 25
            },
            {
                "sku": "GRO-RICE-001",
                "barcode": "8901030345678",
                "name": "Basmati Rice 5kg",
                "description": "Premium basmati rice",
                "category_id": groceries.id if groceries else None,
                "unit_of_measure": "bags",
                "standard_cost": 3.750,
                "selling_price": 5.500,
                "tax_rate": 5.00,
                "reorder_level": 30,
                "minimum_stock": 15
            }
        ]
        
        for product_data in sample_products:
            existing = db.query(Product).filter(Product.sku == product_data["sku"]).first()
            if not existing:
                product = Product(**product_data, created_by=1)
                db.add(product)
        
        db.commit()
        print("✅ Sample products created")
        
        # Create main warehouse
        existing_warehouse = db.query(Warehouse).filter(Warehouse.code == "WH-MAIN").first()
        if not existing_warehouse:
            main_warehouse = Warehouse(
                code="WH-MAIN",
                name="Main Warehouse",
                location_type="main",
                address_line1="Industrial Area",
                city="Muscat"
            )
            db.add(main_warehouse)
            db.commit()
            
            # Create warehouse zones
            zones = [
                {"code": "WH-MAIN-A", "name": "Zone A - Beverages", "parent_id": main_warehouse.id, "location_type": "zone"},
                {"code": "WH-MAIN-B", "name": "Zone B - Oils", "parent_id": main_warehouse.id, "location_type": "zone"},
                {"code": "WH-MAIN-C", "name": "Zone C - Groceries", "parent_id": main_warehouse.id, "location_type": "zone"},
            ]
            
            for zone_data in zones:
                zone = Warehouse(**zone_data)
                db.add(zone)
            
            db.commit()
            print("✅ Warehouses and zones created")
        
        # Create sample supplier
        existing_supplier = db.query(Supplier).filter(Supplier.code == "SUP-001").first()
        if not existing_supplier:
            supplier = Supplier(
                code="SUP-001",
                name="Global FMCG Supplies LLC",
                contact_person="Ahmed Hassan",
                email="ahmed@globalfmcg.com",
                phone="+971-50-1234567",
                city="Dubai",
                country="UAE",
                payment_terms_days=60,
                is_active=True
            )
            db.add(supplier)
            db.commit()
            print("✅ Sample supplier created")
        
        # Create sample customers
        sample_customers = [
            {
                "code": "CUST-001",
                "name": "Al Wadi Grocery Store",
                "business_type": "Grocery",
                "contact_person": "Mohammed Ali",
                "phone": "+968-9123-4567",
                "area": "Al Khuwair",
                "city": "Muscat",
                "payment_terms_days": 7,
                "credit_limit": 1000.000
            },
            {
                "code": "CUST-002",
                "name": "Al Nahda Supermarket",
                "business_type": "Supermarket",
                "contact_person": "Fatima Ahmed",
                "phone": "+968-9234-5678",
                "area": "Ruwi",
                "city": "Muscat",
                "payment_terms_days": 14,
                "credit_limit": 2000.000
            }
        ]
        
        for customer_data in sample_customers:
            existing = db.query(Customer).filter(Customer.code == customer_data["code"]).first()
            if not existing:
                customer = Customer(**customer_data, is_active=True)
                db.add(customer)
        
        db.commit()
        print("✅ Sample customers created")
        
        print("\n🎉 Database initialization completed successfully!")
        print("\n📝 Login Credentials:")
        print("   Admin: username=admin, password=admin123")
        print("   Warehouse Manager: username=warehouse_mgr, password=warehouse123")
        print("   Sales Staff: username=sales1, password=sales123")
        print("   Driver: username=driver1, password=driver123")
        print("\n⚠️  Remember to change these passwords in production!")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
