-- Support tickets: signed-in people raise a ticket, follow the conversation, and the GrowQR team answers from the admin console.
-- Tickets belong to an account (user_id), so only logged-in, registered people can raise them and each person sees only their own.
-- Idempotent like every portal migration. All rows go when the account is deleted.

CREATE TABLE IF NOT EXISTS support_tickets (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_no VARCHAR(20) NULL,
  user_id INT NOT NULL,
  category VARCHAR(30) NOT NULL,
  subject VARCHAR(160) NOT NULL,
  related_ref VARCHAR(80) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  assigned_to INT NULL,
  rating TINYINT NULL,
  rating_comment VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  closed_at DATETIME NULL,
  CONSTRAINT uq_support_ticket_no UNIQUE (ticket_no),
  CONSTRAINT fk_support_ticket_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_support_ticket_staff FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_support_ticket_user ON support_tickets (user_id, updated_at);
CREATE INDEX ix_support_ticket_status ON support_tickets (status, priority, last_activity_at);

-- Every message. is_staff = written by the team; is_internal = a staff-only note the person never sees.
CREATE TABLE IF NOT EXISTS support_messages (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  author_id INT NULL,
  is_staff TINYINT NOT NULL DEFAULT 0,
  is_internal TINYINT NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  read_by_user TINYINT NOT NULL DEFAULT 0,
  read_by_staff TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_support_msg_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_support_msg_ticket ON support_messages (ticket_id, created_at);

-- The audit trail: who did what to a ticket and when.
CREATE TABLE IF NOT EXISTS support_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  actor VARCHAR(120) NOT NULL,
  kind VARCHAR(30) NOT NULL,
  detail VARCHAR(300) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_support_event_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_support_event_ticket ON support_events (ticket_id, created_at);
