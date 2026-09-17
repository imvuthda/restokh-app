SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Repair existing installations where Khmer unit names were imported with a
-- wrong client encoding. Codes are stable, so this update is safe to rerun.
UPDATE units SET name_kh='គីឡូក្រាម' WHERE code='KG';
UPDATE units SET name_kh='ក្រាម' WHERE code='G';
UPDATE units SET name_kh='លីត្រ' WHERE code='L';
UPDATE units SET name_kh='មីលីលីត្រ' WHERE code='ML';
UPDATE units SET name_kh='ដុំ' WHERE code='PCS';
UPDATE units SET name_kh='ដប' WHERE code='BOTTLE';
