USE restaurant_management;
CREATE INDEX idx_menu_items_name ON menu_items(name);
CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_orders_opened_by_date ON orders(opened_by,opened_at);
CREATE INDEX idx_order_items_order_status ON order_items(order_id,kitchen_status);
CREATE INDEX idx_purchase_payments_purchase_date ON purchase_payments(purchase_id,created_at);
CREATE INDEX idx_expenses_category_date ON expenses(category_id,expense_date);

