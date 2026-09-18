USE restaurant_management;

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
