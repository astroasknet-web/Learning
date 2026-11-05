-- Mathematics Speed Enhancement Studio: one continuous course in 15 levels (A to O).
-- What a student has done: the enrolment, which levels and modules are finished, a learning state for every skill (difficulty, accuracy, speed,
-- mastery, next review), every practice session with its marked answers, achievements and the days practised. See docs/math-speed-studio.md.
-- Idempotent like every portal migration (CREATE TABLE IF NOT EXISTS); all rows go when the account is deleted.

CREATE TABLE IF NOT EXISTS ms_enrolments (
  user_id INT NOT NULL PRIMARY KEY,
  language VARCHAR(8) NOT NULL DEFAULT 'en',
  country CHAR(2) NOT NULL DEFAULT 'XX',
  age_band VARCHAR(12) NOT NULL DEFAULT '12-15',
  pace VARCHAR(12) NOT NULL DEFAULT 'regular',
  start_level TINYINT NOT NULL DEFAULT 1,
  diagnostic_done TINYINT NOT NULL DEFAULT 0,
  xp INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ms_enrol_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per level the student has been assessed on. completed_at is set by passing the Level Assessment.
CREATE TABLE IF NOT EXISTS ms_level_progress (
  user_id INT NOT NULL,
  level TINYINT NOT NULL,
  completed_at DATETIME NULL,
  best_pct DECIMAL(5,1) NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  revision_pending TINYINT NOT NULL DEFAULT 0,
  weak_json VARCHAR(2000) NOT NULL DEFAULT '[]',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, level),
  CONSTRAINT fk_ms_level_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A module is finished when Learn and Understand have been read and a graded Practise set was passed (80% or better).
CREATE TABLE IF NOT EXISTS ms_module_progress (
  user_id INT NOT NULL,
  module_key VARCHAR(8) NOT NULL,
  read_at DATETIME NULL,
  best_pct DECIMAL(5,1) NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, module_key),
  CONSTRAINT fk_ms_module_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The learning state of one skill: state_json holds the adaptive difficulty, accuracy and speed averages and the review step;
-- mastery and next_review_at are copied out so "what is due" and "what is weak" are cheap queries.
CREATE TABLE IF NOT EXISTS ms_skill_state (
  user_id INT NOT NULL,
  skill VARCHAR(40) NOT NULL,
  state_json VARCHAR(2000) NOT NULL,
  mastery DECIMAL(5,1) NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  next_review_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, skill),
  CONSTRAINT fk_ms_skill_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_ms_skill_due ON ms_skill_state (user_id, next_review_at);

-- A session is created with a plan (skill, difficulty and seed of every question) and marked once, on the server, when it is submitted.
CREATE TABLE IF NOT EXISTS ms_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(24) NOT NULL,
  user_id INT NOT NULL,
  kind VARCHAR(12) NOT NULL,
  ref VARCHAR(12) NOT NULL DEFAULT '',
  plan_json MEDIUMTEXT NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME NULL,
  total INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  accuracy DECIMAL(5,1) NOT NULL DEFAULT 0,
  median_ms INT NULL,
  passed TINYINT NULL,
  result_json MEDIUMTEXT NULL,
  CONSTRAINT uq_ms_session_public UNIQUE (public_id),
  CONSTRAINT fk_ms_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_ms_session_user ON ms_sessions (user_id, created_at);

-- Every marked answer, for speed and accuracy history.
CREATE TABLE IF NOT EXISTS ms_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  idx SMALLINT NOT NULL,
  skill VARCHAR(40) NOT NULL,
  d TINYINT NOT NULL,
  response VARCHAR(64) NOT NULL DEFAULT '',
  correct TINYINT NOT NULL,
  ms INT NOT NULL,
  allowed_ms INT NOT NULL,
  CONSTRAINT fk_ms_attempt_session FOREIGN KEY (session_id) REFERENCES ms_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_ms_attempt_session ON ms_attempts (session_id, idx);

CREATE TABLE IF NOT EXISTS ms_achievements (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  code VARCHAR(30) NOT NULL,
  ref VARCHAR(40) NOT NULL DEFAULT '',
  detail VARCHAR(200) NOT NULL DEFAULT '',
  earned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ms_achievement UNIQUE (user_id, code, ref),
  CONSTRAINT fk_ms_ach_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The days the student practised (for the Consistency Champion streak).
CREATE TABLE IF NOT EXISTS ms_activity_days (
  user_id INT NOT NULL,
  day DATE NOT NULL,
  questions INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day),
  CONSTRAINT fk_ms_day_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The placement diagnostic: a short adaptive search for the right starting level. state_json is the search so far.
CREATE TABLE IF NOT EXISTS ms_diagnostic (
  user_id INT NOT NULL PRIMARY KEY,
  state_json VARCHAR(2000) NOT NULL,
  recommended TINYINT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  CONSTRAINT fk_ms_diag_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
