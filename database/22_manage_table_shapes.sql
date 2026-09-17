USE restaurant_management;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS table_shapes (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE restaurant_tables MODIFY shape VARCHAR(40) NOT NULL DEFAULT 'square';

INSERT INTO table_shapes(branch_id,code,name,name_kh,shape_type,sort_order)
SELECT b.id,s.code,s.name,s.name_kh,s.shape_type,s.sort_order
FROM branches b
CROSS JOIN (
  SELECT 'square' code,'Square' name,'ការ៉េ' name_kh,'square' shape_type,1 sort_order UNION ALL
  SELECT 'rectangle','Rectangle','ចតុកោណ','rectangle',2 UNION ALL
  SELECT 'round','Round','មូល','round',3 UNION ALL
  SELECT 'oval','Oval','ពងក្រពើ','oval',4
) s
WHERE NOT EXISTS (
  SELECT 1 FROM table_shapes ts WHERE ts.branch_id=b.id AND ts.code=s.code
);
