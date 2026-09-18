USE restaurant_management;

CREATE TABLE IF NOT EXISTS sku_sequences (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 resource_type VARCHAR(60) NOT NULL,
 prefix VARCHAR(20) NOT NULL DEFAULT 'MI',
 separator_text VARCHAR(5) NOT NULL DEFAULT '-',
 number_length TINYINT UNSIGNED NOT NULL DEFAULT 6,
 next_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uk_sku_sequences_resource(resource_type)
) ENGINE=InnoDB;

INSERT INTO sku_sequences(resource_type,prefix,separator_text,number_length,next_number)
VALUES('menu_item','MI','-',6,1),('ingredient','ING','-',6,1)
ON DUPLICATE KEY UPDATE resource_type=VALUES(resource_type);

UPDATE sku_sequences
SET next_number=GREATEST(
  next_number,
  COALESCE((
    SELECT MAX(CAST(SUBSTRING(sku,4) AS UNSIGNED))+1
    FROM menu_items
    WHERE sku REGEXP '^MI-[0-9]+$'
  ),1)
)
WHERE resource_type='menu_item';

UPDATE sku_sequences
SET next_number=GREATEST(
  next_number,
  COALESCE((
    SELECT MAX(CAST(SUBSTRING(sku,5) AS UNSIGNED))+1
    FROM ingredients
    WHERE sku REGEXP '^ING-[0-9]+$'
  ),1)
)
WHERE resource_type='ingredient';
