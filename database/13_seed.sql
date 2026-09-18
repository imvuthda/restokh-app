USE restaurant_management;
INSERT INTO branches(code,name,name_kh,phone,address,address_kh,is_head_office) VALUES('HO','Main Restaurant','ភោជនីយដ្ឋានមេ','012345678','Cambodia','ប្រទេសកម្ពុជា',1);
INSERT INTO roles(code,name,description,is_system) VALUES
('super_admin','Super Administrator','All branches',1),('admin','Administrator','Branch admin',1),('manager','Manager','Operations',1),
('cashier','Cashier','POS/payment',1),('waiter','Waiter','Table/order',1),('kitchen','Kitchen','Kitchen display',1),
('stock_manager','Stock Manager','Stock/purchase',1),('accountant','Accountant','Expense/report',1),('viewer','Viewer','Read only',1);
INSERT INTO permissions(code,module,action,name) VALUES
('dashboard.view','dashboard','view','View dashboard'),('branches.manage','branches','manage','Manage branches'),
('users.manage','users','manage','Manage users'),('roles.manage','roles','manage','Manage roles'),
('menu.view','menu','view','View menu'),('menu.manage','menu','manage','Manage menu'),
('tables.view','tables','view','View tables'),('tables.manage','tables','manage','Manage tables'),
('orders.view','orders','view','View orders'),('orders.create','orders','create','Create orders'),
('orders.update','orders','update','Update orders'),('orders.cancel','orders','cancel','Cancel orders'),
('kitchen.view','kitchen','view','View kitchen'),('kitchen.update','kitchen','update','Update kitchen'),
('payments.create','payments','create','Receive payments'),('payments.void','payments','void','Void payments'),
('inventory.view','inventory','view','View inventory'),('inventory.adjust','inventory','adjust','Adjust inventory'),
('purchases.manage','purchases','manage','Manage purchases'),('customers.manage','customers','manage','Manage customers'),
('reservations.manage','reservations','manage','Manage reservations'),('expenses.manage','expenses','manage','Manage expenses'),
('reports.view','reports','view','View reports'),('settings.manage','settings','manage','Manage settings');
INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='super_admin';
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='admin' AND p.code NOT IN ('branches.manage');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='manager' AND p.code IN ('dashboard.view','menu.view','tables.view','tables.manage','orders.view','orders.create','orders.update','orders.cancel','kitchen.view','kitchen.update','payments.create','payments.void','inventory.view','purchases.manage','customers.manage','reservations.manage','expenses.manage','reports.view');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='cashier' AND p.code IN ('dashboard.view','menu.view','tables.view','orders.view','orders.create','orders.update','payments.create','customers.manage');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='waiter' AND p.code IN ('menu.view','tables.view','orders.view','orders.create','orders.update','customers.manage','reservations.manage');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='kitchen' AND p.code IN ('kitchen.view','kitchen.update','orders.view');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='stock_manager' AND p.code IN ('dashboard.view','menu.view','inventory.view','inventory.adjust','purchases.manage','reports.view');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='accountant' AND p.code IN ('dashboard.view','orders.view','inventory.view','expenses.manage','reports.view');
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p
WHERE r.code='viewer' AND p.action='view';
-- Password: Admin@123 - must be changed after first login.
INSERT INTO users(branch_id,role_id,employee_code,username,password_hash,full_name,preferred_language)
SELECT NULL,id,'EMP-0001','admin','$2b$12$xLYjPqreGCkWBeX.PeERBO/UmrjwzBjt9QCTH7jk8XGH6FTSuwBVy','System Administrator','km' FROM roles WHERE code='super_admin';
INSERT INTO dining_areas(branch_id,code,name,name_kh) SELECT id,'MAIN','Main Hall','សាលធំ' FROM branches WHERE code='HO';
INSERT INTO restaurant_tables(branch_id,dining_area_id,code,name,capacity)
SELECT b.id,a.id,CONCAT('T',n.n),CONCAT('Table ',n.n),4 FROM branches b JOIN dining_areas a ON a.branch_id=b.id
JOIN(SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8)n
WHERE b.code='HO' AND a.code='MAIN';
INSERT INTO kitchen_stations(branch_id,code,name,name_kh) SELECT id,'KITCHEN','Main Kitchen','ផ្ទះបាយ' FROM branches WHERE code='HO'
UNION ALL SELECT id,'DRINK','Drink Station','កន្លែងភេសជ្ជៈ' FROM branches WHERE code='HO';
INSERT INTO units(code,name,name_kh,decimal_places) VALUES('KG','Kilogram','គីឡូក្រាម',3),('G','Gram','ក្រាម',2),('L','Liter','លីត្រ',3),('ML','Milliliter','មីលីលីត្រ',0),('PCS','Piece','ដុំ',0),('BOTTLE','Bottle','ដប',0);
INSERT INTO menu_categories(code,name,name_kh,sort_order) VALUES('FOOD','Food','ម្ហូប',1),('DRINK','Beverages','ភេសជ្ជៈ',2);
INSERT INTO cash_registers(branch_id,code,name) SELECT id,'POS-01','Main Cashier' FROM branches WHERE code='HO';
INSERT INTO payment_methods(branch_id,code,name,name_kh,method_type,requires_reference,is_default,sort_order)
SELECT b.id,x.code,x.name,x.name_kh,x.method_type,x.requires_reference,x.is_default,x.sort_order
FROM branches b CROSS JOIN (
SELECT 'cash' code,'Cash' name,'សាច់ប្រាក់' name_kh,'cash' method_type,0 requires_reference,1 is_default,1 sort_order UNION ALL
SELECT 'aba_khqr','ABA KHQR','ABA KHQR','qr',1,0,2 UNION ALL SELECT 'acleda','ACLEDA','អេស៊ីលីដា','qr',1,0,3 UNION ALL
SELECT 'wing','Wing','វីង','qr',1,0,4 UNION ALL SELECT 'card','Card','កាត','card',1,0,5 UNION ALL
SELECT 'bank_transfer','Bank Transfer','ផ្ទេរធនាគារ','bank',1,0,6 UNION ALL SELECT 'credit','Credit','ជំពាក់','credit',0,0,7 UNION ALL
SELECT 'other','Other','ផ្សេងៗ','other',0,0,8) x;
INSERT INTO expense_categories(code,name,name_kh) VALUES('UTILITIES','Utilities','ទឹក ភ្លើង'),('RENT','Rent','ថ្លៃជួល'),('SALARY','Salary','ប្រាក់ខែ'),('TRANSPORT','Transport','ដឹកជញ្ជូន'),('OTHER','Other','ផ្សេងៗ');
INSERT INTO invoice_sequences(branch_id,document_type,prefix,next_number)
SELECT b.id,t.document_type,t.prefix,1 FROM branches b JOIN(SELECT 'order' document_type,'ORD' prefix UNION ALL SELECT 'payment','PAY' UNION ALL SELECT 'purchase','PUR' UNION ALL SELECT 'purchase_payment','PPY' UNION ALL SELECT 'expense','EXP' UNION ALL SELECT 'refund','REF' UNION ALL SELECT 'adjustment','ADJ' UNION ALL SELECT 'reservation','RSV' UNION ALL SELECT 'kitchen_ticket','KIT')t WHERE b.code='HO';

