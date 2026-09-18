USE restaurant_management;

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

