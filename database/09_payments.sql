USE restaurant_management;

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
