-- ============================================================
--  ZARVA — Production MySQL Schema  (Task 1.2)
--  MySQL 8.0 | utf8mb4 | Asia/Kolkata (+05:30)
--  Run via: node db/migrate.js
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+05:30';
SET foreign_key_checks = 0;

-- ── Database ─────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS zarva
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE zarva;

-- ────────────────────────────────────────────────────────────
--  1. system_config
--     Runtime config overrides (read by ConfigLoader on boot/reload)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  namespace     VARCHAR(64)     NOT NULL COMMENT 'features | zarva | pricing',
  `key`         VARCHAR(128)    NOT NULL COMMENT 'dot-notation, e.g. payment.enabled',
  `value`       TEXT            NOT NULL COMMENT 'JSON-encoded or plain scalar',
  description   VARCHAR(255)        NULL,
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  updated_by    VARCHAR(64)         NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sysconfig_ns_key (namespace, `key`)
) ENGINE=InnoDB COMMENT='Runtime config overrides — wins over JSON files';

-- ────────────────────────────────────────────────────────────
--  2. users
--     Central identity record; both customers & workers have one.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone         VARCHAR(20)     NOT NULL COMMENT 'E.164, e.g. +919876543210',
  role          ENUM('customer','worker','admin') NOT NULL DEFAULT 'customer',
  active_role   ENUM('customer','worker','admin')     NULL DEFAULT NULL,
  is_blocked    TINYINT(1)      NOT NULL DEFAULT 0,
  block_reason  VARCHAR(255)        NULL,
  language_preference VARCHAR(10) NOT NULL DEFAULT 'en',
  last_login_at DATETIME            NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_phone (phone),
  KEY idx_users_role (role),
  KEY idx_users_blocked (is_blocked)
) ENGINE=InnoDB COMMENT='E.164 phone-based identity for all actors';

