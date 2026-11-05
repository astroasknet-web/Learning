-- MySQL / MariaDB version of the portal schema step 20261023000001_oauth_identities.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- Sign in with Google and LinkedIn. One row links a provider account (its stable "sub" id) to a portal user.
-- A user may have several providers; a provider account belongs to one user. Idempotent, like every portal migration.
CREATE TABLE IF NOT EXISTS oauth_identities (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    provider varchar(20) NOT NULL,              -- 'google' | 'linkedin'
    subject varchar(190) NOT NULL,              -- the provider's own id for the person
    email varchar(190) NOT NULL,                -- the address the provider verified when this was linked
    name varchar(120) NOT NULL DEFAULT '',
    picture varchar(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL,
    CONSTRAINT uq_oauth_provider_subject UNIQUE (provider, subject)
,
  CONSTRAINT fk_oauth_identities_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_oauth_user ON oauth_identities (user_id);
