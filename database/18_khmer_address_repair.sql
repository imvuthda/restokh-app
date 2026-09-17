USE restaurant_management;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Safe to run on an existing installation. HEX keeps Khmer bytes intact in HeidiSQL.
SET @cambodia_kh = CONVERT(0xe19e94e19f92e19e9ae19e91e19f81e19e9fe19e80e19e98e19f92e19e96e19ebbe19e87e19eb6 USING utf8mb4);
UPDATE branches SET address_kh=@cambodia_kh WHERE code='HO';
UPDATE settings SET setting_value=@cambodia_kh
WHERE branch_id IS NULL AND setting_key='business_address_kh';
