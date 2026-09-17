-- Apply once to an EXISTING restaurant_management database when the built-in
-- cashier role is missing its default POS permissions. Safe to rerun.
-- Do not re-import 99_full_database.sql on a live database.
USE restaurant_management;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles AS r
JOIN permissions AS p
  ON p.code IN (
    'dashboard.view', 'menu.view', 'tables.view', 'orders.view',
    'orders.create', 'orders.update', 'payments.create', 'customers.manage'
  )
WHERE r.code = 'cashier';
