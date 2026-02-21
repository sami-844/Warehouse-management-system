-- ── Product Categories ──
INSERT INTO product_categories (name, description, is_active) VALUES
('Beverages', 'Juices, water, soft drinks', true),
('Dairy', 'Milk, cheese, yogurt', true),
('Snacks', 'Chips, biscuits, nuts', true),
('Cleaning', 'Detergents, bleach, cleaners', true),
('Personal Care', 'Soap, shampoo, toothpaste', true)
ON CONFLICT DO NOTHING;

-- ── Warehouse ──
INSERT INTO warehouses (name, code, address, is_active) VALUES
('Main Warehouse', 'WH-01', 'Industrial Area, Muscat, Oman', true)
ON CONFLICT DO NOTHING;

-- ── Products ──
INSERT INTO products (sku, name, description, category_id, unit_of_measure, selling_price, cost_price, reorder_level, is_active) VALUES
('BEV-001', 'Rani Float Mango 240ml', 'Mango fruit drink with pulp', 1, 'Carton', 5.500, 3.800, 20, true),
('BEV-002', 'Volvic Water 1.5L', 'Still mineral water', 1, 'Carton', 3.200, 2.100, 30, true),
('BEV-003', 'Pepsi Cola 330ml x24', 'Carbonated soft drink', 1, 'Carton', 4.800, 3.200, 25, true),
('BEV-004', 'Almarai Orange Juice 1L', 'Fresh squeezed orange juice', 1, 'Carton', 6.500, 4.500, 20, true),
('DAI-001', 'Baladna Full Fat Milk 1L', 'Fresh full fat milk', 2, 'Carton', 4.200, 2.900, 30, true),
('DAI-002', 'Almarai Cheddar Cheese 500g', 'Processed cheddar slices', 2, 'Box', 3.800, 2.600, 15, true),
('DAI-003', 'Activia Yogurt Strawberry 120g x4', 'Probiotic yogurt pack', 2, 'Carton', 2.900, 2.000, 20, true),
('SNK-001', 'Lays Classic Chips 170g x24', 'Salted potato chips', 3, 'Carton', 7.200, 5.100, 20, true),
('SNK-002', 'Digestive Biscuits 400g', 'Whole wheat biscuits', 3, 'Box', 2.500, 1.700, 25, true),
('SNK-003', 'Planters Mixed Nuts 300g', 'Salted mixed nuts', 3, 'Box', 4.500, 3.100, 15, true),
('CLN-001', 'Ariel Powder 3kg', 'Laundry detergent', 4, 'Carton', 8.500, 6.000, 15, true),
('CLN-002', 'Clorox Bleach 3.7L', 'Original bleach', 4, 'Carton', 5.200, 3.600, 20, true),
('CLN-003', 'Fairy Liquid 500ml x12', 'Dish washing liquid', 4, 'Carton', 9.600, 6.800, 15, true),
('PCA-001', 'Lux Soap Bar 120g x4', 'Beauty soap multipack', 5, 'Carton', 3.600, 2.400, 25, true),
('PCA-002', 'Head & Shoulders 400ml', 'Anti-dandruff shampoo', 5, 'Box', 4.800, 3.300, 20, true)
ON CONFLICT (sku) DO NOTHING;

-- ── Suppliers ──
INSERT INTO suppliers (code, name, contact_person, email, phone, city, country, payment_terms_days, is_active) VALUES
('SUP-001', 'Gulf Trading Co LLC', 'Ahmed Al Balushi', 'ahmed@gulftrade.om', '+968 2412 3456', 'Muscat', 'Oman', 30, true),
('SUP-002', 'Dubai FMCG Distributors', 'Mohammed Hassan', 'mhassan@dfd.ae', '+971 4 234 5678', 'Dubai', 'UAE', 45, true),
('SUP-003', 'Al Jazira Foods LLC', 'Khalid Al Amri', 'khalid@aljazira.om', '+968 2498 7654', 'Sohar', 'Oman', 30, true)
ON CONFLICT (code) DO NOTHING;

-- ── Customers ──
INSERT INTO customers (code, name, contact_person, phone, area, credit_limit, payment_terms_days, is_active) VALUES
('CUST-001', 'Al Noor Grocery', 'Samir Khalil', '+968 9123 4567', 'Ruwi', 500.000, 30, true),
('CUST-002', 'Majan Mini Mart', 'Tariq Sulaiman', '+968 9234 5678', 'Qurum', 750.000, 30, true),
('CUST-003', 'Barka General Store', 'Younis Al Farsi', '+968 9345 6789', 'Barka', 600.000, 30, true),
('CUST-004', 'Sohar Family Shop', 'Rashid Al Kindi', '+968 9456 7890', 'Sohar', 800.000, 45, true),
('CUST-005', 'Muscat Corner Store', 'Ibrahim Nasser', '+968 9567 8901', 'Muscat', 400.000, 15, true),
('CUST-006', 'Nizwa Market', 'Hamad Al Hinai', '+968 9678 9012', 'Nizwa', 550.000, 30, true)
ON CONFLICT (code) DO NOTHING;

-- ── Stock Levels ──
INSERT INTO stock_levels (product_id, warehouse_id, quantity, reserved_quantity)
SELECT p.id, w.id, 
  CASE p.sku
    WHEN 'BEV-001' THEN 45 WHEN 'BEV-002' THEN 60 WHEN 'BEV-003' THEN 35
    WHEN 'BEV-004' THEN 28 WHEN 'DAI-001' THEN 50 WHEN 'DAI-002' THEN 22
    WHEN 'DAI-003' THEN 40 WHEN 'SNK-001' THEN 30 WHEN 'SNK-002' THEN 55
    WHEN 'SNK-003' THEN 18 WHEN 'CLN-001' THEN 25 WHEN 'CLN-002' THEN 38
    WHEN 'CLN-003' THEN 20 WHEN 'PCA-001' THEN 45 WHEN 'PCA-002' THEN 32
    ELSE 20 END,
  0
FROM products p, warehouses w
WHERE w.code = 'WH-01'
ON CONFLICT DO NOTHING;

