USE restaurant_management;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO settings(branch_id,setting_group,setting_key,setting_value,value_type,is_public)
SELECT NULL,'payment',d.setting_key,'true','boolean',1
FROM (
  SELECT 'enable_payment_cash' setting_key UNION ALL
  SELECT 'enable_payment_aba_khqr' UNION ALL
  SELECT 'enable_payment_card' UNION ALL
  SELECT 'enable_payment_bank_transfer' UNION ALL
  SELECT 'enable_payment_credit' UNION ALL
  SELECT 'enable_payment_other'
) d
WHERE NOT EXISTS (
  SELECT 1 FROM settings s
  WHERE s.branch_id IS NULL AND s.setting_key=d.setting_key
);
