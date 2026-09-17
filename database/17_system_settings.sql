USE restaurant_management;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Run once on an existing installation. Existing values are preserved.
INSERT INTO settings(branch_id,setting_group,setting_key,setting_value,value_type,is_public)
SELECT NULL,d.setting_group,d.setting_key,d.setting_value,d.value_type,d.is_public
FROM (
 SELECT 'business' setting_group,'business_phone' setting_key,'' setting_value,'string' value_type,1 is_public UNION ALL
 SELECT 'business','business_email','','string',1 UNION ALL SELECT 'business','business_address','','string',1 UNION ALL SELECT 'business','business_address_kh','','string',1 UNION ALL SELECT 'business','tax_number','','string',1 UNION ALL SELECT 'business','logo_url','','image',1 UNION ALL
 SELECT 'currency','secondary_currency','KHR','string',1 UNION ALL SELECT 'currency','currency_rounding','100','number',1 UNION ALL
 SELECT 'pos','require_cash_shift','true','boolean',1 UNION ALL SELECT 'pos','allow_split_payment','true','boolean',1 UNION ALL SELECT 'pos','allow_price_override','false','boolean',0 UNION ALL
 SELECT 'receipt','receipt_width','80','number',1 UNION ALL SELECT 'receipt','receipt_header','','string',1 UNION ALL SELECT 'receipt','receipt_show_tax_number','true','boolean',1 UNION ALL SELECT 'receipt','receipt_auto_print','false','boolean',0 UNION ALL
 SELECT 'inventory','low_stock_alert','true','boolean',0 UNION ALL
 SELECT 'display','default_language','km','string',1 UNION ALL SELECT 'display','timezone','Asia/Phnom_Penh','string',1 UNION ALL SELECT 'display','primary_color','#b91c1c','color',1 UNION ALL SELECT 'display','theme_mode','light','string',0 UNION ALL
 SELECT 'security','maintenance_mode','false','boolean',0 UNION ALL SELECT 'security','session_timeout_minutes','480','number',0
) d
WHERE NOT EXISTS (
  SELECT 1 FROM settings s WHERE s.branch_id IS NULL AND s.setting_key=d.setting_key
);
