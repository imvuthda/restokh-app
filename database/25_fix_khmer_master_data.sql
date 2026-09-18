USE restaurant_management;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Repair Khmer labels that were imported through a latin1 connection and now
-- display as "áž...". Hex literals keep this migration safe even when the SQL
-- client running the migration has the wrong local character encoding.

-- Table shapes (all branches)
UPDATE table_shapes SET name_kh=CONVERT(0xe19e80e19eb6e19e9ae19f89e19f81 USING utf8mb4)
WHERE LOWER(code)='square';
UPDATE table_shapes SET name_kh=CONVERT(0xe19e85e19e8fe19ebbe19e80e19f84e19e8e USING utf8mb4)
WHERE LOWER(code)='rectangle';
UPDATE table_shapes SET name_kh=CONVERT(0xe19e98e19ebce19e9b USING utf8mb4)
WHERE LOWER(code)='round';
UPDATE table_shapes SET name_kh=CONVERT(0xe19e96e19e84e19e80e19f92e19e9ae19e96e19ebe USING utf8mb4)
WHERE LOWER(code)='oval';

-- Standard payment methods (all branches). Custom methods are intentionally
-- left untouched because their correct Khmer label cannot be inferred safely.
UPDATE payment_methods SET name_kh=CONVERT(0xe19e9fe19eb6e19e85e19f8be19e94e19f92e19e9ae19eb6e19e80e19f8b USING utf8mb4)
WHERE LOWER(code)='cash';
UPDATE payment_methods SET name_kh='ABA KHQR' WHERE LOWER(code)='aba_khqr';
UPDATE payment_methods SET name_kh=CONVERT(0xe19eA2e19f81e19e9fe19f8ae19eb8e19e9be19eb8e19e8ae19eb6 USING utf8mb4)
WHERE LOWER(code)='acleda';
UPDATE payment_methods SET name_kh=CONVERT(0xe19e9ce19eb8e19e84 USING utf8mb4)
WHERE LOWER(code)='wing';
UPDATE payment_methods SET name_kh=CONVERT(0xe19e80e19eb6e19e8f USING utf8mb4)
WHERE LOWER(code)='card';
UPDATE payment_methods SET name_kh=CONVERT(0xe19e95e19f92e19e91e19f81e19e9ae19e92e19e93e19eb6e19e82e19eb6e19e9a USING utf8mb4)
WHERE LOWER(code)='bank_transfer';
UPDATE payment_methods SET name_kh=CONVERT(0xe19e87e19f86e19e96e19eb6e19e80e19f8b USING utf8mb4)
WHERE LOWER(code)='credit';
UPDATE payment_methods SET name_kh=CONVERT(0xe19e95e19f92e19e9fe19f81e19e84e19f97 USING utf8mb4)
WHERE LOWER(code)='other';

-- Ensure affected master tables remain fully Unicode for future edits.
ALTER TABLE table_shapes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE payment_methods CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
