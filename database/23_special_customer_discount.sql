USE restaurant_management;

-- Run once on an existing database. New installations already include these columns.
ALTER TABLE customers
  ADD COLUMN customer_type ENUM('regular','vip','staff','partner') NOT NULL DEFAULT 'regular' AFTER address,
  ADD COLUMN default_discount_percent DECIMAL(7,4) NOT NULL DEFAULT 0 AFTER customer_type;

ALTER TABLE customers
  ADD CONSTRAINT chk_customers_default_discount
  CHECK (default_discount_percent >= 0 AND default_discount_percent <= 100);

