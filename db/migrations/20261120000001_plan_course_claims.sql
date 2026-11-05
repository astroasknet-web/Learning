-- Courses a student has chosen to use from their plan (Pro 1, Silver 2, Gold 4). A claim is only a choice: whether it opens the lessons is decided when
-- the student studies, from the plan they hold at that moment (see lib/pay/plans.ts), so renewing or lapsing a plan needs no clean-up here.
CREATE TABLE IF NOT EXISTS plan_course_claims (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_slug VARCHAR(120) NOT NULL,
  claimed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_plan_claim UNIQUE (user_id, course_slug),
  CONSTRAINT fk_plan_claim_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
