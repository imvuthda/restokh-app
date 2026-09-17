USE restaurant_management;
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
