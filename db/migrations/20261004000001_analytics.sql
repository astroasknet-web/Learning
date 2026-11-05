-- MySQL / MariaDB version of the portal schema step 20261004000001_analytics.sql. Converted, then reviewed by hand. Statements run one by one; a duplicate index or column is skipped.
-- First-party, cookie-less analytics: page views and outbound clicks (e.g. to MathStudy.in e-books).
-- No IP address or user agent is stored. `visitor` is a one-way hash that changes every day, so it counts
-- unique visitors within a day but cannot follow anyone across days. Idempotent.

CREATE TABLE IF NOT EXISTS analytics_events (
  id        BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  kind      varchar(8)   NOT NULL,                 -- 'view' | 'click'
  path      varchar(160) NOT NULL,                 -- page script, e.g. /courses.php   (click: placement page unknown, see campaign)
  item      varchar(120) NULL,                     -- course/internship slug, country key, ... (view); destination path (click)
  campaign  varchar(40)  NULL,                     -- click: placement (nav, footer, home, courses, abroad, dashboard ...)
  visitor   char(20)     NOT NULL,                 -- daily-rotating hash
  user_id   INT      NULL,
  role      varchar(12)  NULL,
  referrer  varchar(120) NULL,                     -- external referrer host only
  device    varchar(8)   NOT NULL DEFAULT 'desktop' -- desktop | mobile | tablet
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX analytics_events_time_idx ON analytics_events (created_at);

CREATE INDEX analytics_events_kind_idx ON analytics_events (kind, created_at);
