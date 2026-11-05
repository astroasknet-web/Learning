-- MySQL / MariaDB version of the portal schema step 20261010000001_test_attempts.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- Practice-test attempts (IELTS Reading / Listening, GRE Quant). Only logged-in students keep attempts; guests can take tests and see results but nothing is stored.
-- Idempotent, like every portal migration.
CREATE TABLE IF NOT EXISTS test_attempts (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    exam varchar(30) NOT NULL,          -- ielts-reading | ielts-listening | gre-quant
    test_no smallint NOT NULL,
    raw smallint NOT NULL,
    total smallint NOT NULL,
    band DECIMAL(3,1) NULL,             -- IELTS band (indicative); NULL for exams scored another way
    score smallint NULL,                -- GRE scaled score (130-170); NULL otherwise
    answers_json LONGTEXT NOT NULL,
    seconds INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_attempt_user ON test_attempts (user_id, exam, created_at DESC);
