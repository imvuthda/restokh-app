USE restaurant_management;

CREATE TABLE IF NOT EXISTS payment_methods (
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

INSERT IGNORE INTO payment_methods
(branch_id,code,name,name_kh,method_type,requires_reference,is_default,sort_order)
SELECT b.id,x.code,x.name,x.name_kh,x.method_type,x.requires_reference,x.is_default,x.sort_order
FROM branches b CROSS JOIN (
  SELECT 'cash' code,'Cash' name,'សាច់ប្រាក់' name_kh,'cash' method_type,0 requires_reference,1 is_default,1 sort_order
  UNION ALL SELECT 'aba_khqr','ABA KHQR','ABA KHQR','qr',1,0,2
  UNION ALL SELECT 'acleda','ACLEDA','អេស៊ីលីដា','qr',1,0,3
  UNION ALL SELECT 'wing','Wing','វីង','qr',1,0,4
  UNION ALL SELECT 'card','Card','កាត','card',1,0,5
  UNION ALL SELECT 'bank_transfer','Bank Transfer','ផ្ទេរធនាគារ','bank',1,0,6
  UNION ALL SELECT 'credit','Credit','ជំពាក់','credit',0,0,7
  UNION ALL SELECT 'other','Other','ផ្សេងៗ','other',0,0,8
) x;

ALTER TABLE payments MODIFY payment_method VARCHAR(50) NOT NULL;
ALTER TABLE refunds MODIFY method VARCHAR(50) NOT NULL;
ALTER TABLE expenses MODIFY payment_method VARCHAR(50) NOT NULL;
ALTER TABLE purchase_payments MODIFY payment_method VARCHAR(50) NOT NULL;

