-- ============================================
-- WAREHOUSE MANAGEMENT SYSTEM - ENHANCED SCHEMA
-- For KPI Dashboard and Analytics
-- ============================================

-- Assuming you already have these tables (if not, uncomment):
-- CREATE TABLE IF NOT EXISTS users (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     username VARCHAR(50) UNIQUE NOT NULL,
--     email VARCHAR(100) UNIQUE NOT NULL,
--     password_hash VARCHAR(255) NOT NULL,
--     role VARCHAR(20) DEFAULT 'user',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE TABLE IF NOT EXISTS categories (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     name VARCHAR(100) NOT NULL,
--     description TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- ============================================
-- ENHANCED PRODUCTS TABLE
-- ============================================
-- Extending existing products table with additional fields needed for KPIs
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INTEGER,
    
    -- Cost and Pricing
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- What you pay to supplier
    selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- What you sell for
    
    -- Stock Levels
    current_stock INTEGER DEFAULT 0,
    reorder_point INTEGER DEFAULT 0,  -- When to reorder
    reorder_quantity INTEGER DEFAULT 0,  -- How many to order
    safety_stock INTEGER DEFAULT 0,  -- Minimum buffer stock
    maximum_stock INTEGER DEFAULT 0,  -- Maximum storage capacity
    
    -- Lead Time
    lead_time_days INTEGER DEFAULT 7,  -- Days from order to delivery
    
    -- Unit of Measurement
    unit VARCHAR(20) DEFAULT 'pcs',  -- pcs, kg, liter, etc.
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_dead_stock BOOLEAN DEFAULT FALSE,  -- Product not moving
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_stock_update TIMESTAMP,
    
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- ============================================
-- SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    payment_terms VARCHAR(100),  -- e.g., "Net 30", "COD"
    average_lead_time INTEGER DEFAULT 7,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    business_name VARCHAR(200),
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    customer_type VARCHAR(50) DEFAULT 'retail',  -- retail, wholesale
    credit_limit DECIMAL(10, 2) DEFAULT 0,
    payment_terms VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PURCHASE ORDERS (from suppliers)
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Status: pending, approved, ordered, in_transit, received, cancelled
    status VARCHAR(20) DEFAULT 'pending',
    
    -- Totals
    subtotal DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    
    notes TEXT,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- PURCHASE ORDER ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,  -- Cost price at time of order
    total_price DECIMAL(10, 2) NOT NULL,
    received_quantity INTEGER DEFAULT 0,
    
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- SALES ORDERS (to customers)
-- ============================================
CREATE TABLE IF NOT EXISTS sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    order_date DATE NOT NULL,
    required_date DATE,
    shipped_date DATE,
    delivered_date DATE,
    
    -- Status: pending, confirmed, processing, shipped, delivered, cancelled, returned
    status VARCHAR(20) DEFAULT 'pending',
    
    -- Priority: normal, urgent, high
    priority VARCHAR(20) DEFAULT 'normal',
    
    -- Totals
    subtotal DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Delivery
    delivery_address TEXT,
    delivery_method VARCHAR(50),  -- van1, van2, customer_pickup
    
    -- Perfect Order Rate tracking
    is_complete BOOLEAN DEFAULT FALSE,  -- All items delivered
    is_on_time BOOLEAN DEFAULT FALSE,  -- Delivered by required_date
    is_damage_free BOOLEAN DEFAULT TRUE,  -- No damage reported
    is_accurate BOOLEAN DEFAULT TRUE,  -- Correct items and quantities
    
    notes TEXT,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- SALES ORDER ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS sales_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity_ordered INTEGER NOT NULL,
    quantity_shipped INTEGER DEFAULT 0,
    unit_price DECIMAL(10, 2) NOT NULL,  -- Selling price at time of order
    unit_cost DECIMAL(10, 2) NOT NULL,  -- Cost price for COGS calculation
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    total_price DECIMAL(10, 2) NOT NULL,
    
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- STOCK MOVEMENTS (Comprehensive tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    
    -- Movement Type: 
    -- IN: purchase, return_from_customer, adjustment_in, transfer_in
    -- OUT: sale, return_to_supplier, adjustment_out, transfer_out, damaged, expired
    movement_type VARCHAR(30) NOT NULL,
    
    quantity INTEGER NOT NULL,  -- Positive for IN, Negative for OUT
    
    -- References
    reference_type VARCHAR(50),  -- 'purchase_order', 'sales_order', 'adjustment', etc.
    reference_id INTEGER,  -- ID of the related order/transaction
    
    -- Costs for COGS calculation
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    
    -- Stock levels after this movement
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    
    -- Location tracking (if you have multiple warehouses)
    warehouse_location VARCHAR(100),
    
    notes TEXT,
    performed_by INTEGER,
    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- ============================================
-- STOCK ADJUSTMENTS (Manual corrections)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity_change INTEGER NOT NULL,  -- Can be positive or negative
    reason VARCHAR(50) NOT NULL,  -- damaged, expired, theft, found, count_correction
    cost_impact DECIMAL(10, 2),
    notes TEXT,
    performed_by INTEGER NOT NULL,
    adjustment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- ============================================
-- RETURNS (Customer returns)
-- ============================================
CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number VARCHAR(50) UNIQUE NOT NULL,
    sales_order_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    return_date DATE NOT NULL,
    
    -- Status: pending, approved, rejected, refunded, restocked
    status VARCHAR(20) DEFAULT 'pending',
    
    -- Reason: damaged, defective, wrong_item, not_needed, expired
    reason VARCHAR(50) NOT NULL,
    
    refund_amount DECIMAL(10, 2) DEFAULT 0,
    restocking_fee DECIMAL(10, 2) DEFAULT 0,
    
    notes TEXT,
    processed_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (processed_by) REFERENCES users(id)
);

-- ============================================
-- RETURN ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    condition VARCHAR(30),  -- damaged, good, defective
    restockable BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- DELIVERY TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_order_id INTEGER NOT NULL,
    vehicle VARCHAR(20),  -- van1, van2
    driver_name VARCHAR(100),
    
    -- Status: scheduled, in_progress, completed, failed
    status VARCHAR(20) DEFAULT 'scheduled',
    
    scheduled_date DATE NOT NULL,
    actual_delivery_date DATE,
    delivery_time TIME,
    
    -- GPS tracking (optional)
    delivery_latitude DECIMAL(10, 8),
    delivery_longitude DECIMAL(11, 8),
    
    signature_image TEXT,  -- Base64 or file path
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id)
);

