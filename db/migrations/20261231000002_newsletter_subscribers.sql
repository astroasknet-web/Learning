-- Newsletter sign-ups from the standard footer. One row per address. Idempotent like every portal migration.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  source VARCHAR(60) NOT NULL DEFAULT 'footer',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_newsletter_subscribers_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
