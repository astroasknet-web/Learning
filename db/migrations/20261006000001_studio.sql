-- MySQL / MariaDB version of the portal schema step 20261006000001_studio.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- Resume Studio: structured resumes built from templates, saved versions (for before/after), the Pro plan and its payments.
-- Idempotent.

CREATE TABLE IF NOT EXISTS studio_resumes (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     INT      NOT NULL,
  title       varchar(120) NOT NULL DEFAULT 'My resume',
  template    varchar(40)  NOT NULL DEFAULT 'chrono-classic',
  data_json   LONGTEXT         NOT NULL,                 -- the working draft (structured resume)
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_studio_resumes_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX studio_resumes_user_idx ON studio_resumes (user_id);

-- Every saved update. kind 'import' = the starting point (not counted against the free 24-hour limit), 'save' = a user update.
CREATE TABLE IF NOT EXISTS studio_versions (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  resume_id     INT      NOT NULL,
  user_id       INT      NOT NULL,
  kind          varchar(8)   NOT NULL DEFAULT 'save',
  template      varchar(40)  NOT NULL,
  data_json     LONGTEXT         NOT NULL,
  text_body     LONGTEXT         NOT NULL,               -- the plain text that was scored and is exported
  score         DECIMAL(5,2) NULL,
  grade         varchar(30)  NULL,
  sections_json LONGTEXT         NULL,                   -- [{name, pct}] for the before/after comparison
  words         INT      NOT NULL DEFAULT 0,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_studio_versions_resume_id FOREIGN KEY (resume_id) REFERENCES studio_resumes(id) ON DELETE CASCADE,
  CONSTRAINT fk_studio_versions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX studio_versions_user_idx   ON studio_versions (user_id, kind, created_at);

CREATE INDEX studio_versions_resume_idx ON studio_versions (resume_id, created_at);

-- Pro access periods. Active when starts_at <= now < ends_at.
CREATE TABLE IF NOT EXISTS studio_subscriptions (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id       INT      NOT NULL,
  starts_at     DATETIME    NOT NULL,
  ends_at       DATETIME    NOT NULL,
  source        varchar(12)  NOT NULL,               -- razorpay | admin
  payment_id    varchar(64)  NULL,
  amount_paise  INT      NOT NULL DEFAULT 0,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_studio_subscriptions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX studio_subscriptions_user_idx ON studio_subscriptions (user_id, ends_at);

-- One row per checkout attempt. The amount is decided by the server, never by the browser.
CREATE TABLE IF NOT EXISTS studio_payments (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id       INT      NOT NULL,
  order_id      varchar(64)  NOT NULL UNIQUE,
  payment_id    varchar(64)  NULL UNIQUE,            -- unique: a payment can only ever grant access once
  amount_paise  INT      NOT NULL,
  currency      char(3)      NOT NULL DEFAULT 'INR',
  status        varchar(10)  NOT NULL DEFAULT 'created',   -- created | paid | failed
  receipt       varchar(64)  NULL,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at       DATETIME    NULL
,
  CONSTRAINT fk_studio_payments_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX studio_payments_user_idx ON studio_payments (user_id, created_at);

CREATE TABLE IF NOT EXISTS studio_prefs (
  user_id     INT     PRIMARY KEY,
  prefs_json  LONGTEXT        NOT NULL,
  updated_at  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_studio_prefs_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
