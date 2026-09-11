-- ==========================================================
-- Mini ERP + CRM Operations Portal - PostgreSQL Schema
-- ==========================================================

-- 1. Users table (Passwords stored exclusively as bcrypt hashes)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Sales', 'Warehouse', 'Accounts')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers CRM table
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  gst VARCHAR(50),
  type VARCHAR(50) DEFAULT 'Retailer' CHECK (type IN ('Wholesaler', 'Retailer', 'Distributor', 'Direct')),
  address TEXT,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Lead', 'Prospect', 'Active', 'Inactive')),
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customer follow-up notes table
CREATE TABLE IF NOT EXISTS customer_notes (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products & Inventory catalog
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100) DEFAULT 'General',
  price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  location VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Stock movements ledger (Immutable audit trail)
CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100) NOT NULL,
  change_qty INTEGER NOT NULL CHECK (change_qty > 0),
  type VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT')),
  reason TEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Sales Challans header
CREATE TABLE IF NOT EXISTS sales_challans (
  id VARCHAR(64) PRIMARY KEY,
  challan_no VARCHAR(50) UNIQUE NOT NULL,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  customer_name VARCHAR(255) NOT NULL,
  customer_gst VARCHAR(50),
  total_qty INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Confirmed', 'Cancelled')),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMPTZ,
  confirmed_by VARCHAR(255),
  notes TEXT
);

-- 7. Challan line items with product snapshot preservation
CREATE TABLE IF NOT EXISTS challan_items (
  id VARCHAR(64) PRIMARY KEY,
  challan_id VARCHAR(64) NOT NULL REFERENCES sales_challans(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_snapshot_name VARCHAR(255) NOT NULL,
  product_snapshot_sku VARCHAR(100) NOT NULL,
  product_snapshot_price NUMERIC(12, 2) NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  line_total NUMERIC(14, 2) NOT NULL
);

-- 8. Activity logs for full portal audit
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal lookup and reporting performance
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_challans_customer ON sales_challans(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_challans_status ON sales_challans(status);
CREATE INDEX IF NOT EXISTS idx_challan_items_challan ON challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);
