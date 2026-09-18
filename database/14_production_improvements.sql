USE restaurant_management;

-- Run this once only when upgrading a database created before this file existed.
CREATE TABLE IF NOT EXISTS revoked_access_tokens (
  jti CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_revoked_tokens_expiry (expires_at),
  CONSTRAINT fk_revoked_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE payments
  ADD COLUMN request_key VARCHAR(100) NULL AFTER payment_no,
  ADD UNIQUE KEY uk_payments_order_request (order_id, request_key);
