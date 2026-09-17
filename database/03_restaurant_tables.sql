USE restaurant_management;

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