-- ────────────────────────────────────────────────────────────
--  3. auth_tokens
--     Hashed refresh tokens.  JWT access tokens are stateless (Redis TTL).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_tokens (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  token_hash      VARCHAR(255)    NOT NULL COMMENT 'bcrypt hash of refresh token',
  device_info     VARCHAR(255)        NULL,
  ip_address      VARCHAR(45)         NULL,
  expires_at      DATETIME        NOT NULL,
  revoked_at      DATETIME            NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_authtok_user (user_id),
  KEY idx_authtok_expires (expires_at),
  CONSTRAINT fk_authtok_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Hashed refresh tokens per device';

-- ────────────────────────────────────────────────────────────
--  4. customer_profiles
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id         BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(100)        NULL,
  email           VARCHAR(150)        NULL,
  profile_s3_key  VARCHAR(512)        NULL COMMENT 's3_key, never full URL',
  city            VARCHAR(64)     NOT NULL DEFAULT 'Kochi',
  default_lat     DECIMAL(10,7)       NULL,
  default_lng     DECIMAL(10,7)       NULL,
  total_jobs      INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_custprofile_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
--  5. worker_profiles
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_profiles (
  user_id             BIGINT UNSIGNED NOT NULL,
  name                VARCHAR(100)    NOT NULL,
  profile_s3_key      VARCHAR(512)        NULL,
  category            VARCHAR(64)     NOT NULL COMMENT 'electrician | plumber | …',
  city                VARCHAR(64)     NOT NULL DEFAULT 'Kochi',
  current_lat         DECIMAL(10,7)       NULL,
  current_lng         DECIMAL(10,7)       NULL,
  average_rating      DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  total_jobs          INT UNSIGNED    NOT NULL DEFAULT 0,
  is_verified         TINYINT(1)      NOT NULL DEFAULT 0,
  is_online           TINYINT(1)      NOT NULL DEFAULT 0,
  is_available        TINYINT(1)      NOT NULL DEFAULT 1,
  current_job_id      BIGINT UNSIGNED     NULL COMMENT 'FK set after jobs table',
  kyc_status          ENUM('pending','submitted','approved','rejected') NOT NULL DEFAULT 'pending',
  aadhar_number_last4 VARCHAR(4)          NULL COMMENT 'last 4 digits only — never full Aadhaar',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  -- composite index required by spec
  INDEX idx_worker_dispatch (is_verified, is_online, is_available, current_job_id),
  KEY idx_worker_category (category),
  KEY idx_worker_city (city),
  CONSTRAINT fk_workerprofile_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
--  6. worker_documents
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_documents (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_id       BIGINT UNSIGNED NOT NULL,
  doc_type        ENUM('aadhaar_front','aadhaar_back','pan','selfie','agreement') NOT NULL,
  s3_key          VARCHAR(512)    NOT NULL COMMENT 's3_key only',
  verified        TINYINT(1)      NOT NULL DEFAULT 0,
  verified_at     DATETIME            NULL,
  verified_by     VARCHAR(64)         NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workerdoc_type (worker_id, doc_type),
  CONSTRAINT fk_workerdoc_worker FOREIGN KEY (worker_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
--  7. worker_agreements
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_agreements (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_id       BIGINT UNSIGNED NOT NULL,
  version         VARCHAR(20)     NOT NULL COMMENT 'e.g. v1.0',
  agreed_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address      VARCHAR(45)         NULL,
  device_info     VARCHAR(255)        NULL,
  PRIMARY KEY (id),
  KEY idx_agreement_worker (worker_id),
  CONSTRAINT fk_agreement_worker FOREIGN KEY (worker_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
--  8. jobs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idempotency_key         VARCHAR(64)     NOT NULL COMMENT 'client-generated, prevents duplicates',
  customer_id             BIGINT UNSIGNED NOT NULL,
  worker_id               BIGINT UNSIGNED     NULL,
  category                VARCHAR(64)     NOT NULL,
  status                  ENUM(
    'open',
    'searching',
    'assigned',
    'worker_en_route',
    'worker_arrived',
    'in_progress',
    'pending_completion',
    'completed',
    'cancelled',
    'disputed',
    'no_worker_found'
  ) NOT NULL DEFAULT 'open',
  -- address & geo
  address                 VARCHAR(500)    NOT NULL,
  latitude                DECIMAL(10,7)   NOT NULL,
  longitude               DECIMAL(10,7)   NOT NULL,
  city                    VARCHAR(64)     NOT NULL DEFAULT 'Kochi',
  -- job description
  description             TEXT                NULL,
  scheduled_at            DATETIME            NULL COMMENT 'NULL = immediate',
  -- OTP hashes (bcrypt, NEVER plaintext)
  start_otp_hash          VARCHAR(60)         NULL COMMENT 'bcrypt hash',
  end_otp_hash            VARCHAR(60)         NULL COMMENT 'bcrypt hash',
  -- timing columns
  accepted_at             DATETIME            NULL,
  arrived_at              DATETIME            NULL,
  work_started_at         DATETIME            NULL,
  work_ended_at           DATETIME            NULL,
  dispute_raised_at       DATETIME            NULL,
  auto_escalate_at        DATETIME            NULL COMMENT 'dispute auto-escalate threshold',
  cancellation_locked_at  DATETIME            NULL COMMENT 'after this, customer cannot cancel',
  -- pricing snapshot (rates at time of booking)
  rate_per_hour           DECIMAL(8,2)    NOT NULL,
  advance_amount          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  travel_charge           DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  platform_fee            DECIMAL(10,2)       NULL,
  total_amount            DECIMAL(10,2)       NULL,
  -- cancellation
  cancelled_by            ENUM('customer','worker','system') NULL,
  cancel_reason           VARCHAR(255)        NULL,
  created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_jobs_idempotency (idempotency_key),
  KEY idx_jobs_customer (customer_id),
  KEY idx_jobs_worker (worker_id),
  KEY idx_jobs_status (status),
  KEY idx_jobs_category_status (category, status),
  KEY idx_jobs_city_status (city, status),
  KEY idx_jobs_scheduled (scheduled_at),
  CONSTRAINT fk_jobs_customer FOREIGN KEY (customer_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_jobs_worker FOREIGN KEY (worker_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Core job record';

-- Back-fill FK on worker_profiles.current_job_id now that jobs exists
ALTER TABLE worker_profiles
  ADD CONSTRAINT fk_workerprofile_job
    FOREIGN KEY (current_job_id) REFERENCES jobs (id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
--  9. job_worker_notifications
--     Every worker pinged for a job; UNIQUE(job_id, worker_id)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_worker_notifications (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id          BIGINT UNSIGNED NOT NULL,
  worker_id       BIGINT UNSIGNED NOT NULL,
  status          ENUM('sent','accepted','rejected','timeout','cancelled') NOT NULL DEFAULT 'sent',
  sent_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at    DATETIME            NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_jwn_job_worker (job_id, worker_id),
  KEY idx_jwn_worker (worker_id),
  CONSTRAINT fk_jwn_job FOREIGN KEY (job_id)
    REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT fk_jwn_worker FOREIGN KEY (worker_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Dispatch ping log per job+worker pair';

-- ────────────────────────────────────────────────────────────
--  10. job_invoices
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_invoices (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id          BIGINT UNSIGNED NOT NULL,
  invoice_number  VARCHAR(32)     NOT NULL,
  subtotal        DECIMAL(10,2)   NOT NULL,
  platform_fee    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  travel_charge   DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  discount        DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  tax             DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  total           DECIMAL(10,2)   NOT NULL,
  s3_key          VARCHAR(512)        NULL COMMENT 'PDF stored in S3',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_job (job_id),
  UNIQUE KEY uq_invoice_number (invoice_number),
  CONSTRAINT fk_invoice_job FOREIGN KEY (job_id)
    REFERENCES jobs (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
--  11. payments
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id              BIGINT UNSIGNED NOT NULL,
  customer_id         BIGINT UNSIGNED NOT NULL,
  type                ENUM('advance','final','refund')            NOT NULL,
  method              ENUM('razorpay','cash','wallet','upi')      NOT NULL,
  status              ENUM('pending','captured','failed','refunded') NOT NULL DEFAULT 'pending',
  amount              DECIMAL(10,2)   NOT NULL,
  razorpay_order_id   VARCHAR(128)        NULL,
  razorpay_payment_id VARCHAR(128)        NULL,
  razorpay_signature  VARCHAR(512)        NULL,
  idempotency_key     VARCHAR(128)        NULL,
  meta                JSON                NULL,
  captured_at         DATETIME            NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_razorpay_order  (razorpay_order_id),
  UNIQUE KEY uq_payment_idempotency     (idempotency_key),
  KEY idx_payment_job (job_id),
  KEY idx_payment_customer (customer_id),
  KEY idx_payment_status (status),
  CONSTRAINT fk_payment_job FOREIGN KEY (job_id)
    REFERENCES jobs (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payment_customer FOREIGN KEY (customer_id)
    REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
--  12. refund_queue
--     Async retry queue for Razorpay refund calls.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refund_queue (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id          BIGINT UNSIGNED NOT NULL,
  job_id              BIGINT UNSIGNED NOT NULL,
  amount              DECIMAL(10,2)   NOT NULL,
  attempts            TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts        TINYINT UNSIGNED NOT NULL DEFAULT 5,
  next_attempt_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status              ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  razorpay_refund_id  VARCHAR(128)        NULL,
  last_error          TEXT                NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_refund_status_next (status, next_attempt_at),
  KEY idx_refund_payment (payment_id),
  CONSTRAINT fk_refund_payment FOREIGN KEY (payment_id)
    REFERENCES payments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_refund_job FOREIGN KEY (job_id)
    REFERENCES jobs (id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Async Razorpay refund retry queue';

-- ────────────────────────────────────────────────────────────
--  13. reviews
--     Immutable after insert — NO updated_at by design.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id          BIGINT UNSIGNED NOT NULL,
  reviewer_id     BIGINT UNSIGNED NOT NULL,
  reviewee_id     BIGINT UNSIGNED NOT NULL,
  reviewer_role   ENUM('customer','worker') NOT NULL,
  score           TINYINT UNSIGNED NOT NULL COMMENT '1–5',
  comment         TEXT                NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- NO updated_at — reviews are immutable
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_job_reviewer (job_id, reviewer_id),
  KEY idx_review_reviewee (reviewee_id),
  CONSTRAINT chk_review_score CHECK (score BETWEEN 1 AND 5),
  CONSTRAINT fk_review_job FOREIGN KEY (job_id)
    REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT fk_review_reviewer FOREIGN KEY (reviewer_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_review_reviewee FOREIGN KEY (reviewee_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Immutable — no updated_at';

-- ────────────────────────────────────────────────────────────
--  14. s3_upload_tokens
--     Short-lived pre-signed URL tokens.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS s3_upload_tokens (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  s3_key          VARCHAR(512)    NOT NULL,
  purpose         VARCHAR(64)     NOT NULL COMMENT 'profile_photo | aadhaar_front | …',
  is_used         TINYINT(1)      NOT NULL DEFAULT 0,
  expires_at      DATETIME        NOT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_s3tok_user (user_id),
  KEY idx_s3tok_expires (expires_at),
  CONSTRAINT fk_s3tok_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
--  15. notification_log
--     Persistent delivery record per notification push.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  actor_role      ENUM('customer','worker','admin') NOT NULL,
  type            VARCHAR(64)     NOT NULL COMMENT 'job_matched | payment_done | otp | …',
  channel         ENUM('push','sms','whatsapp','in_app') NOT NULL,
  title           VARCHAR(200)    NOT NULL,
  body            TEXT            NOT NULL,
  data            JSON                NULL,
  status          ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  is_read         TINYINT(1)      NOT NULL DEFAULT 0,
  sent_at         DATETIME            NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user_read (user_id, is_read),
  KEY idx_notif_type (type),
  KEY idx_notif_status (status),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
--  16. worker_location_history
--     Append-only GPS trail (current location also cached in Redis).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_location_history (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_id   BIGINT UNSIGNED NOT NULL,
  job_id      BIGINT UNSIGNED     NULL COMMENT 'NULL = idle ping',
  latitude    DECIMAL(10,7)   NOT NULL,
  longitude   DECIMAL(10,7)   NOT NULL,
  accuracy    FLOAT               NULL COMMENT 'metres',
  recorded_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wloc_worker_time (worker_id, recorded_at),
  KEY idx_wloc_job (job_id),
  CONSTRAINT fk_wloc_worker FOREIGN KEY (worker_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_wloc_job FOREIGN KEY (job_id)
    REFERENCES jobs (id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Append-only GPS trail';

SET foreign_key_checks = 1;

-- ============================================================
--  TABLE SUMMARY (16 tables)
--  1.  system_config
--  2.  users
--  3.  auth_tokens
--  4.  customer_profiles
--  5.  worker_profiles
--  6.  worker_documents
--  7.  worker_agreements
--  8.  jobs
--  9.  job_worker_notifications
--  10. job_invoices
--  11. payments
--  12. refund_queue
--  13. reviews
--  14. s3_upload_tokens
--  15. notification_log
--  16. worker_location_history
-- ============================================================
