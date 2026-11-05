-- Unified payments: catalogue, prices, orders, payment attempts, webhooks, refunds, disputes, invoices, entitlements, audit, reconciliation.
-- Money is always an integer in the currency's minor unit (paise, cents) next to its ISO 4217 code. No floating point.
-- Public references (order public_id, invoice number) are what customers see; the BIGINT ids never leave the server.

CREATE TABLE IF NOT EXISTS pay_currencies (
  code CHAR(3) NOT NULL PRIMARY KEY,
  minor_units TINYINT NOT NULL DEFAULT 2,
  symbol VARCHAR(8) NOT NULL DEFAULT '',
  enabled TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_products (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(80) NOT NULL,
  kind VARCHAR(20) NOT NULL,                  -- plan | course | ebook | resume | class | consulting | other
  title VARCHAR(190) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  allow_guest TINYINT(1) NOT NULL DEFAULT 0,  -- may be bought without an account
  fulfil_ref VARCHAR(190) NOT NULL DEFAULT '', -- course slug, plan key, ... what the entitlement points at
  access_days INT NULL,                       -- length of access in days; NULL = does not expire
  max_qty SMALLINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_products_sku UNIQUE (sku),
  CONSTRAINT ck_pay_products_kind CHECK (kind IN ('plan','course','ebook','resume','class','consulting','other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_prices (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  amount_minor BIGINT NOT NULL,
  tax_inclusive TINYINT(1) NOT NULL DEFAULT 1, -- 1: the amount already contains tax; 0: tax is added on top
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_prices_product_currency UNIQUE (product_id, currency),
  CONSTRAINT ck_pay_prices_amount CHECK (amount_minor >= 0),
  CONSTRAINT fk_pay_prices_product FOREIGN KEY (product_id) REFERENCES pay_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_tax_rules (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  country CHAR(2) NOT NULL,                   -- ISO 3166-1 alpha-2
  name VARCHAR(40) NOT NULL,                  -- for example GST, VAT
  rate_bp INT NOT NULL,                       -- basis points: 1800 = 18.00 %
  active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT uq_pay_tax_country UNIQUE (country),
  CONSTRAINT ck_pay_tax_rate CHECK (rate_bp BETWEEN 0 AND 10000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_coupons (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  kind VARCHAR(10) NOT NULL,                  -- percent | fixed
  percent_bp INT NULL,                        -- for percent coupons, basis points
  fixed_minor BIGINT NULL,                    -- for fixed coupons
  currency CHAR(3) NULL,                      -- fixed coupons only apply in this currency
  max_redemptions INT NULL,
  per_user_limit INT NOT NULL DEFAULT 1,
  redeemed INT NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  skus VARCHAR(500) NULL,                     -- comma list; NULL = every product
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_coupons_code UNIQUE (code),
  CONSTRAINT ck_pay_coupons_kind CHECK (kind IN ('percent','fixed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_orders (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(40) NOT NULL,             -- ord_ + random; used in URLs and provider metadata
  user_id INT NULL,                           -- NULL for guest checkout
  email VARCHAR(254) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  currency CHAR(3) NOT NULL,
  subtotal_minor BIGINT NOT NULL,             -- sum of unit price x qty, before discount
  discount_minor BIGINT NOT NULL DEFAULT 0,
  tax_minor BIGINT NOT NULL DEFAULT 0,
  total_minor BIGINT NOT NULL,                -- what the customer pays
  tax_inclusive TINYINT(1) NOT NULL DEFAULT 1,
  tax_name VARCHAR(40) NOT NULL DEFAULT '',
  tax_rate_bp INT NOT NULL DEFAULT 0,
  country CHAR(2) NOT NULL,
  billing_name VARCHAR(190) NOT NULL DEFAULT '',
  billing_json LONGTEXT NULL,                 -- address and tax id, as entered
  coupon_code VARCHAR(40) NULL,
  access_token_hash CHAR(64) NOT NULL,        -- sha256 of the opaque token a guest uses to look the order up
  idempotency_key VARCHAR(80) NULL,
  refunded_minor BIGINT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  paid_at DATETIME NULL,
  fulfilled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_orders_public UNIQUE (public_id),
  CONSTRAINT uq_pay_orders_idem UNIQUE (idempotency_key),
  CONSTRAINT ck_pay_orders_status CHECK (status IN ('pending','paid','fulfilled','failed','cancelled','expired','partially_refunded','refunded','disputed')),
  CONSTRAINT ck_pay_orders_amounts CHECK (subtotal_minor >= 0 AND discount_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0 AND refunded_minor >= 0),
  CONSTRAINT fk_pay_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_pay_orders_user ON pay_orders (user_id, created_at);
CREATE INDEX ix_pay_orders_status ON pay_orders (status, created_at);
CREATE INDEX ix_pay_orders_email ON pay_orders (email);

CREATE TABLE IF NOT EXISTS pay_order_items (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  sku VARCHAR(80) NOT NULL,                   -- the next five columns are a snapshot: later edits to the catalogue never change an old order
  kind VARCHAR(20) NOT NULL,
  title VARCHAR(190) NOT NULL,
  fulfil_ref VARCHAR(190) NOT NULL DEFAULT '',
  access_days INT NULL,
  qty SMALLINT NOT NULL DEFAULT 1,
  unit_minor BIGINT NOT NULL,
  discount_minor BIGINT NOT NULL DEFAULT 0,
  tax_minor BIGINT NOT NULL DEFAULT 0,
  total_minor BIGINT NOT NULL,
  CONSTRAINT ck_pay_items_qty CHECK (qty >= 1),
  CONSTRAINT fk_pay_items_order FOREIGN KEY (order_id) REFERENCES pay_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_items_product FOREIGN KEY (product_id) REFERENCES pay_products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_pay_items_order ON pay_order_items (order_id);

CREATE TABLE IF NOT EXISTS pay_payments (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  provider VARCHAR(20) NOT NULL,              -- razorpay | stripe
  provider_session_ref VARCHAR(120) NOT NULL, -- Razorpay order id / Stripe Checkout Session id
  provider_payment_ref VARCHAR(120) NULL,     -- Razorpay payment id / Stripe PaymentIntent id, known once the customer pays
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  refunded_minor BIGINT NOT NULL DEFAULT 0,
  method VARCHAR(40) NULL,                    -- card, upi, netbanking, ... as reported by the provider
  failure_code VARCHAR(80) NULL,
  failure_message VARCHAR(255) NULL,          -- provider text, redacted
  idempotency_key VARCHAR(100) NULL,
  settled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_payments_session UNIQUE (provider, provider_session_ref),
  CONSTRAINT uq_pay_payments_payment UNIQUE (provider, provider_payment_ref),
  CONSTRAINT uq_pay_payments_idem UNIQUE (idempotency_key),
  CONSTRAINT ck_pay_payments_status CHECK (status IN ('created','pending','succeeded','failed','cancelled','expired','partially_refunded','refunded','disputed')),
  CONSTRAINT fk_pay_payments_order FOREIGN KEY (order_id) REFERENCES pay_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_pay_payments_order ON pay_payments (order_id);
CREATE INDEX ix_pay_payments_status ON pay_payments (status, created_at);

CREATE TABLE IF NOT EXISTS pay_webhook_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(20) NOT NULL,
  event_id VARCHAR(120) NOT NULL,             -- the provider's event id: the de-duplication key
  type VARCHAR(80) NOT NULL,
  payload LONGTEXT NOT NULL,                  -- exactly what the provider sent (kept for replay and support; purged by retention)
  status VARCHAR(12) NOT NULL DEFAULT 'received',
  attempts INT NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  CONSTRAINT uq_pay_webhooks_event UNIQUE (provider, event_id),
  CONSTRAINT ck_pay_webhooks_status CHECK (status IN ('received','processing','processed','failed','ignored','dead'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_pay_webhooks_status ON pay_webhook_events (status, received_at);

CREATE TABLE IF NOT EXISTS pay_refunds (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(40) NOT NULL,
  payment_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  provider_refund_ref VARCHAR(120) NULL,
  amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'requested',
  reason VARCHAR(255) NOT NULL DEFAULT '',
  requested_by INT NULL,                      -- staff user id
  idempotency_key VARCHAR(100) NOT NULL,
  failure_message VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_refunds_public UNIQUE (public_id),
  CONSTRAINT uq_pay_refunds_idem UNIQUE (idempotency_key),
  CONSTRAINT uq_pay_refunds_provider UNIQUE (payment_id, provider_refund_ref),
  CONSTRAINT ck_pay_refunds_status CHECK (status IN ('requested','pending','succeeded','failed')),
  CONSTRAINT ck_pay_refunds_amount CHECK (amount_minor > 0),
  CONSTRAINT fk_pay_refunds_payment FOREIGN KEY (payment_id) REFERENCES pay_payments(id),
  CONSTRAINT fk_pay_refunds_order FOREIGN KEY (order_id) REFERENCES pay_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_pay_refunds_order ON pay_refunds (order_id);

CREATE TABLE IF NOT EXISTS pay_disputes (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  provider_dispute_ref VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL,                -- open | under_review | won | lost | closed
  reason VARCHAR(120) NULL,
  amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  respond_by DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_disputes_ref UNIQUE (provider_dispute_ref),
  CONSTRAINT fk_pay_disputes_payment FOREIGN KEY (payment_id) REFERENCES pay_payments(id),
  CONSTRAINT fk_pay_disputes_order FOREIGN KEY (order_id) REFERENCES pay_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_invoices (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(40) NOT NULL,                -- unique, gap-free per series
  series VARCHAR(12) NOT NULL,                -- RCT (receipt), INV (tax invoice), CRN (credit note)
  seq INT NOT NULL,
  order_id BIGINT NOT NULL,
  refund_id BIGINT NOT NULL DEFAULT 0,                -- 0 = the order itself; a refund id for a credit note
  kind VARCHAR(12) NOT NULL,                  -- receipt | tax_invoice | credit_note
  snapshot LONGTEXT NOT NULL,                 -- the document as issued (seller, buyer, lines, totals); never regenerated from live data
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_invoices_number UNIQUE (number),
  CONSTRAINT uq_pay_invoices_series_seq UNIQUE (series, seq),
  CONSTRAINT uq_pay_invoices_order_kind UNIQUE (order_id, kind, refund_id),
  CONSTRAINT fk_pay_invoices_order FOREIGN KEY (order_id) REFERENCES pay_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_invoice_counters (
  series VARCHAR(12) NOT NULL PRIMARY KEY,
  last_seq INT NOT NULL DEFAULT 0              -- the next document number is last_seq + 1; locked row by row so numbers are never skipped or repeated
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_entitlements (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  order_item_id BIGINT NOT NULL,
  user_id INT NULL,                           -- NULL until a guest buyer signs up with the same verified email
  email VARCHAR(254) NOT NULL,
  product_id BIGINT NOT NULL,
  kind VARCHAR(20) NOT NULL,
  ref VARCHAR(190) NOT NULL DEFAULT '',
  status VARCHAR(12) NOT NULL DEFAULT 'active', -- active | revoked | expired
  starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  revoke_reason VARCHAR(120) NULL,
  CONSTRAINT uq_pay_entitlements_item UNIQUE (order_item_id),
  CONSTRAINT ck_pay_entitlements_status CHECK (status IN ('active','revoked','expired')),
  CONSTRAINT fk_pay_entitlements_order FOREIGN KEY (order_id) REFERENCES pay_orders(id),
  CONSTRAINT fk_pay_entitlements_item FOREIGN KEY (order_item_id) REFERENCES pay_order_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_pay_entitlements_user ON pay_entitlements (user_id, status);
CREATE INDEX ix_pay_entitlements_email ON pay_entitlements (email);

CREATE TABLE IF NOT EXISTS pay_coupon_redemptions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  coupon_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  user_id INT NULL,
  email VARCHAR(254) NOT NULL,
  amount_minor BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_redemptions UNIQUE (coupon_id, order_id),
  CONSTRAINT fk_pay_redemptions_coupon FOREIGN KEY (coupon_id) REFERENCES pay_coupons(id),
  CONSTRAINT fk_pay_redemptions_order FOREIGN KEY (order_id) REFERENCES pay_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_audit_head (
  id TINYINT NOT NULL PRIMARY KEY,
  last_hash CHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO pay_audit_head (id, last_hash) VALUES (1, '0000000000000000000000000000000000000000000000000000000000000000');

CREATE TABLE IF NOT EXISTS pay_audit_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actor_type VARCHAR(12) NOT NULL,            -- customer | staff | system | provider
  actor_id VARCHAR(40) NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(20) NOT NULL,                -- order | payment | refund | webhook | price | coupon | reconciliation | export
  entity_id VARCHAR(60) NOT NULL,
  detail LONGTEXT NULL,                       -- JSON, with sensitive values removed
  prev_hash CHAR(64) NOT NULL,
  hash CHAR(64) NOT NULL                      -- sha256(prev_hash + the fields above): editing or deleting a row breaks the chain
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_pay_audit_entity ON pay_audit_events (entity, entity_id);
CREATE INDEX ix_pay_audit_at ON pay_audit_events (at);

CREATE TABLE IF NOT EXISTS pay_idempotency (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  scope VARCHAR(40) NOT NULL,
  idem_key VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response LONGTEXT NULL,
  status_code SMALLINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_pay_idempotency UNIQUE (scope, idem_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_reconciliation_runs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(20) NOT NULL,
  from_at DATETIME NOT NULL,
  to_at DATETIME NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'running',  -- running | ok | mismatches | failed
  checked INT NOT NULL DEFAULT 0,
  mismatches INT NOT NULL DEFAULT 0,
  error VARCHAR(500) NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  started_by VARCHAR(40) NOT NULL DEFAULT 'system'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pay_reconciliation_items (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  run_id BIGINT NOT NULL,
  kind VARCHAR(24) NOT NULL,                  -- missing_internal | missing_provider | amount_mismatch | status_mismatch | stale_pending | refund_mismatch
  provider_ref VARCHAR(120) NULL,
  payment_id BIGINT NULL,
  detail VARCHAR(500) NOT NULL,
  resolved TINYINT(1) NOT NULL DEFAULT 0,
  resolved_by INT NULL,
  resolved_at DATETIME NULL,
  CONSTRAINT fk_pay_recon_items_run FOREIGN KEY (run_id) REFERENCES pay_reconciliation_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_pay_recon_items_run ON pay_reconciliation_items (run_id);

CREATE TABLE IF NOT EXISTS pay_staff (
  user_id INT NOT NULL PRIMARY KEY,
  role VARCHAR(10) NOT NULL,                  -- support | finance | admin
  granted_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_pay_staff_role CHECK (role IN ('support','finance','admin')),
  CONSTRAINT fk_pay_staff_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO pay_currencies (code, minor_units, symbol, enabled) VALUES
  ('INR', 2, '₹', 1), ('USD', 2, '$', 1), ('EUR', 2, '€', 0), ('GBP', 2, '£', 0), ('AED', 2, 'AED', 0), ('AUD', 2, 'A$', 0), ('CAD', 2, 'C$', 0), ('SGD', 2, 'S$', 0);

-- Keep the document counters at or above the highest number already issued (a no-op on a fresh database).
INSERT INTO pay_invoice_counters (series, last_seq) SELECT series, MAX(seq) FROM pay_invoices GROUP BY series ON DUPLICATE KEY UPDATE last_seq = GREATEST(last_seq, VALUES(last_seq));
