-- Mathematics Studio: the central analytics layer. Every finished math test on the platform is normalised (through the standardized contract) into
-- mx_attempts + mx_items; mx_mastery caches the per-topic Bayesian estimate so the dashboard is cheap; mx_topics holds the admin-editable taxonomy;
-- mx_config, mx_audit and mx_events hold scoring settings, the change log and the upgrade funnel. See lib/mathstudio/README.md.
-- Idempotent like every portal migration. Student rows cascade when the account is deleted; taxonomy and config stay.

CREATE TABLE IF NOT EXISTS mx_topics (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  area VARCHAR(24) NOT NULL,
  cognitive VARCHAR(16) NOT NULL DEFAULT 'procedure',
  prereq_json VARCHAR(600) NOT NULL DEFAULT '[]',
  position INT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mx_config (
  k VARCHAR(40) NOT NULL PRIMARY KEY,
  v_json VARCHAR(3000) NOT NULL,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per ingested attempt. (source, source_ref, user_id) is unique, so re-ingesting the same attempt updates in place and never double-counts.
CREATE TABLE IF NOT EXISTS mx_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source VARCHAR(40) NOT NULL,
  source_ref VARCHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  engine_version VARCHAR(12) NOT NULL,
  contract_version INT NOT NULL DEFAULT 1,
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NOT NULL,
  total_ms INT NOT NULL DEFAULT 0,
  item_count INT NOT NULL DEFAULT 0,
  overall_score DECIMAL(5,1) NULL,
  accuracy_pct DECIMAL(5,1) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_mx_attempt UNIQUE (source, source_ref, user_id),
  CONSTRAINT fk_mx_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_mx_attempt_user ON mx_attempts (user_id, finished_at);

-- One normalised question. `at` copies the attempt's finished time so history and mastery queries need no join.
CREATE TABLE IF NOT EXISTS mx_items (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  ref VARCHAR(64) NOT NULL,
  topic VARCHAR(40) NOT NULL,
  cognitive VARCHAR(16) NOT NULL,
  difficulty TINYINT NOT NULL,
  format VARCHAR(16) NOT NULL,
  credit DECIMAL(6,3) NOT NULL DEFAULT 0,
  max_marks DECIMAL(6,3) NOT NULL DEFAULT 1,
  correct TINYINT NOT NULL DEFAULT 0,
  skipped TINYINT NOT NULL DEFAULT 0,
  time_ms INT NULL,
  expected_secs INT NULL,
  at DATETIME(3) NOT NULL,
  CONSTRAINT fk_mx_item_attempt FOREIGN KEY (attempt_id) REFERENCES mx_attempts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_mx_item_user_topic ON mx_items (user_id, topic);
CREATE INDEX ix_mx_item_user ON mx_items (user_id, at);

-- Cached per-topic mastery, recomputed on every ingest, so the dashboard reads one small table instead of replaying all items.
CREATE TABLE IF NOT EXISTS mx_mastery (
  user_id INT NOT NULL,
  topic VARCHAR(40) NOT NULL,
  score DECIMAL(5,1) NOT NULL DEFAULT 0,
  p DECIMAL(5,4) NOT NULL DEFAULT 0,
  low DECIMAL(5,1) NOT NULL DEFAULT 0,
  high DECIMAL(5,1) NOT NULL DEFAULT 0,
  items INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  evidence VARCHAR(12) NOT NULL DEFAULT 'insufficient',
  band VARCHAR(12) NOT NULL DEFAULT 'developing',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic),
  CONSTRAINT fk_mx_mastery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mx_enrolment (
  user_id INT NOT NULL PRIMARY KEY,
  study_minutes INT NOT NULL DEFAULT 30,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mx_enrol_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mx_audit (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  action VARCHAR(40) NOT NULL,
  entity VARCHAR(20) NOT NULL,
  entity_id VARCHAR(64) NOT NULL DEFAULT '',
  detail_json VARCHAR(3000) NOT NULL DEFAULT '{}',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mx_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  event VARCHAR(24) NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX ix_mx_events ON mx_events (event, created_at);
