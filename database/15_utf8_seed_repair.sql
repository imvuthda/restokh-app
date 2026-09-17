USE restaurant_management;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Run once only if the old seeded Khmer labels display as mojibake (áž...).
-- These updates target seed codes only and do not touch custom restaurant data.
UPDATE branches SET name_kh='ភោជនីយដ្ឋានមេ' WHERE code='HO';
UPDATE dining_areas SET name_kh='សាលធំ' WHERE code='MAIN';
UPDATE menu_categories SET name_kh='ម្ហូប' WHERE code='FOOD';
UPDATE menu_categories SET name_kh='ភេសជ្ជៈ' WHERE code='DRINK';
UPDATE kitchen_stations SET name_kh='ផ្ទះបាយ' WHERE code='KITCHEN';
UPDATE kitchen_stations SET name_kh='កន្លែងភេសជ្ជៈ' WHERE code='DRINK';
UPDATE settings SET setting_value='ភោជនីយដ្ឋានមេ' WHERE branch_id IS NULL AND setting_key='business_name_kh';
UPDATE settings SET setting_value='សូមអរគុណ • Thank you' WHERE branch_id IS NULL AND setting_key='receipt_footer';
UPDATE branches SET address_kh=CONVERT(0xe19e94e19f92e19e9ae19e91e19f81e19e9fe19e80e19e98e19f92e19e96e19ebbe19e87e19eb6 USING utf8mb4) WHERE code='HO';
UPDATE settings SET setting_value=CONVERT(0xe19e94e19f92e19e9ae19e91e19f81e19e9fe19e80e19e98e19f92e19e96e19ebbe19e87e19eb6 USING utf8mb4) WHERE branch_id IS NULL AND setting_key='business_address_kh';
