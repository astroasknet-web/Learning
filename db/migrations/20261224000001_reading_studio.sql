-- AI-Powered Reading Studio: content bank (passages, questions), learning levels, scoring configuration, every assessment with its question-level
-- answers, level progress, an append-only audit trail and funnel events. See docs/reading-studio.md.
-- Idempotent like every portal migration (CREATE TABLE IF NOT EXISTS). Student rows go when the account is deleted; content rows stay.

CREATE TABLE IF NOT EXISTS rd_passages (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(60) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  topic VARCHAR(60) NOT NULL DEFAULT 'general',
  difficulty TINYINT NOT NULL DEFAULT 2,
  vocab_level TINYINT NOT NULL DEFAULT 2,
  word_count INT NOT NULL DEFAULT 0,
  level_key CHAR(2) NULL,
  is_diagnostic TINYINT NOT NULL DEFAULT 0,
  status VARCHAR(10) NOT NULL DEFAULT 'draft',
  source VARCHAR(10) NOT NULL DEFAULT 'authored',
  review_state VARCHAR(12) NOT NULL DEFAULT 'unreviewed',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_rd_passage_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_rd_passage_level ON rd_passages (level_key, status);

-- mode: diagnostic | practice | mastery | recall. options_json and answer_json depend on format (mcq, tf, conclusion, match, short).
CREATE TABLE IF NOT EXISTS rd_questions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  passage_id INT NOT NULL,
  ref VARCHAR(20) NOT NULL,
  mode VARCHAR(12) NOT NULL DEFAULT 'practice',
  format VARCHAR(12) NOT NULL DEFAULT 'mcq',
  stem VARCHAR(1200) NOT NULL,
  options_json VARCHAR(3000) NOT NULL,
  answer_json VARCHAR(600) NOT NULL,
  explanation VARCHAR(2000) NOT NULL,
  skill VARCHAR(24) NOT NULL,
  qtype VARCHAR(16) NOT NULL DEFAULT 'locate',
  difficulty TINYINT NOT NULL DEFAULT 2,
  expected_secs INT NOT NULL DEFAULT 45,
  position INT NOT NULL DEFAULT 0,
  status VARCHAR(10) NOT NULL DEFAULT 'draft',
  source VARCHAR(10) NOT NULL DEFAULT 'authored',
  review_state VARCHAR(12) NOT NULL DEFAULT 'unreviewed',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_rd_question_ref UNIQUE (ref),
  CONSTRAINT fk_rd_q_passage FOREIGN KEY (passage_id) REFERENCES rd_passages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_rd_q_passage ON rd_questions (passage_id, mode, status);
CREATE INDEX ix_rd_q_skill ON rd_questions (skill, status);

-- Learning levels. The algorithm never refers to a level by name: only by key, order and the mastery numbers stored here.
CREATE TABLE IF NOT EXISTS rd_levels (
  level_key CHAR(2) NOT NULL PRIMARY KEY,
  position INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  objective VARCHAR(500) NOT NULL DEFAULT '',
  lesson_json MEDIUMTEXT NOT NULL,
  pass_pct TINYINT NOT NULL DEFAULT 75,
  min_questions TINYINT NOT NULL DEFAULT 4,
  mastery_size TINYINT NOT NULL DEFAULT 6,
  timed TINYINT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Administrator-set scoring weights, diagnostic thresholds, minimum evidence and free-tier limits (JSON per key).
CREATE TABLE IF NOT EXISTS rd_config (
  k VARCHAR(40) NOT NULL PRIMARY KEY,
  v_json VARCHAR(3000) NOT NULL,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rd_enrolments (
  user_id INT NOT NULL PRIMARY KEY,
  study_minutes TINYINT NOT NULL DEFAULT 20,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rd_enrol_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rd_level_progress (
  user_id INT NOT NULL,
  level_key CHAR(2) NOT NULL,
  lesson_read_at DATETIME NULL,
  mastered_at DATETIME NULL,
  best_pct DECIMAL(5,1) NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, level_key),
  CONSTRAINT fk_rd_lp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per assessment. plan_json is the ordered list of reading units and question ids chosen on the server; the page rebuilds from it.
-- reading_ms and the phase times come from the server clock; scoring_version and content_version say which rules produced the scores.
CREATE TABLE IF NOT EXISTS rd_assessments (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(24) NOT NULL,
  user_id INT NOT NULL,
  kind VARCHAR(12) NOT NULL,
  level_key CHAR(2) NULL,
  focus_skill VARCHAR(24) NULL,
  plan_json MEDIUMTEXT NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'open',
  completion VARCHAR(10) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  submitted_at DATETIME(3) NULL,
  reading_ms INT NULL,
  answering_ms INT NULL,
  total_ms INT NULL,
  word_count INT NULL,
  wpm DECIMAL(6,1) NULL,
  overall_score DECIMAL(5,1) NULL,
  comprehension_pct DECIMAL(5,1) NULL,
  qa_pct DECIMAL(5,1) NULL,
  correct_n INT NOT NULL DEFAULT 0,
  total_n INT NOT NULL DEFAULT 0,
  avg_difficulty DECIMAL(3,1) NULL,
  scoring_version VARCHAR(12) NULL,
  content_version VARCHAR(40) NULL,
  provisional TINYINT NOT NULL DEFAULT 1,
  repeat_of BIGINT NULL,
  result_json MEDIUMTEXT NULL,
  CONSTRAINT uq_rd_assess_public UNIQUE (public_id),
  CONSTRAINT fk_rd_assess_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_rd_assess_user ON rd_assessments (user_id, status, submitted_at);
CREATE INDEX ix_rd_assess_kind ON rd_assessments (kind, status);

-- Every marked answer: selected response, correctness, server-checked response time and the question's tags as they were at the time.
CREATE TABLE IF NOT EXISTS rd_answers (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assessment_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  question_id INT NOT NULL,
  passage_id INT NOT NULL,
  selected_json VARCHAR(400) NULL,
  correct TINYINT NOT NULL DEFAULT 0,
  credit DECIMAL(4,3) NOT NULL DEFAULT 0,
  response_ms INT NULL,
  skill VARCHAR(24) NOT NULL,
  qtype VARCHAR(16) NOT NULL,
  difficulty TINYINT NOT NULL,
  expected_secs INT NOT NULL DEFAULT 45,
  skipped TINYINT NOT NULL DEFAULT 0,
  answered_at DATETIME(3) NULL,
  CONSTRAINT uq_rd_answer UNIQUE (assessment_id, question_id),
  CONSTRAINT fk_rd_ans_assess FOREIGN KEY (assessment_id) REFERENCES rd_assessments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_rd_ans_user_skill ON rd_answers (user_id, skill);
CREATE INDEX ix_rd_ans_question ON rd_answers (question_id);

-- Append-only record of changes to content, scoring configuration, levels and access.
CREATE TABLE IF NOT EXISTS rd_audit (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  action VARCHAR(40) NOT NULL,
  entity VARCHAR(20) NOT NULL,
  entity_id VARCHAR(40) NOT NULL DEFAULT '',
  detail_json VARCHAR(3000) NOT NULL DEFAULT '{}',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Funnel events for the administrator's conversion view: a locked preview was shown, an upgrade button was used.
CREATE TABLE IF NOT EXISTS rd_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  event VARCHAR(24) NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_rd_events ON rd_events (event, created_at);
