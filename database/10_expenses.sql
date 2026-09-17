USE restaurant_management;
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
