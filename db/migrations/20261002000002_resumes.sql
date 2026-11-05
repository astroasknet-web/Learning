-- MySQL / MariaDB version of the portal schema step 20261002000002_resumes.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- Resume uploads: every resume a student uploads is kept (history), with the extracted text, the "is this a resume?"
-- verdict and the RQ score. The original file lives in Supabase Storage (bucket "resumes", private); only its path is stored here.
-- Refused uploads (invoices, random PDFs, ...) are logged WITHOUT their text, for abuse monitoring only.

CREATE TABLE IF NOT EXISTS resumes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    original_name varchar(160) NOT NULL DEFAULT '',
    mime varchar(80) NOT NULL DEFAULT '',
    size INT NOT NULL DEFAULT 0,
    storage_bucket varchar(40) NULL,
    storage_path varchar(255) NULL,
    source varchar(12) NOT NULL DEFAULT 'pasted' CHECK (source IN ('pdf','docx','text','pasted')),
    extraction_method varchar(50) NULL,
    extraction_confidence varchar(12) NULL,
    extracted_text LONGTEXT NOT NULL,
    words INT NOT NULL DEFAULT 0,
    gate_score smallint NOT NULL DEFAULT 0,
    gate_label varchar(20) NOT NULL DEFAULT 'resume',
    gate_json LONGTEXT NULL,
    rq_overall DECIMAL(5,2) NULL,
    rq_grade varchar(30) NULL,
    rq_json LONGTEXT NULL,
    is_current smallint NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_resumes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_resumes_user ON resumes (user_id, created_at);

CREATE TABLE IF NOT EXISTS resume_rejections (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    original_name varchar(160) NOT NULL DEFAULT '',
    source varchar(12) NOT NULL DEFAULT 'pasted',
    words INT NOT NULL DEFAULT 0,
    gate_score smallint NOT NULL DEFAULT 0,
    gate_label varchar(20) NOT NULL DEFAULT '',
    other_type varchar(60) NULL,
    ip_hash char(64) NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_rejections_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_rejections_time ON resume_rejections (created_at);
