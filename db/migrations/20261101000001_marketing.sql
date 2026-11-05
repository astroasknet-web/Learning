-- MySQL / MariaDB schema for the marketing site: forms, applications, bookings, the chat bot and the admin log.
-- It replaces the 45 Supabase migrations that used to live in supabase/migrations. Notes:
--   * ids that were uuids are CHAR(36), filled in by the app; ids that were identity columns are AUTO_INCREMENT.
--   * times are DATETIME(3) in UTC; the data layer (lib/data) turns them into ISO strings and back.
--   * the column comment "json" / "json:[]" / "json:{}" marks a column that holds JSON text (the default after the colon is filled in by the app).
--   * true/false columns are TINYINT(1).
--   * Postgres-only checks (regular expressions, text length) are enforced by the API routes' own validation; allowed-value lists remain as CHECKs.

CREATE TABLE IF NOT EXISTS events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(190) NOT NULL,
  title VARCHAR(255) NOT NULL,
  short_description LONGTEXT NULL,
  full_description LONGTEXT NULL,
  speaker_name VARCHAR(255) NULL,
  speaker_designation VARCHAR(255) NULL,
  speaker_company VARCHAR(255) NULL,
  speaker_image VARCHAR(500) NULL,
  speaker_bio LONGTEXT NULL,
  poster_url VARCHAR(500) NULL,
  venue VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  country VARCHAR(120) NULL,
  event_date DATE NOT NULL,
  start_time VARCHAR(40) NULL,
  end_time VARCHAR(40) NULL,
  timezone VARCHAR(60) NULL DEFAULT 'Asia/Kolkata',
  duration VARCHAR(60) NULL,
  format VARCHAR(60) NULL DEFAULT 'Online',
  badge VARCHAR(60) NULL DEFAULT 'Free',
  price VARCHAR(60) NULL,
  learnings LONGTEXT NULL COMMENT 'json:[]',
  agenda LONGTEXT NULL COMMENT 'json:[]',
  registration_limit INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT events_slug_key UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX events_event_date_idx ON events (event_date);
CREATE INDEX events_is_active_idx ON events (is_active);

CREATE TABLE IF NOT EXISTS event_registrations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  event_id CHAR(36) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(40) NULL,
  company VARCHAR(255) NULL,
  designation VARCHAR(255) NULL,
  linkedin_url VARCHAR(500) NULL,
  expectations LONGTEXT NULL,
  confirmation_sent TINYINT(1) NOT NULL DEFAULT 0,
  reminder_24h_sent TINYINT(1) NOT NULL DEFAULT 0,
  reminder_1h_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT event_registrations_event_email_key UNIQUE (event_id, email),
  CONSTRAINT fk_event_registrations_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX event_registrations_email_idx ON event_registrations (email);

