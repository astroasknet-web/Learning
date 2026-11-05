-- MySQL / MariaDB version of the portal schema step 20261013000001_external_internships.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- Internships collected from public job feeds (Adzuna, India). Kept apart from `internships` on purpose: these are NOT posted
-- by employers on GrowQR, carry no verified stipend and cannot be applied to here, so they only ever link out to the original advert.
-- Idempotent, like every portal migration.
CREATE TABLE IF NOT EXISTS external_internships (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    source varchar(20) NOT NULL,                -- 'adzuna'
    source_id varchar(80) NOT NULL,             -- the provider's own id; (source, source_id) is the dedupe key
    title varchar(200) NOT NULL,
    company varchar(160) NOT NULL,
    location varchar(160) NULL,
    summary LONGTEXT NOT NULL,                      -- the provider's short snippet, plain text
    stipend_text varchar(80) NULL,              -- as advertised, never verified by us
    apply_url varchar(600) NOT NULL,            -- always http(s); the page links here and nowhere else
    posted_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,              -- hidden after this; the daily sweep deletes rows a week past it
    fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_external_internships_source UNIQUE (source, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_external_internships_live ON external_internships (expires_at, posted_at DESC);