INSERT INTO sku_sequences(resource_type,prefix,separator_text,number_length,next_number)
VALUES('menu_item','MI','-',6,1),('ingredient','ING','-',6,1);
INSERT INTO settings(branch_id,setting_group,setting_key,setting_value,value_type,is_public) VALUES
(NULL,'business','business_name','Main Restaurant','string',1),
(NULL,'business','business_name_kh','ភោជនីយដ្ឋានមេ','string',1),
(NULL,'business','business_phone','012345678','string',1),
(NULL,'business','business_email','','string',1),
(NULL,'business','business_address','Cambodia','string',1),
(NULL,'business','business_address_kh','ប្រទេសកម្ពុជា','string',1),
(NULL,'business','tax_number','','string',1),(NULL,'business','logo_url','','image',1),
(NULL,'currency','base_currency','USD','string',1),(NULL,'currency','secondary_currency','KHR','string',1),
(NULL,'currency','khr_exchange_rate','4100','number',1),(NULL,'currency','currency_rounding','100','number',1),
(NULL,'pos','service_charge_rate','0','number',1),(NULL,'pos','tax_rate','0','number',1),
(NULL,'pos','require_cash_shift','true','boolean',1),(NULL,'pos','allow_split_payment','true','boolean',1),(NULL,'pos','allow_price_override','false','boolean',0),
(NULL,'receipt','receipt_width','80','number',1),(NULL,'receipt','receipt_header','','string',1),
(NULL,'receipt','receipt_footer','សូមអរគុណ • Thank you','string',1),(NULL,'receipt','receipt_show_tax_number','true','boolean',1),(NULL,'receipt','receipt_auto_print','false','boolean',0),
(NULL,'inventory','allow_negative_stock','false','boolean',0),(NULL,'inventory','low_stock_alert','true','boolean',0),
(NULL,'display','default_language','km','string',1),(NULL,'display','timezone','Asia/Phnom_Penh','string',1),
(NULL,'display','primary_color','#b91c1c','color',1),(NULL,'display','theme_mode','light','string',0),
(NULL,'security','maintenance_mode','false','boolean',0),(NULL,'security','session_timeout_minutes','480','number',0);
