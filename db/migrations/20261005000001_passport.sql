-- MySQL / MariaDB version of the portal schema step 20261005000001_passport.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- QR-verifiable Skill Passport: a student can publish a signed, tamper-evident snapshot of their passport
-- (RQ score, skills, courses) at a public link / QR code. Private by default; the student chooses what is shown.
-- Credentials are W3C Verifiable Credentials (Open Badges 3.0 shape) signed with Ed25519 (EdDSA, vc+jwt).
-- Idempotent.

-- Public signing keys, kept for ever so old credentials stay verifiable after a key rotation.
CREATE TABLE IF NOT EXISTS passport_keys (
  kid         varchar(24)  PRIMARY KEY,
  public_key  varchar(64)  NOT NULL,            -- Ed25519 public key, base64url
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retired_at  DATETIME    NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS passports (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id       INT      NOT NULL UNIQUE,
  code          varchar(16)  NOT NULL UNIQUE,   -- unguessable public identifier used in the link and QR
  is_public     smallint     NOT NULL DEFAULT 0,
  display_name  varchar(80)  NOT NULL DEFAULT '',
  name_style    varchar(14)  NOT NULL DEFAULT 'first_initial',   -- full | first_initial | initials
  show_score    smallint     NOT NULL DEFAULT 1,
  show_skills   smallint     NOT NULL DEFAULT 1,
  show_courses  smallint     NOT NULL DEFAULT 1,
  show_college  smallint     NOT NULL DEFAULT 0,
  consented_at  DATETIME    NULL,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at  DATETIME    NULL
,
  CONSTRAINT fk_passports_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS passport_credentials (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  passport_id  INT      NOT NULL,
  jti          varchar(40)  NOT NULL UNIQUE,    -- credential id (uuid)
  kid          varchar(24)  NOT NULL,
  jwt          LONGTEXT         NOT NULL,           -- the signed credential (vc+jwt)
  issued_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME    NOT NULL,
  status       varchar(12)  NOT NULL DEFAULT 'active'    -- active | superseded | revoked
,
  CONSTRAINT fk_passport_credentials_passport_id FOREIGN KEY (passport_id) REFERENCES passports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX passport_credentials_pp_idx ON passport_credentials (passport_id, status);

CREATE TABLE IF NOT EXISTS passport_views (
  id           BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  passport_id  INT      NOT NULL,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visitor      char(20)     NOT NULL,           -- daily-rotating hash, same scheme as analytics
  via          varchar(6)   NOT NULL DEFAULT 'link',    -- qr | link
  referrer     varchar(120) NULL
,
  CONSTRAINT fk_passport_views_passport_id FOREIGN KEY (passport_id) REFERENCES passports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX passport_views_pp_idx ON passport_views (passport_id, created_at);
