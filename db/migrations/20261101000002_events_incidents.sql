-- Events: how an event is attended, and the payment problems the expert-booking flow records for manual follow-up.
ALTER TABLE events ADD COLUMN event_mode VARCHAR(10) NOT NULL DEFAULT 'offline';
ALTER TABLE events ADD COLUMN meeting_platform VARCHAR(40) NULL;
ALTER TABLE events ADD COLUMN meeting_url VARCHAR(500) NULL;

CREATE TABLE IF NOT EXISTS payment_incidents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  kind VARCHAR(60) NOT NULL,
  expert_slug VARCHAR(190) NULL,
  user_email VARCHAR(254) NULL,
  user_name VARCHAR(255) NULL,
  start_time DATETIME(3) NULL,
  amount_inr INT NULL,
  razorpay_order_id VARCHAR(120) NULL,
  razorpay_payment_id VARCHAR(120) NULL,
  detail LONGTEXT NULL,
  resolved TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX payment_incidents_created_at_idx ON payment_incidents (created_at);