CREATE TABLE IF NOT EXISTS calendar_connections (
  id CHAR(36) NOT NULL PRIMARY KEY,
  expert_slug VARCHAR(190) NULL,
  google_email VARCHAR(254) NULL,
  google_refresh_token LONGTEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  connected_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expert_key VARCHAR(190) GENERATED ALWAYS AS (COALESCE(expert_slug, '__default__')) STORED,
  CONSTRAINT calendar_connections_default_idx UNIQUE (expert_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expert_availability (
  id CHAR(36) NOT NULL PRIMARY KEY,
  expert_slug VARCHAR(190) NOT NULL,
  day_of_week INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_min INT NOT NULL DEFAULT 30,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT expert_availability_dow_check CHECK (day_of_week BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX expert_availability_slug_idx ON expert_availability (expert_slug);

CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  expert_slug VARCHAR(190) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(254) NOT NULL,
  user_phone VARCHAR(40) NULL,
  session_topic LONGTEXT NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  razorpay_order_id VARCHAR(120) NULL,
  razorpay_payment_id VARCHAR(120) NULL,
  amount_inr INT NULL,
  google_event_id VARCHAR(255) NULL,
  google_meet_link VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
  reminder_24h_sent TINYINT(1) NOT NULL DEFAULT 0,
  reminder_1h_sent TINYINT(1) NOT NULL DEFAULT 0,
  reminder_24h_email_ids LONGTEXT NULL COMMENT 'json',
  reminder_1h_email_ids LONGTEXT NULL COMMENT 'json'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX bookings_slug_idx ON bookings (expert_slug);
CREATE INDEX bookings_start_idx ON bookings (start_time);

CREATE TABLE IF NOT EXISTS expert_submissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  email VARCHAR(254) NOT NULL,
  role VARCHAR(255) NOT NULL,
  tag VARCHAR(255) NOT NULL,
  country VARCHAR(120) NOT NULL,
  location VARCHAR(255) NULL,
  persona VARCHAR(255) NULL,
  years_experience INT NOT NULL DEFAULT 0,
  session_duration VARCHAR(60) NOT NULL,
  price VARCHAR(60) NOT NULL,
  headline LONGTEXT NOT NULL,
  bio LONGTEXT NOT NULL,
  intro LONGTEXT NOT NULL,
  about LONGTEXT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  trusted_by_label VARCHAR(255) NULL,
  expertise LONGTEXT NOT NULL COMMENT 'json:[]',
  skills LONGTEXT NOT NULL COMMENT 'json:[]',
  industries LONGTEXT NOT NULL COMMENT 'json:[]',
  languages LONGTEXT NOT NULL COMMENT 'json:[]',
  work_experience LONGTEXT NOT NULL COMMENT 'json:[]',
  education LONGTEXT NOT NULL COMMENT 'json:[]',
  certifications LONGTEXT NOT NULL COMMENT 'json:[]',
  awards LONGTEXT NOT NULL COMMENT 'json:[]',
  what_you_get LONGTEXT NOT NULL COMMENT 'json:[]',
  stats LONGTEXT NOT NULL COMMENT 'json:[]',
  reviews LONGTEXT NOT NULL COMMENT 'json:[]',
  faq LONGTEXT NOT NULL COMMENT 'json:[]',
  socials LONGTEXT NOT NULL COMMENT 'json:[]',
  supports LONGTEXT NOT NULL COMMENT 'json:[]',
  trusted_by LONGTEXT NOT NULL COMMENT 'json:[]',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX expert_submissions_created_at_idx ON expert_submissions (created_at);
CREATE INDEX expert_submissions_status_idx ON expert_submissions (status);

CREATE TABLE IF NOT EXISTS ambassador_waitlist (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT ambassador_waitlist_email_key UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seeker_waitlist (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  source VARCHAR(190) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  country_code VARCHAR(10) NULL,
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  utm_term VARCHAR(255) NULL,
  utm_content VARCHAR(255) NULL,
  gclid VARCHAR(255) NULL,
  landing_page VARCHAR(500) NULL,
  referrer VARCHAR(500) NULL,
  page_path VARCHAR(500) NULL,
  zoho_lead_id VARCHAR(120) NULL,
  crm_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  crm_synced_at DATETIME(3) NULL,
  crm_sync_error LONGTEXT NULL,
  crm_sync_attempts INT NOT NULL DEFAULT 0,
  CONSTRAINT seeker_waitlist_email_key UNIQUE (email),
  CONSTRAINT seeker_waitlist_crm_sync_status_check CHECK (crm_sync_status IN ('pending','syncing','synced','failed','skipped','legacy'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX seeker_waitlist_crm_sync_queue_idx ON seeker_waitlist (crm_sync_status, created_at);

CREATE TABLE IF NOT EXISTS b2b_leads (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(254) NOT NULL,
  company VARCHAR(255) NOT NULL,
  team_size VARCHAR(60) NULL,
  message LONGTEXT NULL,
  agent VARCHAR(255) NULL,
  solution VARCHAR(255) NULL,
  page_path VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  country_code VARCHAR(10) NULL,
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  utm_term VARCHAR(255) NULL,
  utm_content VARCHAR(255) NULL,
  gclid VARCHAR(255) NULL,
  landing_page VARCHAR(500) NULL,
  referrer VARCHAR(500) NULL,
  zoho_lead_id VARCHAR(120) NULL,
  crm_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  crm_synced_at DATETIME(3) NULL,
  crm_sync_error LONGTEXT NULL,
  crm_sync_attempts INT NOT NULL DEFAULT 0,
  CONSTRAINT b2b_leads_crm_sync_status_check CHECK (crm_sync_status IN ('pending','syncing','synced','failed','skipped','legacy'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX b2b_leads_created_at_idx ON b2b_leads (created_at);
CREATE INDEX b2b_leads_crm_sync_queue_idx ON b2b_leads (crm_sync_status, created_at);

CREATE TABLE IF NOT EXISTS contact_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(254) NOT NULL,
  subject VARCHAR(500) NULL,
  message LONGTEXT NOT NULL,
  type VARCHAR(60) NULL DEFAULT 'general',
  created_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `read` TINYINT(1) NULL DEFAULT 0,
  replied TINYINT(1) NULL DEFAULT 0,
  country_code VARCHAR(10) NULL,
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  utm_term VARCHAR(255) NULL,
  utm_content VARCHAR(255) NULL,
  gclid VARCHAR(255) NULL,
  landing_page VARCHAR(500) NULL,
  referrer VARCHAR(500) NULL,
  page_path VARCHAR(500) NULL,
  zoho_lead_id VARCHAR(120) NULL,
  crm_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  crm_synced_at DATETIME(3) NULL,
  crm_sync_error LONGTEXT NULL,
  crm_sync_attempts INT NOT NULL DEFAULT 0,
  CONSTRAINT contact_messages_crm_sync_status_check CHECK (crm_sync_status IN ('pending','syncing','synced','failed','skipped','legacy'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX contact_messages_crm_sync_queue_idx ON contact_messages (crm_sync_status, created_at);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  name VARCHAR(255) NULL,
  status VARCHAR(40) NULL DEFAULT 'active',
  source VARCHAR(190) NULL,
  subscribed_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  unsubscribed_at DATETIME(3) NULL,
  metadata LONGTEXT NULL COMMENT 'json:{}',
  created_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  country_code VARCHAR(10) NULL,
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  utm_term VARCHAR(255) NULL,
  utm_content VARCHAR(255) NULL,
  gclid VARCHAR(255) NULL,
  landing_page VARCHAR(500) NULL,
  referrer VARCHAR(500) NULL,
  page_path VARCHAR(500) NULL,
  zoho_lead_id VARCHAR(120) NULL,
  crm_sync_status VARCHAR(20) NOT NULL DEFAULT 'skipped',
  crm_synced_at DATETIME(3) NULL,
  crm_sync_error LONGTEXT NULL,
  crm_sync_attempts INT NOT NULL DEFAULT 0,
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email),
  CONSTRAINT newsletter_subscribers_crm_sync_status_check CHECK (crm_sync_status IN ('pending','syncing','synced','failed','skipped','legacy'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_leads (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(190) NOT NULL,
  conversation_ids LONGTEXT NOT NULL COMMENT 'json:[]',
  avuid VARCHAR(190) NULL,
  intent VARCHAR(40) NOT NULL DEFAULT 'general_inquiry',
  email VARCHAR(254) NULL,
  name VARCHAR(255) NULL,
  company VARCHAR(255) NULL,
  designation VARCHAR(255) NULL,
  team_size VARCHAR(60) NULL,
  use_case LONGTEXT NULL,
  country_code VARCHAR(10) NULL,
  page_path VARCHAR(500) NULL,
  last_page_path VARCHAR(500) NULL,
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  visit_count INT NOT NULL DEFAULT 1,
  first_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_visit_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  notification_sent TINYINT(1) NOT NULL DEFAULT 0,
  zoho_lead_id VARCHAR(120) NULL,
  zoho_note_created TINYINT(1) NOT NULL DEFAULT 0,
  zoho_task_created TINYINT(1) NOT NULL DEFAULT 0,
  zoho_notes_count INT NOT NULL DEFAULT 0,
  zoho_notes_pending TINYINT(1) GENERATED ALWAYS AS (zoho_notes_count < visit_count) STORED,
  crm_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  crm_synced_at DATETIME(3) NULL,
  crm_sync_error LONGTEXT NULL,
  crm_sync_attempts INT NOT NULL DEFAULT 0,
  CONSTRAINT bot_leads_conversation_id_key UNIQUE (conversation_id),
  CONSTRAINT bot_leads_intent_check CHECK (intent IN ('demo_request','recruiter_inquiry','university_inquiry','enterprise_inquiry','general_inquiry')),
  CONSTRAINT bot_leads_crm_sync_status_check CHECK (crm_sync_status IN ('pending','syncing','synced','failed','skipped','legacy'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX bot_leads_avuid_idx ON bot_leads (avuid);
CREATE INDEX bot_leads_email_idx ON bot_leads (email);
CREATE INDEX bot_leads_crm_sync_queue_idx ON bot_leads (crm_sync_status, created_at);

CREATE TABLE IF NOT EXISTS bot_visitors (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  avuid VARCHAR(190) NOT NULL,
  first_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  visit_count INT NOT NULL DEFAULT 1,
  last_conversation_id VARCHAR(190) NULL,
  last_page_path VARCHAR(500) NULL,
  country_code VARCHAR(10) NULL,
  email VARCHAR(254) NULL,
  bot_lead_id BIGINT NULL,
  zoho_lead_id VARCHAR(120) NULL,
  CONSTRAINT bot_visitors_avuid_key UNIQUE (avuid),
  CONSTRAINT fk_bot_visitors_lead FOREIGN KEY (bot_lead_id) REFERENCES bot_leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX bot_visitors_email_idx ON bot_visitors (email);

CREATE TABLE IF NOT EXISTS bot_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(190) NULL,
  lead_id BIGINT NULL,
  event_type VARCHAR(40) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'ok',
  payload LONGTEXT NULL COMMENT 'json',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT bot_events_event_type_check CHECK (event_type IN ('lead_created','task_created','note_created','email_sent','handoff_requested','transcript_synced','ai_answered','ai_declined','ai_rejected','ai_timeout','ai_error')),
  CONSTRAINT bot_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES bot_leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX bot_events_created_at_idx ON bot_events (created_at);

CREATE TABLE IF NOT EXISTS bot_unanswered (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(190) NULL,
  question LONGTEXT NOT NULL,
  page_path VARCHAR(500) NULL,
  country_code VARCHAR(10) NULL,
  answered_by VARCHAR(10) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT bot_unanswered_answered_by_check CHECK (answered_by IS NULL OR answered_by IN ('ai'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX bot_unanswered_created_at_idx ON bot_unanswered (created_at);

CREATE TABLE IF NOT EXISTS bot_messages (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(190) NOT NULL,
  role VARCHAR(10) NOT NULL,
  content LONGTEXT NOT NULL,
  page_path VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  synced_at DATETIME(3) NULL,
  CONSTRAINT bot_messages_role_check CHECK (role IN ('visitor','bot'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX bot_messages_conversation_idx ON bot_messages (conversation_id, created_at);
CREATE INDEX bot_messages_unsynced_idx ON bot_messages (synced_at, created_at);

CREATE TABLE IF NOT EXISTS booking_intents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  source VARCHAR(60) NOT NULL,
  page_path VARCHAR(500) NULL,
  solution VARCHAR(255) NULL,
  agent VARCHAR(255) NULL,
  country_code VARCHAR(10) NULL,
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  utm_term VARCHAR(255) NULL,
  utm_content VARCHAR(255) NULL,
  gclid VARCHAR(255) NULL,
  landing_page VARCHAR(500) NULL,
  referrer VARCHAR(500) NULL,
  consumed_at DATETIME(3) NULL,
  CONSTRAINT booking_intents_source_check CHECK (source IN ('b2b-enterprise-modal','enterprise-hero','enterprise-final-cta','brand-intelligence','persona-cta','seeker-waitlist-modal'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX booking_intents_created_at_idx ON booking_intents (created_at);

CREATE TABLE IF NOT EXISTS cal_webhook_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  dedupe_key VARCHAR(190) NOT NULL,
  trigger_event VARCHAR(120) NOT NULL,
  cal_uid VARCHAR(190) NULL,
  event_at DATETIME(3) NULL,
  signature_ok TINYINT(1) NOT NULL,
  payload LONGTEXT NOT NULL COMMENT 'json',
  processed_at DATETIME(3) NULL,
  error LONGTEXT NULL,
  CONSTRAINT cal_webhook_events_dedupe_key_key UNIQUE (dedupe_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX cal_webhook_events_uid_idx ON cal_webhook_events (cal_uid, event_at);
CREATE INDEX cal_webhook_events_unprocessed_idx ON cal_webhook_events (processed_at, received_at);

CREATE TABLE IF NOT EXISTS call_bookings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cal_uid VARCHAR(190) NOT NULL,
  cal_booking_id BIGINT NULL,
  cal_event_type_id BIGINT NULL,
  rescheduled_from_uid VARCHAR(190) NULL,
  last_event_at DATETIME(3) NOT NULL,
  last_trigger_event VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  attendee_name VARCHAR(255) NOT NULL,
  attendee_timezone VARCHAR(80) NULL,
  company VARCHAR(255) NULL,
  team_size VARCHAR(60) NULL,
  title VARCHAR(500) NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NULL,
  meeting_url VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'booked',
  booked_at DATETIME(3) NOT NULL,
  rescheduled_at DATETIME(3) NULL,
  cancelled_at DATETIME(3) NULL,
  cancellation_reason LONGTEXT NULL,
  is_disposable_email TINYINT(1) NOT NULL DEFAULT 0,
  responses LONGTEXT NULL COMMENT 'json',
  raw_payload LONGTEXT NULL COMMENT 'json',
  intent_id CHAR(36) NULL,
  source VARCHAR(60) NULL,
  country_code VARCHAR(10) NULL,
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  utm_term VARCHAR(255) NULL,
  utm_content VARCHAR(255) NULL,
  gclid VARCHAR(255) NULL,
  landing_page VARCHAR(500) NULL,
  referrer VARCHAR(500) NULL,
  page_path VARCHAR(500) NULL,
  zoho_lead_id VARCHAR(120) NULL,
  zoho_contact_id VARCHAR(120) NULL,
  crm_record_type VARCHAR(20) NULL,
  crm_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  crm_synced_at DATETIME(3) NULL,
  crm_sync_error LONGTEXT NULL,
  crm_sync_attempts INT NOT NULL DEFAULT 0,
  events_count INT NOT NULL DEFAULT 1,
  zoho_task_id VARCHAR(120) NULL,
  zoho_task_created TINYINT(1) NOT NULL DEFAULT 0,
  zoho_notes_count INT NOT NULL DEFAULT 0,
  notifications_count INT NOT NULL DEFAULT 0,
  attendee_notifications_count INT NOT NULL DEFAULT 0,
  zoho_notes_pending TINYINT(1) GENERATED ALWAYS AS (zoho_notes_count < events_count) STORED,
  notifications_pending TINYINT(1) GENERATED ALWAYS AS (notifications_count < events_count) STORED,
  attendee_notifications_pending TINYINT(1) GENERATED ALWAYS AS (attendee_notifications_count < events_count) STORED,
  CONSTRAINT call_bookings_cal_uid_key UNIQUE (cal_uid),
  CONSTRAINT call_bookings_status_check CHECK (status IN ('booked','rescheduled','cancelled')),
  CONSTRAINT call_bookings_crm_sync_status_check CHECK (crm_sync_status IN ('pending','syncing','synced','failed','skipped','legacy')),
  CONSTRAINT call_bookings_crm_record_type_check CHECK (crm_record_type IS NULL OR crm_record_type IN ('lead','contact')),
  CONSTRAINT fk_call_bookings_intent FOREIGN KEY (intent_id) REFERENCES booking_intents(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX call_bookings_crm_sync_queue_idx ON call_bookings (crm_sync_status, created_at);
CREATE INDEX call_bookings_email_idx ON call_bookings (email);
CREATE INDEX call_bookings_start_time_idx ON call_bookings (start_time);

CREATE TABLE IF NOT EXISTS ambassador_applications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  whatsapp VARCHAR(40) NOT NULL,
  student_id VARCHAR(120) NOT NULL,
  gender VARCHAR(10) NULL,
  aadhaar_number VARCHAR(20) NULL,
  college VARCHAR(300) NOT NULL,
  college_location VARCHAR(255) NULL,
  course VARCHAR(255) NOT NULL,
  passing_year VARCHAR(10) NOT NULL,
  semester VARCHAR(4) NULL,
  home_town VARCHAR(255) NULL,
  current_address LONGTEXT NULL,
  linkedin VARCHAR(500) NOT NULL,
  instagram VARCHAR(500) NULL,
  youtube VARCHAR(500) NULL,
  resume VARCHAR(500) NOT NULL,
  why_join LONGTEXT NOT NULL,
  why_fit LONGTEXT NOT NULL,
  led_something LONGTEXT NOT NULL,
  experience LONGTEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  notes LONGTEXT NULL,
  internal_notes LONGTEXT NULL,
  cohort VARCHAR(4) NOT NULL DEFAULT '02',
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  CONSTRAINT ambassador_applications_email_key UNIQUE (email),
  CONSTRAINT ambassador_applications_aadhaar_number_key UNIQUE (aadhaar_number),
  CONSTRAINT ambassador_applications_gender_check CHECK (gender IS NULL OR gender IN ('male','female')),
  CONSTRAINT ambassador_applications_semester_check CHECK (semester IS NULL OR semester IN ('1','2','3','4','5','6','7','8','9','10')),
  CONSTRAINT ambassador_applications_cohort_check CHECK (cohort IN ('01','02'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ambassador_applications_phone_idx ON ambassador_applications (phone);
CREATE INDEX ambassador_applications_status_created_idx ON ambassador_applications (status, created_at);
CREATE INDEX ambassador_applications_cohort_idx ON ambassador_applications (cohort, created_at);

CREATE TABLE IF NOT EXISTS internship_applications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  college VARCHAR(300) NOT NULL,
  course VARCHAR(255) NOT NULL,
  graduation_year VARCHAR(10) NOT NULL,
  preferred_role VARCHAR(190) NOT NULL,
  skills LONGTEXT NOT NULL,
  availability VARCHAR(40) NOT NULL,
  linkedin VARCHAR(500) NULL,
  portfolio VARCHAR(500) NULL,
  resume VARCHAR(500) NOT NULL,
  why_intern LONGTEXT NOT NULL,
  additional_notes LONGTEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'new',
  internal_notes LONGTEXT NULL,
  utm_source VARCHAR(255) NULL,
  utm_medium VARCHAR(255) NULL,
  utm_campaign VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  aadhaar_number VARCHAR(20) NULL,
  gender VARCHAR(10) NULL,
  home_town VARCHAR(255) NULL,
  current_address LONGTEXT NULL,
  college_location VARCHAR(255) NULL,
  growqr_user_id CHAR(36) NULL,
  growqr_profile_url VARCHAR(500) NULL,
  growqr_profile_snapshot LONGTEXT NULL COMMENT 'json',
  growqr_rq_score DECIMAL(6,2) NULL,
  growqr_avatar_url VARCHAR(500) NULL,
  growqr_account_email VARCHAR(254) NULL,
  semester VARCHAR(4) NULL,
  father_name VARCHAR(255) NULL,
  mother_name VARCHAR(255) NULL,
  dob DATE NULL,
  degree_specialization VARCHAR(255) NULL,
  mode VARCHAR(20) NULL,
  duration VARCHAR(20) NULL,
  languages VARCHAR(300) NULL,
  career_profile_score INT NULL,
  triage VARCHAR(20) NULL,
  triage_score DECIMAL(6,2) NULL,
  triaged_at DATETIME(3) NULL,
  CONSTRAINT internship_applications_email_key UNIQUE (email),
  CONSTRAINT internship_applications_phone_key UNIQUE (phone),
  CONSTRAINT internship_applications_aadhaar_number_key UNIQUE (aadhaar_number),
  CONSTRAINT internship_applications_growqr_user_id_key UNIQUE (growqr_user_id),
  CONSTRAINT internship_applications_availability_check CHECK (availability IN ('immediately','within_2_weeks','within_a_month','flexible')),
  CONSTRAINT internship_applications_status_check CHECK (status IN ('new','screening','shortlisted','interview','selected','waitlist','rejected','offer','joined')),
  CONSTRAINT internship_applications_gender_check CHECK (gender IS NULL OR gender IN ('male','female')),
  CONSTRAINT internship_applications_semester_check CHECK (semester IS NULL OR semester IN ('1','2','3','4','5','6','7','8')),
  CONSTRAINT internship_applications_mode_check CHECK (mode IS NULL OR mode IN ('remote','hybrid')),
  CONSTRAINT internship_applications_duration_check CHECK (duration IS NULL OR duration IN ('3_months','6_months')),
  CONSTRAINT internship_applications_triage_check CHECK (triage IS NULL OR triage IN ('auto_shortlist','on_hold','unscored')),
  CONSTRAINT internship_applications_rq_score_check CHECK (growqr_rq_score IS NULL OR growqr_rq_score BETWEEN 0 AND 100),
  CONSTRAINT internship_applications_triage_score_check CHECK (triage_score IS NULL OR triage_score BETWEEN 0 AND 100),
  CONSTRAINT internship_applications_career_score_check CHECK (career_profile_score IS NULL OR career_profile_score BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX internship_applications_created_at_idx ON internship_applications (created_at);
CREATE INDEX internship_applications_status_created_idx ON internship_applications (status, created_at);
CREATE INDEX internship_applications_rq_score_idx ON internship_applications (growqr_rq_score);
CREATE INDEX internship_applications_mode_idx ON internship_applications (mode);
CREATE INDEX internship_applications_duration_idx ON internship_applications (duration);
CREATE INDEX internship_applications_triage_idx ON internship_applications (triage);

CREATE TABLE IF NOT EXISTS internship_interviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  growqr_user_id CHAR(36) NULL,
  round SMALLINT NOT NULL DEFAULT 1,
  kind VARCHAR(30) NOT NULL DEFAULT 'ai_assessment',
  status VARCHAR(20) NOT NULL DEFAULT 'invited',
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  external_interview_id VARCHAR(190) NULL,
  interview_url VARCHAR(500) NULL,
  scheduled_at DATETIME(3) NULL,
  interviewer VARCHAR(255) NULL,
  meeting_url VARCHAR(500) NULL,
  invited_at DATETIME(3) NULL,
  due_at DATETIME(3) NULL,
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  score DECIMAL(8,2) NULL,
  max_score DECIMAL(8,2) NOT NULL DEFAULT 100,
  hr_verdict VARCHAR(20) NULL,
  summary LONGTEXT NULL,
  competencies LONGTEXT NULL COMMENT 'json',
  transcript_url VARCHAR(500) NULL,
  raw LONGTEXT NULL COMMENT 'json',
  recorded_by VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  strengths LONGTEXT NULL COMMENT 'json',
  weaknesses LONGTEXT NULL COMMENT 'json',
  coaching_notes LONGTEXT NULL COMMENT 'json',
  round_type VARCHAR(20) NULL,
  difficulty VARCHAR(20) NULL,
  target_role VARCHAR(255) NULL,
  duration_minutes INT NULL,
  external_session_id VARCHAR(190) NULL,
  batch_id VARCHAR(190) NULL,
  CONSTRAINT internship_interviews_application_round_key UNIQUE (application_id, round),
  CONSTRAINT internship_interviews_external_id_key UNIQUE (external_interview_id),
  CONSTRAINT internship_interviews_round_check CHECK (round BETWEEN 1 AND 10),
  CONSTRAINT internship_interviews_kind_check CHECK (kind IN ('ai_assessment','final_discussion')),
  CONSTRAINT internship_interviews_status_check CHECK (status IN ('invited','scheduled','in_progress','completed','cancelled','expired','no_show')),
  CONSTRAINT internship_interviews_source_check CHECK (source IN ('manual','app_sync')),
  CONSTRAINT internship_interviews_score_check CHECK (score IS NULL OR score >= 0),
  CONSTRAINT internship_interviews_max_score_check CHECK (max_score > 0),
  CONSTRAINT internship_interviews_hr_verdict_check CHECK (hr_verdict IS NULL OR hr_verdict IN ('strong_yes','yes','maybe','no')),
  CONSTRAINT internship_interviews_round_type_check CHECK (round_type IS NULL OR round_type IN ('warm_up','behavioral','technical')),
  CONSTRAINT internship_interviews_difficulty_check CHECK (difficulty IS NULL OR difficulty IN ('easy','medium','hard')),
  CONSTRAINT internship_interviews_duration_check CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 600),
  CONSTRAINT fk_internship_interviews_application FOREIGN KEY (application_id) REFERENCES internship_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX internship_interviews_growqr_user_idx ON internship_interviews (growqr_user_id);
CREATE INDEX internship_interviews_status_idx ON internship_interviews (status);
CREATE INDEX internship_interviews_session_idx ON internship_interviews (external_session_id);

CREATE TABLE IF NOT EXISTS internship_emails (
  id CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  kind VARCHAR(60) NOT NULL,
  to_email VARCHAR(254) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  resend_id VARCHAR(120) NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'sent',
  error LONGTEXT NULL,
  sent_by VARCHAR(254) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT internship_emails_status_check CHECK (status IN ('sent','failed')),
  CONSTRAINT fk_internship_emails_application FOREIGN KEY (application_id) REFERENCES internship_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX internship_emails_application_idx ON internship_emails (application_id, created_at);
CREATE INDEX internship_emails_kind_idx ON internship_emails (application_id, kind);

CREATE TABLE IF NOT EXISTS internship_appointments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  reference_no VARCHAR(120) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  department VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  duration VARCHAR(60) NOT NULL,
  reporting_manager VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  signatory_name VARCHAR(255) NULL,
  signatory_title VARCHAR(255) NULL,
  issued_at DATETIME(3) NULL,
  created_by VARCHAR(254) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT internship_appointments_application_key UNIQUE (application_id),
  CONSTRAINT fk_internship_appointments_application FOREIGN KEY (application_id) REFERENCES internship_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internship_settings (
  id TINYINT(1) NOT NULL DEFAULT 1 PRIMARY KEY,
  shortlist_min_rq INT NOT NULL DEFAULT 50,
  auto_assign_enabled TINYINT(1) NOT NULL DEFAULT 1,
  interview_round_type VARCHAR(20) NOT NULL DEFAULT 'behavioral',
  auto_advance_enabled TINYINT(1) NOT NULL DEFAULT 0,
  interview_pass_score INT NOT NULL DEFAULT 60,
  default_interviewer_name VARCHAR(255) NULL,
  default_interviewer_email VARCHAR(254) NULL,
  final_round_calendar_id VARCHAR(255) NULL,
  default_department VARCHAR(255) NULL,
  default_duration VARCHAR(60) NOT NULL DEFAULT '6 months',
  default_location VARCHAR(255) NOT NULL DEFAULT 'Remote',
  default_reporting_manager VARCHAR(255) NOT NULL DEFAULT 'Chandni Jha',
  default_signatory_name VARCHAR(255) NOT NULL DEFAULT 'Chandni Jha',
  default_signatory_title VARCHAR(255) NOT NULL DEFAULT 'Head of HR',
  email_application_received TINYINT(1) NOT NULL DEFAULT 1,
  email_interview_invite TINYINT(1) NOT NULL DEFAULT 1,
  email_final_round TINYINT(1) NOT NULL DEFAULT 1,
  email_auto_selected TINYINT(1) NOT NULL DEFAULT 1,
  interview_round_by_role LONGTEXT NOT NULL COMMENT 'json:{}',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(254) NULL,
  CONSTRAINT internship_settings_singleton CHECK (id = 1),
  CONSTRAINT internship_settings_shortlist_check CHECK (shortlist_min_rq BETWEEN 0 AND 100),
  CONSTRAINT internship_settings_round_type_check CHECK (interview_round_type IN ('warm_up','behavioral','technical')),
  CONSTRAINT internship_settings_pass_check CHECK (interview_pass_score BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  admin_id VARCHAR(64) NULL,
  admin_email VARCHAR(254) NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  target_id VARCHAR(120) NULL,
  target_name VARCHAR(255) NULL,
  old_value LONGTEXT NULL,
  new_value LONGTEXT NULL,
  details LONGTEXT NULL COMMENT 'json',
  created_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX admin_activity_logs_created_at_idx ON admin_activity_logs (created_at);

INSERT IGNORE INTO internship_settings (id, interview_round_by_role) VALUES (1, '{}');
