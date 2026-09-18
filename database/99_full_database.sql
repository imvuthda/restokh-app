-- ============================================================
-- SOURCE: 00_create_database.sql
-- ============================================================
CREATE DATABASE IF NOT EXISTS restaurant_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE restaurant_management;
SET NAMES utf8mb4;
SET time_zone = '+07:00';


-- ============================================================
-- SOURCE: 01_branches.sql
-- ============================================================

CREATE TABLE branches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  name_kh VARCHAR(150) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(500) NULL,
  address_kh VARCHAR(500) NULL,
  tax_number VARCHAR(100) NULL,
  logo VARCHAR(500) NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'USD',
  timezone VARCHAR(60) NOT NULL DEFAULT 'Asia/Phnom_Penh',
  is_head_office TINYINT(1) NOT NULL DEFAULT 0,
  head_office_unique TINYINT GENERATED ALWAYS AS (IF(is_head_office=1,1,NULL)) STORED,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_branches_code (code),
  UNIQUE KEY uk_branches_single_head_office (head_office_unique),
  KEY idx_branches_active (is_active)
) ENGINE=InnoDB;

-- ============================================================
-- SOURCE: 02_auth.sql
-- ============================================================

CREATE TABLE roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_roles_code (code)
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(120) NOT NULL,
  module VARCHAR(60) NOT NULL,
  action VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  UNIQUE KEY uk_permissions_code (code),
  UNIQUE KEY uk_permissions_module_action (module, action)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  employee_code VARCHAR(50) NULL,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  full_name_kh VARCHAR(150) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  avatar VARCHAR(500) NULL,
  preferred_language ENUM('en','km') NOT NULL DEFAULT 'km',
  failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  password_changed_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_employee_code (employee_code),
  KEY idx_users_branch_active (branch_id, is_active),
  CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  device_name VARCHAR(200) NULL,
  ip_address VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_user (user_id, expires_at),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE revoked_access_tokens (
  jti CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_revoked_tokens_expiry (expires_at),
  CONSTRAINT fk_revoked_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_branch_date (branch_id, created_at),
  CONSTRAINT fk_audit_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SOURCE: 03_restaurant_tables.sql
-- ============================================================

CREATE TABLE dining_areas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_kh VARCHAR(100) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dining_areas_branch_code (branch_id, code),
  CONSTRAINT fk_dining_areas_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE table_shapes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_kh VARCHAR(100) NULL,
  shape_type ENUM('square','rectangle','round','oval') NOT NULL DEFAULT 'square',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_table_shapes_branch_code (branch_id,code),
  CONSTRAINT fk_table_shapes_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE restaurant_tables (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  dining_area_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  capacity SMALLINT UNSIGNED NOT NULL DEFAULT 4,
  shape VARCHAR(40) NOT NULL DEFAULT 'square',
  position_x DECIMAL(10,2) NULL,
  position_y DECIMAL(10,2) NULL,
  status ENUM('available','occupied','reserved','cleaning','inactive') NOT NULL DEFAULT 'available',
  qr_token VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tables_branch_code (branch_id, code),
  UNIQUE KEY uk_tables_qr_token (qr_token),
  KEY idx_tables_area_status (dining_area_id, status),
  CONSTRAINT fk_tables_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tables_area FOREIGN KEY (dining_area_id) REFERENCES dining_areas(id) ON DELETE RESTRICT
) ENGINE=InnoDB;


-- ============================================================
-- SOURCE: 04_menu.sql
-- ============================================================

CREATE TABLE kitchen_stations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_kh VARCHAR(100) NULL,
  printer_name VARCHAR(150) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stations_branch_code (branch_id, code),
  CONSTRAINT fk_stations_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE menu_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT UNSIGNED NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,
  name_kh VARCHAR(120) NULL,
  image VARCHAR(500) NULL,
  color VARCHAR(20) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_menu_categories_code (code),
  CONSTRAINT fk_menu_categories_parent FOREIGN KEY (parent_id) REFERENCES menu_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE menu_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  kitchen_station_id BIGINT UNSIGNED NULL,
  sku VARCHAR(60) NOT NULL,
  barcode VARCHAR(100) NULL,
  name VARCHAR(180) NOT NULL,
  name_kh VARCHAR(180) NULL,
  description TEXT NULL,
  image VARCHAR(500) NULL,
  item_type ENUM('food','beverage','service') NOT NULL DEFAULT 'food',
  base_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(14,4) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
  preparation_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  track_stock TINYINT(1) NOT NULL DEFAULT 0,
  allow_discount TINYINT(1) NOT NULL DEFAULT 1,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_menu_items_sku (sku),
  UNIQUE KEY uk_menu_items_barcode (barcode),
  KEY idx_menu_items_category_active (category_id, is_active, is_available),
  CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_menu_items_station FOREIGN KEY (kitchen_station_id) REFERENCES kitchen_stations(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE menu_item_prices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NOT NULL,
  price_type ENUM('dine_in','takeaway','delivery') NOT NULL DEFAULT 'dine_in',
  price DECIMAL(14,2) NOT NULL,
  effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to DATETIME NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_item_prices_current (menu_item_id, branch_id, price_type, effective_from),
  KEY idx_item_prices_lookup (branch_id, menu_item_id, price_type, is_current),
  CONSTRAINT fk_item_prices_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_prices_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE modifier_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  name_kh VARCHAR(120) NULL,
  min_select SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_select SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE modifiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  modifier_group_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  name_kh VARCHAR(120) NULL,
  price_delta DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_modifiers_group FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE menu_item_modifier_groups (
  menu_item_id BIGINT UNSIGNED NOT NULL,
  modifier_group_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (menu_item_id, modifier_group_id),
  CONSTRAINT fk_item_mod_groups_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_mod_groups_group FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- SOURCE: 05_inventory.sql
-- ============================================================

CREATE TABLE units (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(80) NOT NULL,
  name_kh VARCHAR(80) NULL,
  decimal_places TINYINT UNSIGNED NOT NULL DEFAULT 2,
  UNIQUE KEY uk_units_code (code)
) ENGINE=InnoDB;

CREATE TABLE ingredients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  unit_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(60) NOT NULL,
  barcode VARCHAR(100) NULL,
  name VARCHAR(180) NOT NULL,
  name_kh VARCHAR(180) NULL,
  average_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(14,4) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ingredients_sku (sku),
  UNIQUE KEY uk_ingredients_barcode (barcode),
  CONSTRAINT fk_ingredients_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE recipes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  ingredient_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(14,4) NOT NULL,
  wastage_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  notes VARCHAR(300) NULL,
  UNIQUE KEY uk_recipes_item_ingredient (menu_item_id, ingredient_id),
  CONSTRAINT fk_recipes_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_recipes_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE inventory (
  branch_id BIGINT UNSIGNED NOT NULL,
  ingredient_id BIGINT UNSIGNED NOT NULL,
  quantity_on_hand DECIMAL(14,4) NOT NULL DEFAULT 0,
  quantity_reserved DECIMAL(14,4) NOT NULL DEFAULT 0,
  average_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  last_movement_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (branch_id, ingredient_id),
  CONSTRAINT fk_inventory_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE stock_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  ingredient_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('opening','purchase','sale','sale_void','adjustment_in','adjustment_out','transfer_in','transfer_out','waste','return_supplier') NOT NULL,
  quantity DECIMAL(14,4) NOT NULL,
  unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  balance_after DECIMAL(14,4) NOT NULL,
  reference_type VARCHAR(60) NULL,
  reference_id BIGINT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_stock_movements_lookup (branch_id, ingredient_id, created_at),
  KEY idx_stock_movements_reference (reference_type, reference_id),
  CONSTRAINT fk_stock_movements_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_stock_movements_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_stock_movements_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE stock_adjustments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  adjustment_no VARCHAR(50) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('draft','approved','posted','cancelled') NOT NULL DEFAULT 'draft',
  adjustment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  posted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_adjustments_branch_no (branch_id, adjustment_no),
  CONSTRAINT fk_adjustments_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_adjustments_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_adjustments_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE stock_adjustment_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_adjustment_id BIGINT UNSIGNED NOT NULL,
  ingredient_id BIGINT UNSIGNED NOT NULL,
  system_quantity DECIMAL(14,4) NOT NULL,
  actual_quantity DECIMAL(14,4) NOT NULL,
  difference_quantity DECIMAL(14,4) NOT NULL,
  unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_adjustment_items (stock_adjustment_id, ingredient_id),
  CONSTRAINT fk_adjustment_items_header FOREIGN KEY (stock_adjustment_id) REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  CONSTRAINT fk_adjustment_items_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
) ENGINE=InnoDB;


-- ============================================================
-- SOURCE: 06_purchases.sql
-- ============================================================

CREATE TABLE suppliers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(180) NOT NULL,
  contact_name VARCHAR(150) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(500) NULL,
  tax_number VARCHAR(100) NULL,
  credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0,
  opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_suppliers_code (code),
  KEY idx_suppliers_name (name)
) ENGINE=InnoDB;

CREATE TABLE purchases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  purchase_no VARCHAR(50) NOT NULL,
  supplier_invoice_no VARCHAR(100) NULL,
  purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_date DATE NULL,
  status ENUM('draft','ordered','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  due_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  received_by BIGINT UNSIGNED NULL,
  received_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_purchases_branch_no (branch_id, purchase_no),
  KEY idx_purchases_supplier_date (supplier_id, purchase_date),
  KEY idx_purchases_branch_status (branch_id, status),
  CONSTRAINT fk_purchases_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchases_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchases_receiver FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE purchase_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id BIGINT UNSIGNED NOT NULL,
  ingredient_id BIGINT UNSIGNED NOT NULL,
  ordered_quantity DECIMAL(14,4) NOT NULL,
  received_quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(14,4) NOT NULL,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(14,2) NOT NULL,
  UNIQUE KEY uk_purchase_items (purchase_id, ingredient_id),
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE purchase_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id BIGINT UNSIGNED NOT NULL,
  payment_no VARCHAR(50) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference_no VARCHAR(150) NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_purchase_payment_no (payment_no),
  CONSTRAINT fk_purchase_payments_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_payments_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;


-- ============================================================
-- SOURCE: 07_customers.sql
-- ============================================================

CREATE TABLE customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(180) NOT NULL,
  name_kh VARCHAR(180) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  gender ENUM('male','female','other','unknown') NOT NULL DEFAULT 'unknown',
  date_of_birth DATE NULL,
  address VARCHAR(500) NULL,
  customer_type ENUM('regular','vip','staff','partner') NOT NULL DEFAULT 'regular',
  default_discount_percent DECIMAL(7,4) NOT NULL DEFAULT 0,
  loyalty_points DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_customers_code (code),
  UNIQUE KEY uk_customers_phone (phone),
  CONSTRAINT chk_customers_default_discount CHECK (default_discount_percent >= 0 AND default_discount_percent <= 100)
) ENGINE=InnoDB;

CREATE TABLE reservations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  table_id BIGINT UNSIGNED NULL,
  reservation_no VARCHAR(50) NOT NULL,
  guest_name VARCHAR(180) NOT NULL,
  guest_phone VARCHAR(30) NOT NULL,
  guest_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  reservation_at DATETIME NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 90,
  deposit_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('pending','confirmed','seated','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
  notes TEXT NULL,
  checked_in_at DATETIME NULL,
  checked_in_by BIGINT UNSIGNED NULL,
  completed_at DATETIME NULL,
  completed_by BIGINT UNSIGNED NULL,
  cancelled_at DATETIME NULL,
  cancelled_by BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_reservations_branch_no (branch_id, reservation_no),
  KEY idx_reservations_schedule (branch_id, reservation_at, status),
  KEY idx_reservations_table_status (table_id, status, reservation_at),
  CONSTRAINT fk_reservations_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_reservations_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  CONSTRAINT fk_reservations_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_checked_in_by FOREIGN KEY (checked_in_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reservations_completed_by FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reservations_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- ============================================================
-- SOURCE: 08_orders.sql
-- ============================================================

CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  table_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  reservation_id BIGINT UNSIGNED NULL,
  order_no VARCHAR(50) NOT NULL,
  order_type ENUM('dine_in','takeaway','delivery') NOT NULL DEFAULT 'dine_in',
  status ENUM('draft','open','sent_to_kitchen','preparing','ready','served','partially_paid','paid','cancelled','voided') NOT NULL DEFAULT 'open',
  guest_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_type ENUM('none','percent','fixed') NOT NULL DEFAULT 'none',
  discount_value DECIMAL(14,4) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_reason VARCHAR(255) NULL,
  discount_applied_by BIGINT UNSIGNED NULL,
  discount_applied_at DATETIME NULL,
  service_charge_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
  service_charge_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  rounding_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  opened_by BIGINT UNSIGNED NOT NULL,
  closed_by BIGINT UNSIGNED NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_orders_branch_no (branch_id, order_no),
  KEY idx_orders_branch_status_date (branch_id, status, opened_at),
  KEY idx_orders_table_status (table_id, status),
  KEY idx_orders_customer (customer_id, opened_at),
  KEY idx_orders_discount_applied_by (discount_applied_by),
  CONSTRAINT fk_orders_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_opened_by FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_discount_applied_by FOREIGN KEY (discount_applied_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  kitchen_station_id BIGINT UNSIGNED NULL,
  parent_item_id BIGINT UNSIGNED NULL,
  submission_key VARCHAR(100) NULL,
  submission_line INT UNSIGNED NULL,
  item_name VARCHAR(180) NOT NULL,
  item_name_kh VARCHAR(180) NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(14,2) NOT NULL,
  kitchen_status ENUM('pending','sent','preparing','ready','served','cancelled') NOT NULL DEFAULT 'pending',
  course_no SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  notes VARCHAR(500) NULL,
  sent_at DATETIME NULL,
  ready_at DATETIME NULL,
  served_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  cancelled_by BIGINT UNSIGNED NULL,
  cancellation_reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_submission_line (order_id, submission_key, submission_line),
  KEY idx_order_items_kitchen (kitchen_station_id, kitchen_status, sent_at),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_station FOREIGN KEY (kitchen_station_id) REFERENCES kitchen_stations(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_items_parent FOREIGN KEY (parent_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_items_cancel_user FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE order_item_modifiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_item_id BIGINT UNSIGNED NOT NULL,
  modifier_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_order_modifiers_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE kitchen_tickets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  kitchen_station_id BIGINT UNSIGNED NOT NULL,
  ticket_no VARCHAR(50) NOT NULL,
  sequence_no INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('new','accepted','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'new',
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME NULL,
  ready_at DATETIME NULL,
  completed_at DATETIME NULL,
  UNIQUE KEY uk_kitchen_ticket (branch_id, ticket_no),
  KEY idx_kitchen_queue (kitchen_station_id, status, sent_at),
  CONSTRAINT fk_kitchen_tickets_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_kitchen_tickets_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_kitchen_tickets_station FOREIGN KEY (kitchen_station_id) REFERENCES kitchen_stations(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE kitchen_ticket_items (
  kitchen_ticket_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (kitchen_ticket_id, order_item_id),
  CONSTRAINT fk_ticket_items_ticket FOREIGN KEY (kitchen_ticket_id) REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE table_transfers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  from_table_id BIGINT UNSIGNED NULL,
  to_table_id BIGINT UNSIGNED NOT NULL,
  transferred_by BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_table_transfers_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_table_transfers_from FOREIGN KEY (from_table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  CONSTRAINT fk_table_transfers_to FOREIGN KEY (to_table_id) REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  CONSTRAINT fk_table_transfers_user FOREIGN KEY (transferred_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- SOURCE: 09_payments.sql
-- ============================================================

CREATE TABLE payment_methods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,
  name_kh VARCHAR(120) NULL,
  method_type ENUM('cash','qr','card','bank','credit','other') NOT NULL DEFAULT 'other',
  requires_reference TINYINT(1) NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_payment_methods_branch_code (branch_id,code),
  KEY idx_payment_methods_branch_active (branch_id,is_active,sort_order),
  CONSTRAINT fk_payment_methods_branch FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE cash_registers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_registers_branch_code (branch_id, code),
  CONSTRAINT fk_registers_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE cash_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cash_register_id BIGINT UNSIGNED NOT NULL,
  opened_by BIGINT UNSIGNED NOT NULL,
  closed_by BIGINT UNSIGNED NULL,
  opening_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  expected_amount DECIMAL(14,2) NULL,
  closing_amount DECIMAL(14,2) NULL,
  difference_amount DECIMAL(14,2) NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  notes VARCHAR(500) NULL,
  KEY idx_cash_sessions_register_status (cash_register_id, status),
  CONSTRAINT fk_cash_sessions_register FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cash_sessions_opened_by FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cash_sessions_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  cash_session_id BIGINT UNSIGNED NULL,
  payment_no VARCHAR(50) NOT NULL,
  request_key VARCHAR(100) NULL,
  payment_method VARCHAR(50) NOT NULL,
  currency_code ENUM('USD','KHR') NOT NULL DEFAULT 'USD',
  exchange_rate DECIMAL(14,4) NOT NULL DEFAULT 4100,
  tendered_amount DECIMAL(14,2) NOT NULL,
  applied_amount DECIMAL(14,2) NOT NULL,
  base_amount DECIMAL(14,2) NOT NULL,
  change_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  reference_no VARCHAR(150) NULL,
  status ENUM('completed','voided','refunded') NOT NULL DEFAULT 'completed',
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NOT NULL,
  voided_by BIGINT UNSIGNED NULL,
  voided_at DATETIME NULL,
  void_reason VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_payments_branch_no (branch_id, payment_no),
  UNIQUE KEY uk_payments_order_request (order_id, request_key),
  KEY idx_payments_order_status (order_id, status),
  KEY idx_payments_branch_date (branch_id, paid_at),
  CONSTRAINT fk_payments_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_session FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_void_user FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE refunds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NULL,
  refund_no VARCHAR(50) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('pending','approved','completed','rejected','cancelled') NOT NULL DEFAULT 'pending',
  created_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_refunds_branch_no (branch_id, refund_no),
  CONSTRAINT fk_refunds_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  CONSTRAINT fk_refunds_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_refunds_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SOURCE: 10_expenses.sql
-- ============================================================
CREATE TABLE expense_categories (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, code VARCHAR(50) NOT NULL, name VARCHAR(120) NOT NULL, name_kh VARCHAR(120), is_active TINYINT(1) NOT NULL DEFAULT 1,
 UNIQUE KEY uk_expense_categories_code(code)
) ENGINE=InnoDB;
CREATE TABLE expenses (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, branch_id BIGINT UNSIGNED NOT NULL, category_id BIGINT UNSIGNED NOT NULL,
 expense_no VARCHAR(50) NOT NULL, expense_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, title VARCHAR(180) NOT NULL, description TEXT,
 amount DECIMAL(14,2) NOT NULL, currency_code ENUM('USD','KHR') NOT NULL DEFAULT 'USD', exchange_rate DECIMAL(14,4) NOT NULL DEFAULT 4100,
 base_amount DECIMAL(14,2) NOT NULL, payment_method VARCHAR(50) NOT NULL,
 reference_no VARCHAR(150), attachment VARCHAR(500), status ENUM('draft','pending','approved','paid','rejected','cancelled') NOT NULL DEFAULT 'draft',
 created_by BIGINT UNSIGNED NOT NULL, approved_by BIGINT UNSIGNED, approved_at DATETIME,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uk_expenses_branch_no(branch_id,expense_no), KEY idx_expenses_branch_date_status(branch_id,expense_date,status),
 CONSTRAINT fk_expenses_branch FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
 CONSTRAINT fk_expenses_category FOREIGN KEY(category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT,
 CONSTRAINT fk_expenses_creator FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT fk_expenses_approver FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SOURCE: 11_settings.sql
-- ============================================================
CREATE TABLE settings (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, branch_id BIGINT UNSIGNED, setting_group VARCHAR(60) NOT NULL, setting_key VARCHAR(120) NOT NULL,
 setting_value LONGTEXT, value_type ENUM('string','number','boolean','json','image','color') NOT NULL DEFAULT 'string', is_public TINYINT(1) NOT NULL DEFAULT 0,
 description VARCHAR(500), updated_by BIGINT UNSIGNED, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uk_settings_scope(branch_id,setting_key), KEY idx_settings_group(setting_group),
 CONSTRAINT fk_settings_branch FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE,
 CONSTRAINT fk_settings_user FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE invoice_sequences (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, branch_id BIGINT UNSIGNED NOT NULL,
 document_type ENUM('order','payment','purchase','purchase_payment','expense','refund','adjustment','reservation','kitchen_ticket') NOT NULL,
 prefix VARCHAR(20) NOT NULL, separator_text VARCHAR(5) NOT NULL DEFAULT '-', number_length TINYINT UNSIGNED NOT NULL DEFAULT 6,
 next_number BIGINT UNSIGNED NOT NULL DEFAULT 1, reset_period ENUM('never','daily','monthly','yearly') NOT NULL DEFAULT 'never',
 last_reset_date DATE, is_active TINYINT(1) NOT NULL DEFAULT 1, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uk_sequences_branch_type(branch_id,document_type),
 CONSTRAINT fk_sequences_branch FOREIGN KEY(branch_id) REFERENCES branches(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE sku_sequences (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 resource_type VARCHAR(60) NOT NULL,
 prefix VARCHAR(20) NOT NULL DEFAULT 'MI',
 separator_text VARCHAR(5) NOT NULL DEFAULT '-',
 number_length TINYINT UNSIGNED NOT NULL DEFAULT 6,
 next_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uk_sku_sequences_resource(resource_type)
) ENGINE=InnoDB;
CREATE TABLE backups (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, backup_no VARCHAR(100) NOT NULL, backup_type ENUM('manual','scheduled','safety') NOT NULL DEFAULT 'manual',
 file_name VARCHAR(255), file_path VARCHAR(1000), file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
 status ENUM('pending','running','completed','failed','deleted') NOT NULL DEFAULT 'pending',
 verification_status ENUM('pending','verified','failed','skipped') NOT NULL DEFAULT 'pending', reason VARCHAR(500), manifest_json JSON,
 created_by BIGINT UNSIGNED, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME,
 UNIQUE KEY uk_backups_no(backup_no), CONSTRAINT fk_backups_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- ============================================================
-- SOURCE: 12_indexes.sql
-- ============================================================
CREATE INDEX idx_menu_items_name ON menu_items(name);
CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_orders_opened_by_date ON orders(opened_by,opened_at);
CREATE INDEX idx_order_items_order_status ON order_items(order_id,kitchen_status);
CREATE INDEX idx_purchase_payments_purchase_date ON purchase_payments(purchase_id,created_at);
CREATE INDEX idx_expenses_category_date ON expenses(category_id,expense_date);


-- ============================================================
-- SOURCE: 13_seed.sql
-- ============================================================
INSERT INTO branches(code,name,name_kh,phone,address,address_kh,is_head_office) VALUES('HO','Main Restaurant','ភោជនីយដ្ឋានមេ','012345678','Cambodia','ប្រទេសកម្ពុជា',1);
INSERT INTO roles(code,name,description,is_system) VALUES
('super_admin','Super Administrator','All branches',1),('admin','Administrator','Branch admin',1),('manager','Manager','Operations',1),
('cashier','Cashier','POS/payment',1),('waiter','Waiter','Table/order',1),('kitchen','Kitchen','Kitchen display',1),
('stock_manager','Stock Manager','Stock/purchase',1),('accountant','Accountant','Expense/report',1),('viewer','Viewer','Read only',1);
INSERT INTO permissions(code,module,action,name) VALUES
('dashboard.view','dashboard','view','View dashboard'),('branches.manage','branches','manage','Manage branches'),
('users.manage','users','manage','Manage users'),('roles.manage','roles','manage','Manage roles'),
('menu.view','menu','view','View menu'),('menu.manage','menu','manage','Manage menu'),
('tables.view','tables','view','View tables'),('tables.manage','tables','manage','Manage tables'),
('orders.view','orders','view','View orders'),('orders.create','orders','create','Create orders'),
('orders.update','orders','update','Update orders'),('orders.cancel','orders','cancel','Cancel orders'),
('kitchen.view','kitchen','view','View kitchen'),('kitchen.update','kitchen','update','Update kitchen'),
('payments.create','payments','create','Receive payments'),('payments.void','payments','void','Void payments'),
('inventory.view','inventory','view','View inventory'),('inventory.adjust','inventory','adjust','Adjust inventory'),
('purchases.manage','purchases','manage','Manage purchases'),('customers.manage','customers','manage','Manage customers'),
('reservations.manage','reservations','manage','Manage reservations'),('expenses.manage','expenses','manage','Manage expenses'),
('reports.view','reports','view','View reports'),('settings.manage','settings','manage','Manage settings');
INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='super_admin';
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='admin' AND p.code NOT IN ('branches.manage');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='manager' AND p.code IN ('dashboard.view','menu.view','tables.view','tables.manage','orders.view','orders.create','orders.update','orders.cancel','kitchen.view','kitchen.update','payments.create','payments.void','inventory.view','purchases.manage','customers.manage','reservations.manage','expenses.manage','reports.view');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='cashier' AND p.code IN ('dashboard.view','menu.view','tables.view','orders.view','orders.create','orders.update','payments.create','customers.manage');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='waiter' AND p.code IN ('menu.view','tables.view','orders.view','orders.create','orders.update','customers.manage','reservations.manage');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='kitchen' AND p.code IN ('kitchen.view','kitchen.update','orders.view');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='stock_manager' AND p.code IN ('dashboard.view','menu.view','inventory.view','inventory.adjust','purchases.manage','reports.view');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='accountant' AND p.code IN ('dashboard.view','orders.view','inventory.view','expenses.manage','reports.view');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='viewer' AND p.action='view';
-- Password: Admin@123 - must be changed after first login.
INSERT INTO users(branch_id,role_id,employee_code,username,password_hash,full_name,preferred_language)
SELECT NULL,id,'EMP-0001','admin','$2b$12$xLYjPqreGCkWBeX.PeERBO/UmrjwzBjt9QCTH7jk8XGH6FTSuwBVy','System Administrator','km' FROM roles WHERE code='super_admin';
INSERT INTO dining_areas(branch_id,code,name,name_kh) SELECT id,'MAIN','Main Hall','សាលធំ' FROM branches WHERE code='HO';
INSERT INTO table_shapes(branch_id,code,name,name_kh,shape_type,sort_order)
SELECT b.id,s.code,s.name,s.name_kh,s.shape_type,s.sort_order FROM branches b CROSS JOIN (
SELECT 'square' code,'Square' name,'ការ៉េ' name_kh,'square' shape_type,1 sort_order UNION ALL
SELECT 'rectangle','Rectangle','ចតុកោណ','rectangle',2 UNION ALL
SELECT 'round','Round','មូល','round',3 UNION ALL
SELECT 'oval','Oval','ពងក្រពើ','oval',4) s;
INSERT INTO restaurant_tables(branch_id,dining_area_id,code,name,capacity)
SELECT b.id,a.id,CONCAT('T',n.n),CONCAT('Table ',n.n),4 FROM branches b JOIN dining_areas a ON a.branch_id=b.id
JOIN(SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8)n
WHERE b.code='HO' AND a.code='MAIN';
INSERT INTO kitchen_stations(branch_id,code,name,name_kh) SELECT id,'KITCHEN','Main Kitchen','ផ្ទះបាយ' FROM branches WHERE code='HO'
UNION ALL SELECT id,'DRINK','Drink Station','កន្លែងភេសជ្ជៈ' FROM branches WHERE code='HO';
INSERT INTO units(code,name,name_kh,decimal_places) VALUES('KG','Kilogram','គីឡូក្រាម',3),('G','Gram','ក្រាម',2),('L','Liter','លីត្រ',3),('ML','Milliliter','មីលីលីត្រ',0),('PCS','Piece','ដុំ',0),('BOTTLE','Bottle','ដប',0);
INSERT INTO menu_categories(code,name,name_kh,sort_order) VALUES('FOOD','Food','ម្ហូប',1),('DRINK','Beverages','ភេសជ្ជៈ',2);
INSERT INTO cash_registers(branch_id,code,name) SELECT id,'POS-01','Main Cashier' FROM branches WHERE code='HO';
INSERT INTO payment_methods(branch_id,code,name,name_kh,method_type,requires_reference,is_default,sort_order)
SELECT b.id,x.code,x.name,x.name_kh,x.method_type,x.requires_reference,x.is_default,x.sort_order
FROM branches b CROSS JOIN (
SELECT 'cash' code,'Cash' name,'សាច់ប្រាក់' name_kh,'cash' method_type,0 requires_reference,1 is_default,1 sort_order UNION ALL
SELECT 'aba_khqr','ABA KHQR','ABA KHQR','qr',1,0,2 UNION ALL SELECT 'acleda','ACLEDA','អេស៊ីលីដា','qr',1,0,3 UNION ALL
SELECT 'wing','Wing','វីង','qr',1,0,4 UNION ALL SELECT 'card','Card','កាត','card',1,0,5 UNION ALL
SELECT 'bank_transfer','Bank Transfer','ផ្ទេរធនាគារ','bank',1,0,6 UNION ALL SELECT 'credit','Credit','ជំពាក់','credit',0,0,7 UNION ALL
SELECT 'other','Other','ផ្សេងៗ','other',0,0,8) x;
INSERT INTO expense_categories(code,name,name_kh) VALUES('UTILITIES','Utilities','ទឹក ភ្លើង'),('RENT','Rent','ថ្លៃជួល'),('SALARY','Salary','ប្រាក់ខែ'),('TRANSPORT','Transport','ដឹកជញ្ជូន'),('OTHER','Other','ផ្សេងៗ');
INSERT INTO invoice_sequences(branch_id,document_type,prefix,next_number)
SELECT b.id,t.document_type,t.prefix,1 FROM branches b JOIN(SELECT 'order' document_type,'ORD' prefix UNION ALL SELECT 'payment','PAY' UNION ALL SELECT 'purchase','PUR' UNION ALL SELECT 'purchase_payment','PPY' UNION ALL SELECT 'expense','EXP' UNION ALL SELECT 'refund','REF' UNION ALL SELECT 'adjustment','ADJ' UNION ALL SELECT 'reservation','RSV' UNION ALL SELECT 'kitchen_ticket','KIT')t WHERE b.code='HO';
INSERT INTO sku_sequences(resource_type,prefix,separator_text,number_length,next_number)
VALUES('menu_item','MI','-',6,1),('ingredient','ING','-',6,1);
INSERT INTO settings(branch_id,setting_group,setting_key,setting_value,value_type,is_public) VALUES
(NULL,'business','business_name','Main Restaurant','string',1),
(NULL,'business','business_name_kh','ភោជនីយដ្ឋានមេ','string',1),
(NULL,'business','business_phone','012345678','string',1),
(NULL,'business','business_email','','string',1),
(NULL,'business','business_address','Cambodia','string',1),
(NULL,'business','business_address_kh','ប្រទេសកម្ពុជា','string',1),
(NULL,'business','tax_number','','string',1),(NULL,'business','logo_url','','image',1),
(NULL,'currency','base_currency','USD','string',1),(NULL,'currency','secondary_currency','KHR','string',1),
(NULL,'currency','khr_exchange_rate','4100','number',1),(NULL,'currency','currency_rounding','100','number',1),
(NULL,'pos','service_charge_rate','0','number',1),(NULL,'pos','tax_rate','0','number',1),
(NULL,'pos','require_cash_shift','true','boolean',1),(NULL,'pos','allow_split_payment','true','boolean',1),(NULL,'pos','allow_price_override','false','boolean',0),
(NULL,'payment','enable_payment_cash','true','boolean',1),(NULL,'payment','enable_payment_aba_khqr','true','boolean',1),
(NULL,'payment','enable_payment_card','true','boolean',1),(NULL,'payment','enable_payment_bank_transfer','true','boolean',1),
(NULL,'payment','enable_payment_credit','true','boolean',1),(NULL,'payment','enable_payment_other','true','boolean',1),
(NULL,'receipt','receipt_width','80','number',1),(NULL,'receipt','receipt_header','','string',1),
(NULL,'receipt','receipt_footer','សូមអរគុណ • Thank you','string',1),(NULL,'receipt','receipt_show_tax_number','true','boolean',1),(NULL,'receipt','receipt_auto_print','false','boolean',0),
(NULL,'inventory','allow_negative_stock','false','boolean',0),(NULL,'inventory','low_stock_alert','true','boolean',0),
(NULL,'display','default_language','km','string',1),(NULL,'display','timezone','Asia/Phnom_Penh','string',1),
(NULL,'display','primary_color','#b91c1c','color',1),(NULL,'display','theme_mode','light','string',0),
(NULL,'security','maintenance_mode','false','boolean',0),(NULL,'security','session_timeout_minutes','480','number',0);
