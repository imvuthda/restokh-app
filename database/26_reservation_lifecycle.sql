USE restaurant_management;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Run once on an existing installation. These fields preserve who performed
-- each reservation lifecycle action and when it happened.
ALTER TABLE reservations
  ADD COLUMN checked_in_at DATETIME NULL AFTER notes,
  ADD COLUMN checked_in_by BIGINT UNSIGNED NULL AFTER checked_in_at,
  ADD COLUMN completed_at DATETIME NULL AFTER checked_in_by,
  ADD COLUMN completed_by BIGINT UNSIGNED NULL AFTER completed_at,
  ADD COLUMN cancelled_at DATETIME NULL AFTER completed_by,
  ADD COLUMN cancelled_by BIGINT UNSIGNED NULL AFTER cancelled_at,
  ADD KEY idx_reservations_table_status (table_id,status,reservation_at),
  ADD CONSTRAINT fk_reservations_checked_in_by FOREIGN KEY (checked_in_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_reservations_completed_by FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_reservations_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;

-- Reconcile reservations linked to orders that were already paid before this
-- migration was installed.
UPDATE reservations r
JOIN orders o ON o.reservation_id=r.id AND o.status='paid'
SET r.status='completed',
    r.checked_in_at=COALESCE(r.checked_in_at,o.opened_at),
    r.checked_in_by=COALESCE(r.checked_in_by,o.opened_by),
    r.completed_at=COALESCE(r.completed_at,o.closed_at),
    r.completed_by=COALESCE(r.completed_by,o.closed_by)
WHERE r.status='seated';