-- ============================================
-- INVENTORY SNAPSHOTS (for historical analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    stock_quantity INTEGER NOT NULL,
    stock_value DECIMAL(10, 2) NOT NULL,
    snapshot_date DATE NOT NULL,
    
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_returns_customer ON returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);

-- ============================================
-- VIEWS for Common KPI Calculations
-- ============================================

-- Current Stock Levels with Status
CREATE VIEW IF NOT EXISTS v_stock_status AS
SELECT 
    p.id,
    p.sku,
    p.name,
    p.current_stock,
    p.reorder_point,
    p.safety_stock,
    p.maximum_stock,
    p.cost_price,
    p.selling_price,
    (p.current_stock * p.cost_price) as stock_value,
    CASE 
        WHEN p.current_stock = 0 THEN 'out_of_stock'
        WHEN p.current_stock <= p.reorder_point THEN 'low_stock'
        WHEN p.current_stock >= p.maximum_stock THEN 'overstock'
        ELSE 'in_stock'
    END as stock_status,
    CASE 
        WHEN p.is_dead_stock = 1 THEN 'dead_stock'
        ELSE NULL
    END as special_status
FROM products p
WHERE p.is_active = 1;

-- Sales Order Summary by Status
CREATE VIEW IF NOT EXISTS v_sales_order_summary AS
SELECT 
    status,
    COUNT(*) as order_count,
    SUM(total_amount) as total_value
FROM sales_orders
WHERE order_date >= date('now', '-30 days')
GROUP BY status;

-- Product Movement Summary (Last 30 days)
CREATE VIEW IF NOT EXISTS v_product_movement_summary AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku,
    SUM(CASE WHEN sm.movement_type IN ('sale') THEN ABS(sm.quantity) ELSE 0 END) as units_sold,
    SUM(CASE WHEN sm.movement_type IN ('purchase') THEN sm.quantity ELSE 0 END) as units_purchased,
    COUNT(DISTINCT DATE(sm.movement_date)) as active_days
FROM products p
LEFT JOIN stock_movements sm ON p.id = sm.product_id 
    AND sm.movement_date >= date('now', '-30 days')
GROUP BY p.id, p.name, p.sku;