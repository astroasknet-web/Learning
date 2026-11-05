-- MySQL / MariaDB version of the portal schema step 20261002000001_initial_schema.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- GrowQR portal (internships, courses, study abroad, resume scoring): initial schema for Supabase / Postgres.
--
-- Idempotent: every statement can run more than once. The same file is applied by the Supabase GitHub integration
-- (supabase/migrations) and, as a fallback, by the app itself on first request (src/Portal/Schema.php).
--
-- SECURITY: the portal talks to Postgres with a server-side credential (the pooler's postgres role), never with the
-- public anon key. Row level security is therefore switched ON for every table with NO policies, which makes the
-- tables unreachable through Supabase's public REST/GraphQL API. Do not add anon/authenticated policies to these tables.

CREATE TABLE IF NOT EXISTS schema_meta (
    k varchar(120) NOT NULL PRIMARY KEY,
    v varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(40) NOT NULL CHECK (role IN ('student','employer','admin','counselor','teacher','parent')),
    email varchar(190) NOT NULL,
    password_hash varchar(255) NOT NULL,
    name varchar(120) NOT NULL,
    created_at DATETIME NOT NULL,
    last_login_at DATETIME NULL,
    email_verified_at DATETIME NULL,
    mfa_secret varchar(255) NULL,
    mfa_enabled_at DATETIME NULL,
    mfa_recovery LONGTEXT NULL,
    mfa_last_step bigint NULL,
    CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_profiles (
    user_id INT NOT NULL PRIMARY KEY,
    college varchar(160) NOT NULL DEFAULT '',
    phone varchar(20) NOT NULL DEFAULT '',
    skills LONGTEXT NULL,
    resume_text LONGTEXT NULL,
    resume_name varchar(160) NULL,
    rq_overall DECIMAL(5,2) NULL,
    rq_grade varchar(30) NULL,
    rq_json LONGTEXT NULL,
    rq_updated_at DATETIME NULL,
    CONSTRAINT fk_sp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS companies (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_user_id INT NULL,
    name varchar(160) NOT NULL,
    domain varchar(190) NOT NULL DEFAULT '',
    verified smallint NOT NULL DEFAULT 0,
    resp_rate smallint NULL,
    color varchar(9) NOT NULL DEFAULT '#4338ca',
    is_sample smallint NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_co_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_companies_owner ON companies (owner_user_id);

CREATE TABLE IF NOT EXISTS internships (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    slug varchar(190) NOT NULL,
    title varchar(160) NOT NULL,
    category varchar(60) NOT NULL,
    location varchar(60) NOT NULL,
    mode VARCHAR(40) NOT NULL DEFAULT 'Remote' CHECK (mode IN ('Remote','On-site','Hybrid')),
    stipend INT NOT NULL,
    weeks INT NOT NULL,
    openings INT NOT NULL DEFAULT 1,
    badge varchar(30) NOT NULL DEFAULT 'PPO possible',
    about LONGTEXT NOT NULL,
    do_json LONGTEXT NULL,
    req_json LONGTEXT NULL,
    perks_json LONGTEXT NULL,
    skills_json LONGTEXT NULL,
    question varchar(255) NOT NULL DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'pending' CHECK (status IN ('draft','pending','live','closed','rejected')),
    deadline date NULL,
    posted_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    is_sample smallint NOT NULL DEFAULT 0,
    CONSTRAINT uq_internships_slug UNIQUE (slug),
    CONSTRAINT fk_in_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_internships_status ON internships (status, posted_at);

CREATE INDEX ix_internships_company ON internships (company_id);

CREATE TABLE IF NOT EXISTS applications (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    internship_id INT NOT NULL,
    student_id INT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Applied' CHECK (status IN ('Applied','Viewed','Shortlisted','Interview','Offered','Hired','Rejected')),
    note LONGTEXT NOT NULL,
    answer LONGTEXT NOT NULL,
    phone varchar(20) NOT NULL,
    availability varchar(20) NOT NULL,
    resume_file varchar(80) NULL,
    resume_name varchar(160) NULL,
    resume_text LONGTEXT NULL,
    match_score smallint NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT uq_app_pair UNIQUE (internship_id, student_id),
    CONSTRAINT fk_app_job FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    CONSTRAINT fk_app_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_app_student ON applications (student_id, status);

CREATE TABLE IF NOT EXISTS application_events (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    status varchar(20) NOT NULL,
    note varchar(255) NOT NULL DEFAULT '',
    actor_user_id INT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_ev_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_ev_app ON application_events (application_id, created_at);

CREATE TABLE IF NOT EXISTS auth_throttle (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    bucket varchar(120) NOT NULL,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_throttle ON auth_throttle (bucket, created_at);

CREATE TABLE IF NOT EXISTS password_resets (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash char(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT uq_reset_token UNIQUE (token_hash),
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_reset_user ON password_resets (user_id);

CREATE TABLE IF NOT EXISTS mail_outbox (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    to_email varchar(190) NOT NULL,
    to_name varchar(120) NOT NULL DEFAULT '',
    subject varchar(255) NOT NULL,
    html LONGTEXT NOT NULL,
    text_body LONGTEXT NOT NULL,
    kind varchar(40) NOT NULL DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','logged')),
    attempts smallint NOT NULL DEFAULT 0,
    error varchar(255) NULL,
    created_at DATETIME NOT NULL,
    sent_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_outbox_status ON mail_outbox (status, id);

CREATE TABLE IF NOT EXISTS email_verifications (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash char(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT uq_verify_token UNIQUE (token_hash),
    CONSTRAINT fk_verify_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_verify_user ON email_verifications (user_id);

CREATE TABLE IF NOT EXISTS course_categories (
    key_name varchar(30) NOT NULL PRIMARY KEY,
    name varchar(80) NOT NULL,
    c1 varchar(9) NOT NULL DEFAULT '#4338ca',
    c2 varchar(9) NOT NULL DEFAULT '#818cf8',
    sort smallint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug varchar(120) NOT NULL,
    title varchar(190) NOT NULL,
    category varchar(30) NOT NULL,
    level varchar(8) NOT NULL DEFAULT 'B',
    level_label varchar(40) NOT NULL DEFAULT '',
    tags varchar(120) NOT NULL DEFAULT '',
    hours varchar(60) NOT NULL DEFAULT '',
    hours_num INT NOT NULL DEFAULT 0,
    modules INT NOT NULL DEFAULT 0,
    weeks varchar(60) NOT NULL DEFAULT '',
    pace varchar(60) NOT NULL DEFAULT '',
    badge varchar(120) NOT NULL DEFAULT '',
    prereq LONGTEXT NULL,
    best_for LONGTEXT NULL,
    brief LONGTEXT NULL,
    learn_json LONGTEXT NULL,
    hands_on LONGTEXT NULL,
    outcome LONGTEXT NULL,
    sort INT NOT NULL DEFAULT 0,
    icon varchar(30) NOT NULL DEFAULT 'sparkles',
    CONSTRAINT uq_courses_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_courses_cat ON courses (category, sort);

CREATE INDEX ix_courses_hours ON courses (hours_num);

CREATE TABLE IF NOT EXISTS course_enrolments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','in_progress','completed')),
    done_json LONGTEXT NOT NULL,
    progress smallint NOT NULL DEFAULT 0,
    started_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    certificate_url varchar(255) NOT NULL DEFAULT '',
    certificate_code varchar(60) NOT NULL DEFAULT '',
    verified smallint NOT NULL DEFAULT 0,
    verified_via varchar(20) NOT NULL DEFAULT '',
    updated_at DATETIME NOT NULL,
    CONSTRAINT uq_enrol UNIQUE (user_id, course_id),
    CONSTRAINT fk_enrol_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_enrol_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_enrol_course ON course_enrolments (course_id);

CREATE TABLE IF NOT EXISTS saved_internships (
    user_id INT NOT NULL,
    internship_id INT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, internship_id),
    CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_job FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_saved_job ON saved_internships (internship_id);

CREATE TABLE IF NOT EXISTS sa_countries (
    key_name varchar(20) NOT NULL PRIMARY KEY,
    name varchar(60) NOT NULL,
    code char(2) NOT NULL,
    currency char(3) NOT NULL,
    data_json LONGTEXT NOT NULL,
    sort smallint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sa_universities (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug varchar(80) NOT NULL,
    country_key varchar(20) NOT NULL,
    name varchar(160) NOT NULL,
    city varchar(80) NOT NULL,
    type VARCHAR(40) NOT NULL DEFAULT 'public' CHECK (type IN ('public','private')),
    url varchar(255) NOT NULL,
    band smallint NOT NULL DEFAULT 3,
    cost_tier VARCHAR(40) NOT NULL DEFAULT 'mid' CHECK (cost_tier IN ('low','mid','high')),
    levels varchar(20) NOT NULL DEFAULT 'UG,PG',
    fields_json LONGTEXT NOT NULL,
    english_taught smallint NOT NULL DEFAULT 1,
    blurb varchar(255) NOT NULL DEFAULT '',
    sort INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_sa_uni_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_sa_uni_country ON sa_universities (country_key, band);

CREATE TABLE IF NOT EXISTS sa_profiles (
    user_id INT NOT NULL PRIMARY KEY,
    level VARCHAR(40) NOT NULL DEFAULT 'PG' CHECK (level IN ('UG','PG')),
    field varchar(60) NOT NULL DEFAULT '',
    score_type VARCHAR(40) NOT NULL DEFAULT 'percentage' CHECK (score_type IN ('percentage','cgpa10','gpa4')),
    score_value DECIMAL(5,2) NULL,
    academic_index DECIMAL(5,2) NULL,
    english_test VARCHAR(40) NOT NULL DEFAULT 'none' CHECK (english_test IN ('none','IELTS','TOEFL','PTE')),
    english_score DECIMAL(5,1) NULL,
    english_eq DECIMAL(3,1) NULL,
    gre INT NULL,
    budget_inr INT NOT NULL DEFAULT 0,
    countries varchar(120) NOT NULL DEFAULT '',
    intake varchar(30) NOT NULL DEFAULT '',
    goal varchar(500) NOT NULL DEFAULT '',
    stage VARCHAR(40) NOT NULL DEFAULT 'ONBOARDING' CHECK (stage IN ('ONBOARDING','DOC_COLLECTION','IN_REVIEW','APPLIED','OFFER_RECEIVED','VISA_PREP','ALUMNI')),
    consent_at DATETIME NULL,
    consent_version varchar(10) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    counselor_id INT NULL,
    CONSTRAINT fk_sap_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_sap_counselor ON sa_profiles (counselor_id);

CREATE TABLE IF NOT EXISTS sa_shortlist (
    user_id INT NOT NULL,
    university_id INT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, university_id),
    CONSTRAINT fk_sas_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sas_uni FOREIGN KEY (university_id) REFERENCES sa_universities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sa_applications (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    university_id INT NOT NULL,
    program varchar(160) NOT NULL DEFAULT '',
    intake varchar(30) NOT NULL DEFAULT '',
    status VARCHAR(40) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','applied','offer','declined','accepted')),
    offer_type VARCHAR(40) NOT NULL DEFAULT '' CHECK (offer_type IN ('','conditional','unconditional')),
    offer_note varchar(255) NOT NULL DEFAULT '',
    visa_done_json LONGTEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT uq_sa_app UNIQUE (user_id, university_id),
    CONSTRAINT fk_saa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_saa_uni FOREIGN KEY (university_id) REFERENCES sa_universities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_sa_app_status ON sa_applications (status, updated_at);

CREATE TABLE IF NOT EXISTS sa_status_history (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    application_id INT NULL,
    scope VARCHAR(40) NOT NULL CHECK (scope IN ('stage','application')),
    from_status varchar(20) NOT NULL DEFAULT '',
    to_status varchar(20) NOT NULL,
    actor_user_id INT NULL,
    note varchar(255) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_sah_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_sah_user ON sa_status_history (user_id, created_at);

CREATE TABLE IF NOT EXISTS sa_documents (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    doc_type VARCHAR(40) NOT NULL CHECK (doc_type IN ('passport','transcripts','sop','lor','english','financial','cv','other')),
    original_name varchar(160) NOT NULL,
    stored_name varchar(80) NOT NULL,
    mime varchar(80) NOT NULL,
    size INT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','verified','rejected')),
    reject_reason varchar(255) NOT NULL DEFAULT '',
    verified_by INT NULL,
    verified_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    scan_status VARCHAR(40) NOT NULL DEFAULT 'unscanned' CHECK (scan_status IN ('clean','flagged','unscanned')),
    scan_note varchar(120) NOT NULL DEFAULT '',
    CONSTRAINT fk_sad_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_sad_user ON sa_documents (user_id, doc_type);

CREATE INDEX ix_sad_status ON sa_documents (status, created_at);

CREATE TABLE IF NOT EXISTS sa_audit (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT NULL,
    subject_user_id INT NULL,
    action varchar(40) NOT NULL,
    detail varchar(255) NOT NULL DEFAULT '',
    ip_hash char(16) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_saa_subject ON sa_audit (subject_user_id, created_at);

CREATE INDEX ix_saa_action ON sa_audit (action, created_at);

CREATE TABLE IF NOT EXISTS sa_notes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    author_id INT NOT NULL,
    body varchar(1000) NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_san_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_san_student ON sa_notes (student_id, created_at);

CREATE TABLE IF NOT EXISTS sa_funds (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    kind VARCHAR(40) NOT NULL CHECK (kind IN ('savings','family','scholarship','other')),
    label varchar(80) NOT NULL,
    amount_inr bigint NOT NULL,
    document_id INT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_saf_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_saf_user ON sa_funds (user_id);

CREATE TABLE IF NOT EXISTS sa_loans (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lender varchar(80) NOT NULL,
    loan_type VARCHAR(40) NOT NULL DEFAULT 'unsecured' CHECK (loan_type IN ('secured','unsecured')),
    amount_inr bigint NOT NULL,
    rate_pct DECIMAL(5,2) NULL,
    tenure_years smallint NOT NULL DEFAULT 10,
    moratorium_months INT NOT NULL DEFAULT 30,
    status VARCHAR(40) NOT NULL DEFAULT 'researching' CHECK (status IN ('researching','applied','docs','sanctioned','disbursing','rejected','closed')),
    sanctioned_inr bigint NULL,
    document_id INT NULL,
    checklist_json LONGTEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_sal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_sal_user ON sa_loans (user_id);

CREATE TABLE IF NOT EXISTS sa_visa (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    application_id INT NOT NULL,
    stage VARCHAR(40) NOT NULL DEFAULT 'preparing' CHECK (stage IN ('preparing','booked','attended','pending','approved','refused')),
    appointment_at DATETIME NULL,
    biometrics_at DATETIME NULL,
    centre varchar(80) NOT NULL DEFAULT '',
    notes varchar(500) NOT NULL DEFAULT '',
    reminded_7 DATETIME NULL,
    reminded_1 DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT uq_sav_app UNIQUE (application_id),
    CONSTRAINT fk_sav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sav_app FOREIGN KEY (application_id) REFERENCES sa_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_sav_user ON sa_visa (user_id);

CREATE INDEX ix_sav_appt ON sa_visa (appointment_at);

CREATE TABLE IF NOT EXISTS sa_mock_sessions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    country_key varchar(20) NOT NULL,
    questions_json LONGTEXT NOT NULL,
    score smallint NULL,
    created_at DATETIME NOT NULL,
    finished_at DATETIME NULL,
    CONSTRAINT fk_sam_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_sam_user ON sa_mock_sessions (user_id, created_at);

CREATE TABLE IF NOT EXISTS sa_mock_answers (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    question_id varchar(20) NOT NULL,
    answer LONGTEXT NOT NULL,
    words INT NOT NULL DEFAULT 0,
    coverage smallint NOT NULL DEFAULT 0,
    missing_json LONGTEXT NULL,
    CONSTRAINT uq_saa_q UNIQUE (session_id, question_id),
    CONSTRAINT fk_saa_sess FOREIGN KEY (session_id) REFERENCES sa_mock_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sa_mock_feedback (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    author_id INT NOT NULL,
    body varchar(1000) NOT NULL,
    created_at DATETIME NOT NULL,
    CONSTRAINT fk_samf_sess FOREIGN KEY (session_id) REFERENCES sa_mock_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_samf_sess ON sa_mock_feedback (session_id);

-- Resume-scoring corpus: every scored submission (extracted text, score and structured profile) for model training.
CREATE TABLE IF NOT EXISTS qr_submissions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME NOT NULL,
    candidate_name varchar(255) NULL,
    source varchar(20) NULL,
    filename varchar(255) NULL,
    extraction_method varchar(50) NULL,
    confidence varchar(20) NULL,
    text_length INT NULL,
    career_stage varchar(20) NULL,
    years_experience INT NULL,
    domain varchar(40) NULL,
    overall_score DECIMAL(5,2) NULL,
    grade varchar(20) NULL,
    expert_score DECIMAL(5,2) NULL,
    section1_score DECIMAL(5,2) NULL,
    resume_text LONGTEXT NULL,
    result_json LONGTEXT NULL,
    profile_json LONGTEXT NULL,
    ip_hash char(64) NULL,
    user_agent varchar(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_created ON qr_submissions (created_at);

CREATE INDEX idx_domain ON qr_submissions (domain);

-- Row level security on, no policies: the public API cannot read or write anything here.

-- Belt and braces on Supabase: also remove the default grants to the API roles (these roles do not exist on a plain
-- Postgres, so the block only acts when they are present).
