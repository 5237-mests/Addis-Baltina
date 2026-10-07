-- ========================================================
-- Addis Baltina - Production Database Schema (MySQL 8.0+)
-- ========================================================

CREATE DATABASE IF NOT EXISTS addis_baltina CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE addis_baltina;

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name_en VARCHAR(128) NOT NULL,
  name_am VARCHAR(128) NOT NULL,
  name_om VARCHAR(128) NOT NULL,
  description_en TEXT,
  description_am TEXT,
  description_om TEXT,
  icon VARCHAR(64) DEFAULT 'Package',
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  category_id VARCHAR(64) NOT NULL,
  sku VARCHAR(64) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_am VARCHAR(255) NOT NULL,
  name_om VARCHAR(255) NOT NULL,
  description_en TEXT,
  description_am TEXT,
  description_om TEXT,
  price DECIMAL(10, 2) NOT NULL, -- Ethiopian Birr (ETB)
  stock INT NOT NULL DEFAULT 0,
  min_stock_alert INT NOT NULL DEFAULT 5,
  unit VARCHAR(32) NOT NULL DEFAULT '500g', -- e.g. 250g, 500g, 1kg
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  origin VARCHAR(128) DEFAULT 'Addis Ababa, Ethiopia',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- Product Images Table
CREATE TABLE IF NOT EXISTS product_images (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  url TEXT NOT NULL,
  alt_text VARCHAR(255),
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  role ENUM('CUSTOMER', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  full_name VARCHAR(128) NOT NULL,
  phone VARCHAR(32),
  email VARCHAR(128) UNIQUE,
  telegram_user_id VARCHAR(64) UNIQUE,
  telegram_username VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Addresses Table
CREATE TABLE IF NOT EXISTS addresses (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  subcity VARCHAR(64) NOT NULL,
  woreda VARCHAR(32),
  house_no VARCHAR(64),
  landmark VARCHAR(255),
  city VARCHAR(64) DEFAULT 'Addis Ababa',
  phone VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY, -- e.g. AB-2026-XXXX
  user_id VARCHAR(64),
  customer_name VARCHAR(128) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  delivery_subcity VARCHAR(64) NOT NULL,
  delivery_woreda VARCHAR(32),
  delivery_landmark VARCHAR(255),
  delivery_notes TEXT,
  payment_method ENUM('CASH_ON_DELIVERY', 'TELEBIRR', 'CBE_BIRR', 'IN_STORE_PICKUP') NOT NULL DEFAULT 'CASH_ON_DELIVERY',
  payment_reference VARCHAR(128),
  status ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL,
  idempotency_key VARCHAR(128) UNIQUE,
  source ENUM('TELEGRAM_MINI_APP', 'WEB', 'PWA') NOT NULL DEFAULT 'WEB',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Inventory Transactions Table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  change_amount INT NOT NULL, -- e.g. -2 for sale, +50 for restock
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  reason ENUM('ORDER_PLACEMENT', 'ORDER_CANCELLATION', 'RESTOCK', 'DAMAGE', 'AUDIT_ADJUSTMENT') NOT NULL,
  reference_id VARCHAR(64), -- order_id or admin action ref
  performed_by VARCHAR(64) DEFAULT 'SYSTEM',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('ORDER_UPDATE', 'LOW_STOCK', 'PROMOTION', 'SYSTEM') NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  action VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  details JSON,
  performed_by VARCHAR(64) NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
