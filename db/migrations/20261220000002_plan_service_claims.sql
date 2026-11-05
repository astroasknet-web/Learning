-- Included services a plan member has asked for (career counselling, expert resume review, ...). One row per request; the count a plan allows in a window
-- (lib/market/plan-services.ts) is checked against these rows. Each request also opens a support ticket so staff can act on it.
CREATE TABLE IF NOT EXISTS plan_service_claims (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service VARCHAR(40) NOT NULL,
  ticket_no VARCHAR(20) NULL,
  claimed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_psc_user (user_id, service, claimed_at),
  CONSTRAINT fk_psc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
