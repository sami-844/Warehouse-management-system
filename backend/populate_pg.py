"""Populate Sample Data - AK Al Momaiza Trading WMS"""
import sys
sys.path.insert(0, '/app/backend')
from sqlalchemy import text
from app.core.database import SessionLocal
from app.core.security import get_password_hash

db = SessionLocal()

try:
    print("=" * 60)
    print("POPULATING SAMPLE DATA - AK Al Momaiza Trading")
    print("=" * 60)

    # ── Users ──────────────────────────────────────────────────
    print("\n[1/5] Creating users...")
    db.execute(text("""
        INSERT INTO users (username, email, full_name, hashed_password, role, is_active, is_superuser)
        VALUES ('warehouse_mgr', 'mgr@warehouse.com', 'Warehouse Manager', :p1, 'WAREHOUSE_MANAGER', true, false)
        ON CONFLICT (username) DO NOTHING
    """), {'p1': get_password_hash('warehouse123')})
    db.commit()
    print("   done")

    # ── Warehouse ───────────────────────────────────────────────
    # NOT NULL: code, name, location_type, is_active, created_at
    print("[2/5] Creating warehouse...")
    db.execute(text("""
        INSERT INTO warehouses (code, name, address_line1, city, location_type, is_active)
        VALUES ('WH-001', 'Main Warehouse', 'Industrial Area, Block 5', 'Muscat', 'warehouse', true)
        ON CONFLICT DO NOTHING
    """))
    db.commit()
    print("   done")

    # ── Suppliers ───────────────────────────────────────────────
    # NOT NULL: code, name, payment_terms_days, is_active, created_at
    print("[3/5] Creating suppliers...")
    suppliers = [
        ('SUP-001','Gulf Container Imports LLC','Ahmed Al-Balushi',  '+968-9123-4567','ahmed@gulfcontainer.om', 'Muscat', 'Oman', 90),
        ('SUP-002','Oman Food Distributors',    'Khalid Al-Rashidi', '+968-9234-5678','khalid@omanfood.om',     'Sohar',  'Oman', 7),
        ('SUP-003','Muscat Trading Co.',         'Fatima Al-Said',    '+968-9345-6789','fatima@muscattrading.om','Muscat', 'Oman', 14),
        ('SUP-004','Arabian Beverages Supply',   'Mohammed Al-Harthi','+968-9456-7890','mohammed@arabianbev.om','Salalah','Oman', 21),
    ]
    for code,name,contact,phone,email,city,country,terms in suppliers:
        db.execute(text("""
            INSERT INTO suppliers (code, name, contact_person, phone, email, city, country, payment_terms_days, is_active)
            VALUES (:code,:name,:contact,:phone,:email,:city,:country,:terms,true)
            ON CONFLICT DO NOTHING
        """), dict(code=code,name=name,contact=contact,phone=phone,email=email,city=city,country=country,terms=terms))
    db.commit()
    print(f"   created {len(suppliers)} suppliers")

    # ── Customers ───────────────────────────────────────────────
    # NOT NULL: code, name, payment_terms_days, current_balance, is_active, created_at
    print("[4/5] Creating customers...")
    customers = [
        ('CUST-001','Al-Khuwair Mini Market','Shop Owner',   '+968-2411-1111','Al Khuwair',    'Muscat',30, 5000.000),
        ('CUST-002','Ruwi Grocery Store',    'Shop Manager', '+968-2470-2222','Ruwi',          'Muscat',30,10000.000),
        ('CUST-003','Qurum Supermarket',     'Owner',        '+968-2460-3333','Qurum',         'Muscat',45,15000.000),
        ('CUST-004','Bousher Corner Shop',   'Manager',      '+968-2459-4444','Bousher',       'Muscat',30, 5000.000),
        ('CUST-005','Seeb Local Market',     'Owner',        '+968-2448-5555','Seeb',          'Muscat',30,12000.000),
        ('CUST-006','Azaiba Mini Mart',      'Shop Keeper',  '+968-2454-6666','Azaiba',        'Muscat',30, 5000.000),
        ('CUST-007','Ghubrah Grocery',       'Manager',      '+968-2469-7777','Ghubrah',       'Muscat',30, 8000.000),
        ('CUST-008','Madinat Qaboos Store',  'Owner',        '+968-2460-8888','Madinat Qaboos','Muscat',45,20000.000),
    ]
    for code,name,contact,phone,addr,city,terms,limit in customers:
        db.execute(text("""
            INSERT INTO customers (code, name, contact_person, phone, address_line1, city, payment_terms_days, credit_limit, current_balance, is_active)
            VALUES (:code,:name,:contact,:phone,:addr,:city,:terms,:limit,0.000,true)
            ON CONFLICT DO NOTHING
        """), dict(code=code,name=name,contact=contact,phone=phone,addr=addr,city=city,terms=terms,limit=limit))
    db.commit()
    print(f"   created {len(customers)} customers")

    # ── Products ────────────────────────────────────────────────
    # NOT NULL: sku, name, unit_of_measure, tax_rate, reorder_level, minimum_stock, is_active, is_perishable, created_at
    print("[5/5] Creating products...")
    products = [
        ('DRK001','Coca Cola 330ml (24 pack)',    'carton', 5.000,  7.500, False),
        ('DRK002','Pepsi 330ml (24 pack)',         'carton', 4.800,  7.200, False),
        ('DRK003','Water 500ml (24 pack)',         'carton', 1.500,  2.500, False),
        ('DRK004','Orange Juice 1L (12 pack)',     'carton', 8.000, 12.000, False),
        ('OIL001','Vegetable Oil 1.8L',            'bottle', 3.500,  5.000, False),
        ('OIL002','Olive Oil 500ml',               'bottle', 6.000,  9.000, False),
        ('OIL003','Sunflower Oil 1L',              'bottle', 3.000,  4.500, False),
        ('RICE001','Basmati Rice 5kg',             'bag',   12.000, 18.000, False),
        ('RICE002','White Rice 5kg',               'bag',    8.000, 12.000, False),
        ('RICE003','Pasta 500g (24 pack)',          'carton', 6.000,  9.000, False),
        ('CAN001','Tomato Paste 400g (24 pack)',   'carton',10.000, 15.000, False),
        ('CAN002','Canned Tuna 185g (48 pack)',    'carton',35.000, 50.000, False),
        ('CAN003','Canned Beans 400g (24 pack)',   'carton', 8.000, 12.000, False),
        ('SNK001','Potato Chips 25g (30 pack)',    'carton',12.000, 18.000, False),
        ('SNK002','Biscuits Assorted (24 pack)',   'carton',15.000, 22.000, False),
        ('DRY001','UHT Milk 1L (12 pack)',         'carton',10.000, 15.000, True),
        ('DRY002','Cheese Slices 200g (20 pack)',  'carton',25.000, 38.000, True),
        ('CLN001','Dish Soap 500ml (12 pack)',     'carton', 8.000, 12.000, False),
        ('CLN002','Laundry Detergent 2kg',         'bag',   15.000, 22.000, False),
    ]
    for sku,name,unit,cost,price,perishable in products:
        db.execute(text("""
            INSERT INTO products (sku, name, unit_of_measure, standard_cost, selling_price, tax_rate, reorder_level, minimum_stock, is_active, is_perishable)
            VALUES (:sku,:name,:unit,:cost,:price,5.0,50,20,true,:perishable)
            ON CONFLICT (sku) DO NOTHING
        """), dict(sku=sku,name=name,unit=unit,cost=cost,price=price,perishable=perishable))
    db.commit()
    print(f"   created {len(products)} products")

    print("\n" + "=" * 60)
    print("SUCCESS! All data loaded.")
    print("  admin / admin123")
    print("  warehouse_mgr / warehouse123")
    print("=" * 60)

except Exception as e:
    db.rollback()
    print(f"\nERROR: {e}")
    import traceback; traceback.print_exc()
finally:
    db.close()