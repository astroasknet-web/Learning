-- MySQL / MariaDB version of the portal schema step 20261003000002_institution_submissions.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- Students can add a college that is missing from the directory. It stays 'pending' (visible only to admins and to
-- the student who typed it) until 3 different people submit it or an admin approves it. Idempotent.

ALTER TABLE institutions ADD COLUMN status       varchar(10) NOT NULL DEFAULT 'approved';  -- approved | pending | rejected
ALTER TABLE institutions ADD COLUMN submit_count INT     NOT NULL DEFAULT 0;

ALTER TABLE institutions ADD COLUMN reviewed_by  INT     NULL;

ALTER TABLE institutions ADD COLUMN reviewed_at  DATETIME    NULL;

CREATE INDEX institutions_status_idx ON institutions (status);

-- One row per (college, submitter). submitter = 'u<user id>' for a signed-in user, 'i<hash of IP>' for someone still signing up.
CREATE TABLE IF NOT EXISTS institution_submissions (
  id             BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  institution_id bigint       NOT NULL,
  submitter      varchar(80)  NOT NULL,
  typed_name     varchar(255) NOT NULL,
  created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT institution_submissions_uq UNIQUE (institution_id, submitter)
,
  CONSTRAINT fk_institution_submissions_institution_id FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX institution_submissions_who_idx ON institution_submissions (submitter, created_at);
