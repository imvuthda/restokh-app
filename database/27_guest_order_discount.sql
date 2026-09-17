USE restaurant_management;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Run once on an existing installation. This records the reason and employee
-- responsible for every order-level guest discount without changing history.
ALTER TABLE orders
  ADD COLUMN discount_reason VARCHAR(255) NULL AFTER discount_amount,
  ADD COLUMN discount_applied_by BIGINT UNSIGNED NULL AFTER discount_reason,
  ADD COLUMN discount_applied_at DATETIME NULL AFTER discount_applied_by,
  ADD KEY idx_orders_discount_applied_by (discount_applied_by),
  ADD CONSTRAINT fk_orders_discount_applied_by
    FOREIGN KEY (discount_applied_by) REFERENCES users(id) ON DELETE SET NULL;

