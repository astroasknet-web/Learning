-- MySQL / MariaDB version of the portal schema step 20261008000001_portal_sessions.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- Portal accounts in the Next.js app: server-side sessions.
-- The browser holds only a random token (cookie); this table stores its SHA-256, so a database leak cannot be replayed as a login.
-- Idempotent. Row level security on with NO policies: reachable only through the server's database connection.

CREATE TABLE IF NOT EXISTS portal_sessions (
  id           char(64)    PRIMARY KEY,                       -- sha256(token), hex
  user_id      INT     NULL,   -- null until the person is fully logged in
  csrf         char(32)    NOT NULL,
  data         LONGTEXT       NOT NULL ,      -- pending two-step login, setup secret, one-time notices
  ip_hash      char(16)    NOT NULL DEFAULT '',
  created_at   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME   NOT NULL
,
  CONSTRAINT fk_portal_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX portal_sessions_user_idx ON portal_sessions (user_id);

CREATE INDEX portal_sessions_expires_idx ON portal_sessions (expires_at);
