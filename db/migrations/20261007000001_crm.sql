-- MySQL / MariaDB version of the portal schema step 20261007000001_crm.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- Overseas Education CRM: leads, pipeline, activities/tasks, applications, exam & profile milestones,
-- documents, student-paid third-party verification, payments, and per-user access. Idempotent.

-- Who may open the CRM. Admins always can; everyone else needs a row here (granted by an admin).
CREATE TABLE IF NOT EXISTS crm_access (
  user_id     INT     PRIMARY KEY,
  level       varchar(10) NOT NULL DEFAULT 'agent',      -- agent (own leads) | manager (all leads + reports)
  granted_by  INT     NULL,
  created_at  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_crm_access_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crm_leads (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name             varchar(120) NOT NULL,
  phone            varchar(30)  NOT NULL DEFAULT '',
  email            varchar(190) NOT NULL DEFAULT '',
  city             varchar(80)  NOT NULL DEFAULT '',
  source           varchar(30)  NOT NULL DEFAULT 'walk_in',
  qualification    varchar(80)  NOT NULL DEFAULT '',
  percentage       DECIMAL(5,2) NULL,
  pref_country     varchar(40)  NOT NULL DEFAULT '',
  pref_course      varchar(120) NOT NULL DEFAULT '',
  intake           varchar(30)  NOT NULL DEFAULT '',
  budget_inr       bigint       NULL,
  stage            varchar(24)  NOT NULL DEFAULT 'new',
  lost_reason      varchar(160) NOT NULL DEFAULT '',
  counsellor_id    INT      NULL,
  user_id          INT      NULL,   -- linked student account, if any
  access_token     varchar(40)  NOT NULL UNIQUE,                                -- private link for the student's file page
  consent_at       DATETIME    NULL,
  last_contact_at  DATETIME    NULL,
  next_followup_at DATETIME    NULL,
  enrolled_at      DATETIME    NULL,
  created_by       INT      NULL,
  created_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_crm_leads_counsellor_id FOREIGN KEY (counsellor_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_crm_leads_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX crm_leads_stage_idx     ON crm_leads (stage, updated_at);

CREATE INDEX crm_leads_counsellor_idx ON crm_leads (counsellor_id, stage);

CREATE INDEX crm_leads_followup_idx   ON crm_leads (next_followup_at);

CREATE INDEX crm_leads_phone_idx      ON crm_leads (phone);

CREATE INDEX crm_leads_email_idx      ON crm_leads (email);

-- Everything that happens to a lead: calls, notes, stage moves. Doubles as the audit trail.
CREATE TABLE IF NOT EXISTS crm_activities (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lead_id     INT     NOT NULL,
  actor_id    INT     NULL,
  kind        varchar(16) NOT NULL DEFAULT 'note',      -- note | call | whatsapp | email | meeting | stage | system
  body        varchar(1000) NOT NULL DEFAULT '',
  created_at  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_crm_activities_lead_id FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX crm_activities_lead_idx ON crm_activities (lead_id, created_at);

CREATE INDEX crm_activities_actor_idx ON crm_activities (actor_id, created_at);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lead_id     INT      NOT NULL,
  assignee_id INT      NULL,
  title       varchar(160) NOT NULL,
  due_at      DATETIME    NOT NULL,
  done_at     DATETIME    NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_crm_tasks_lead_id FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX crm_tasks_due_idx  ON crm_tasks (assignee_id, done_at, due_at);

CREATE INDEX crm_tasks_lead_idx ON crm_tasks (lead_id);

-- University applications for a lead (the lead need not have a portal account).
CREATE TABLE IF NOT EXISTS crm_applications (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lead_id     INT      NOT NULL,
  university  varchar(160) NOT NULL,
  country     varchar(40)  NOT NULL DEFAULT '',
  program     varchar(160) NOT NULL DEFAULT '',
  intake      varchar(30)  NOT NULL DEFAULT '',
  status      varchar(16)  NOT NULL DEFAULT 'planned',  -- planned | submitted | offer | rejected | accepted | declined
  offer_type  varchar(16)  NOT NULL DEFAULT '',          -- conditional | unconditional
  applied_at  DATETIME    NULL,
  offer_at    DATETIME    NULL,
  note        varchar(255) NOT NULL DEFAULT '',
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_crm_applications_lead_id FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX crm_applications_lead_idx ON crm_applications (lead_id);

CREATE INDEX crm_applications_status_idx ON crm_applications (status);

-- The student's path: English tests (IELTS...), aptitude tests (SAT...), internship, community service (NGO), SOP/LOR...
CREATE TABLE IF NOT EXISTS crm_milestones (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lead_id     INT      NOT NULL,
  kind        varchar(24)  NOT NULL,
  status      varchar(14)  NOT NULL DEFAULT 'not_started',  -- not_started | in_progress | booked | completed | certified
  target_date date         NULL,
  exam_date   date         NULL,
  score       varchar(30)  NOT NULL DEFAULT '',
  detail      varchar(255) NOT NULL DEFAULT '',             -- e.g. organisation / NGO name / hours
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT crm_milestones_uq UNIQUE (lead_id, kind)
,
  CONSTRAINT fk_crm_milestones_lead_id FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crm_documents (
  id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lead_id        INT      NOT NULL,
  doc_type       varchar(24)  NOT NULL,
  original_name  varchar(160) NOT NULL,
  stored_name    varchar(80)  NOT NULL,
  mime           varchar(80)  NOT NULL,
  size           INT      NOT NULL,
  status         varchar(16)  NOT NULL DEFAULT 'uploaded',  -- uploaded | in_verification | verified | rejected
  uploaded_by    INT      NULL,                         -- null = the student, via their private link
  scan_status    varchar(10)  NOT NULL DEFAULT 'unscanned',
  created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_crm_documents_lead_id FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX crm_documents_lead_idx ON crm_documents (lead_id, doc_type);

-- Third-party verification. Started by the student's submission and paid by the student; staff record the partner's result per document.
CREATE TABLE IF NOT EXISTS crm_verifications (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lead_id       INT      NOT NULL,
  provider      varchar(120) NOT NULL DEFAULT '',
  reference     varchar(80)  NOT NULL DEFAULT '',           -- the partner's case number
  fee_inr       INT      NOT NULL,
  status        varchar(16)  NOT NULL DEFAULT 'awaiting_payment', -- awaiting_payment | paid | in_progress | verified | discrepancy | cancelled
  report_note   varchar(500) NOT NULL DEFAULT '',
  requested_by  varchar(10)  NOT NULL DEFAULT 'student',
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at       DATETIME    NULL,
  completed_at  DATETIME    NULL
,
  CONSTRAINT fk_crm_verifications_lead_id FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX crm_verifications_lead_idx ON crm_verifications (lead_id, status);

CREATE TABLE IF NOT EXISTS crm_verification_items (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  verification_id  INT      NOT NULL,
  document_id      INT      NOT NULL,
  result           varchar(14)  NOT NULL DEFAULT 'pending',  -- pending | verified | mismatch | unverifiable
  note             varchar(255) NOT NULL DEFAULT '',
  CONSTRAINT crm_verification_items_uq UNIQUE (verification_id, document_id)
,
  CONSTRAINT fk_crm_verification_items_verification_id FOREIGN KEY (verification_id) REFERENCES crm_verifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_crm_verification_items_document_id FOREIGN KEY (document_id) REFERENCES crm_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Money in: service fees, deposits, and the student-paid verification fee (online orders carry order_id / payment_id).
CREATE TABLE IF NOT EXISTS crm_payments (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lead_id          INT      NOT NULL,
  kind             varchar(16)  NOT NULL DEFAULT 'service_fee',   -- service_fee | deposit | tuition | verification | other
  amount_inr       INT      NOT NULL,
  status           varchar(10)  NOT NULL DEFAULT 'due',            -- due | received | waived | failed
  due_on           date         NULL,
  received_on      date         NULL,
  method           varchar(16)  NOT NULL DEFAULT '',                -- cash | upi | bank | card | razorpay
  reference        varchar(80)  NOT NULL DEFAULT '',
  note             varchar(255) NOT NULL DEFAULT '',
  verification_id  INT      NULL,
  order_id         varchar(64)  NULL UNIQUE,
  payment_id       varchar(64)  NULL UNIQUE,
  recorded_by      INT      NULL,
  created_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  CONSTRAINT fk_crm_payments_lead_id FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_crm_payments_verification_id FOREIGN KEY (verification_id) REFERENCES crm_verifications(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX crm_payments_lead_idx ON crm_payments (lead_id, status);

CREATE INDEX crm_payments_recv_idx ON crm_payments (status, received_on);
