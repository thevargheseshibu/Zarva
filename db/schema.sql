-- Ensure clean slate for full rebuild migration
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Ensure PostGIS is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Set timezone
SET TIME ZONE 'Asia/Kolkata';

-- ────────────────────────────────────────────────────────────
--  1. system_config
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  id            SERIAL PRIMARY KEY,
  namespace     VARCHAR(64)     NOT NULL, -- 'features | zarva | pricing'
  "key"         VARCHAR(128)    NOT NULL, -- 'dot-notation, e.g. payment.enabled'
  "value"       TEXT            NOT NULL, -- JSON-encoded or plain scalar
  description   VARCHAR(255)        NULL,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
  updated_by    VARCHAR(64)         NULL,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (namespace, "key")
);

-- ────────────────────────────────────────────────────────────
--  2. users
-- ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS user_role_enum CASCADE;
CREATE TYPE user_role_enum AS ENUM ('customer', 'worker', 'admin');

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  phone         VARCHAR(20)     NOT NULL UNIQUE, -- E.164
  role          user_role_enum  NOT NULL DEFAULT 'customer',
  active_role   user_role_enum      NULL DEFAULT NULL,
  is_blocked    BOOLEAN         NOT NULL DEFAULT FALSE,
  block_reason  VARCHAR(255)        NULL,
  language_preference VARCHAR(10) NOT NULL DEFAULT 'en',
  fcm_token     VARCHAR(255)        NULL,
  last_login_at TIMESTAMPTZ            NULL,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_blocked ON users(is_blocked);

-- ────────────────────────────────────────────────────────────
--  3. auth_tokens
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_tokens (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255)    NOT NULL,
  device_info     VARCHAR(255)        NULL,
  ip_address      VARCHAR(45)         NULL,
  expires_at      TIMESTAMPTZ        NOT NULL,
  revoked_at      TIMESTAMPTZ            NULL,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_authtok_user ON auth_tokens(user_id);
CREATE INDEX idx_authtok_expires ON auth_tokens(expires_at);

-- ────────────────────────────────────────────────────────────
--  4. customer_profiles
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id         BIGINT          PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(100)        NULL,
  email           VARCHAR(150)        NULL,
  profile_s3_key  VARCHAR(512)        NULL,
  city            VARCHAR(64)     NOT NULL DEFAULT 'Kochi',
  default_lat     NUMERIC(10,7)       NULL,
  default_lng     NUMERIC(10,7)       NULL,
  total_jobs      INT             NOT NULL DEFAULT 0,
  average_rating  NUMERIC(3,2)    NOT NULL DEFAULT 5.00,
  rating_count    INT             NOT NULL DEFAULT 0,
  cancelled_jobs  INT             NOT NULL DEFAULT 0,
  saved_addresses JSONB           NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
--  5. worker_profiles
-- ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS kyc_status_enum CASCADE;
CREATE TYPE kyc_status_enum AS ENUM ('draft', 'documents_pending', 'pending_review', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS worker_profiles (
  user_id             BIGINT          PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name                VARCHAR(100)    NOT NULL,
  profile_s3_key      VARCHAR(512)        NULL,
  category            VARCHAR(64)     NOT NULL,
  city                VARCHAR(64)     NOT NULL DEFAULT 'Kochi',
  home_address        JSONB               NULL,
  home_location       GEOGRAPHY(Point, 4326) NULL, -- REPLACES home_lat / home_lng
  home_pincode        VARCHAR(10)         NULL,
  current_location    GEOGRAPHY(Point, 4326) NULL, -- REPLACES current_lat / current_lng
  last_location_lat   NUMERIC(10,7)       NULL, -- Retained for legacy UI checks briefly if needed
  last_location_lng   NUMERIC(10,7)       NULL,
  average_rating      NUMERIC(3,2)    NOT NULL DEFAULT 0.00,
  total_jobs          INT             NOT NULL DEFAULT 0,
  rating_count        INT             NOT NULL DEFAULT 0,
  is_verified         BOOLEAN         NOT NULL DEFAULT FALSE,
  is_online           BOOLEAN         NOT NULL DEFAULT FALSE,
  is_available        BOOLEAN         NOT NULL DEFAULT TRUE,
  current_job_id      BIGINT              NULL,
  
  -- Service area definition
  service_center      GEOGRAPHY(Point, 4326) NULL,
  service_radius_km   NUMERIC(5,2)    NOT NULL DEFAULT 5.00,
  service_area        GEOGRAPHY(Polygon, 4326) NULL,
  location_updated_at TIMESTAMPTZ        NULL,
  service_types       TEXT[]              NOT NULL DEFAULT '{}',
  kyc_status          kyc_status_enum NOT NULL DEFAULT 'draft',
  gender              VARCHAR(20)         NULL,
  experience_years    NUMERIC(4,1)        NULL,
  service_range       INT                 NOT NULL DEFAULT 20,
  skills              JSONB               NOT NULL DEFAULT '[]',
  aadhar_number_last4 VARCHAR(4)          NULL,
  worker_cancel_penalty INT             NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_worker_category ON worker_profiles(category);
CREATE INDEX idx_worker_city ON worker_profiles(city);
CREATE INDEX idx_worker_current_location ON worker_profiles USING GIST (current_location);
CREATE INDEX idx_worker_service_area ON worker_profiles USING GIST(service_area);
CREATE INDEX idx_worker_service_center ON worker_profiles USING GIST(service_center);

-- Trigger to auto-generate service_area polygon when radius changes
CREATE OR REPLACE FUNCTION update_service_area()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.service_center IS NOT NULL THEN
    NEW.service_area = ST_Buffer(
      NEW.service_center::geography,
      NEW.service_radius_km * 1000  -- Convert km to meters
    )::geography;
  ELSE
    NEW.service_area = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER worker_service_area_trigger
BEFORE INSERT OR UPDATE OF service_center, service_radius_km
ON worker_profiles
FOR EACH ROW
EXECUTE FUNCTION update_service_area();

-- ────────────────────────────────────────────────────────────
--  6. worker_documents
-- ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS doc_type_enum CASCADE;
CREATE TYPE doc_type_enum AS ENUM ('aadhaar_front','aadhaar_back','pan','selfie','agreement');

CREATE TABLE IF NOT EXISTS worker_documents (
  id              BIGSERIAL PRIMARY KEY,
  worker_id       BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type        doc_type_enum   NOT NULL,
  s3_key          VARCHAR(512)    NOT NULL,
  verified        BOOLEAN         NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ            NULL,
  verified_by     VARCHAR(64)         NULL,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (worker_id, doc_type)
);

-- ────────────────────────────────────────────────────────────
--  7. worker_agreements
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_agreements (
  id              BIGSERIAL PRIMARY KEY,
  worker_id       BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version         VARCHAR(20)     NOT NULL,
  agreed_at       TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address      VARCHAR(45)         NULL,
  device_info     VARCHAR(255)        NULL
);

CREATE INDEX idx_agreement_worker ON worker_agreements(worker_id);

-- ────────────────────────────────────────────────────────────
--  8. jobs
-- ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS job_status_enum CASCADE;
CREATE TYPE job_status_enum AS ENUM (
  'open', 'searching', 'assigned', 'worker_en_route',
  'worker_arrived', 'in_progress', 'pending_completion',
  'completed', 'cancelled', 'disputed', 'no_worker_found'
);

DROP TYPE IF EXISTS cancel_actor_enum CASCADE;
CREATE TYPE cancel_actor_enum AS ENUM ('customer', 'worker', 'system');

CREATE TABLE IF NOT EXISTS jobs (
  id                      BIGSERIAL PRIMARY KEY,
  idempotency_key         VARCHAR(64)     NOT NULL UNIQUE,
  customer_id             BIGINT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  worker_id               BIGINT              NULL REFERENCES users(id) ON DELETE SET NULL,
  category                VARCHAR(64)     NOT NULL,
  status                  job_status_enum NOT NULL DEFAULT 'open',
  
  -- LOCATION INFRASTRUCTURE WITH PostGIS & FALLBACK
  address                 VARCHAR(500)    NOT NULL,
  customer_address_detail JSONB               NULL,
  job_location            GEOGRAPHY(Point, 4326) NOT NULL, -- Core spatial column
  location_source         VARCHAR(20)         NULL, -- 'gps', 'pincode_geocoded', 'manual'
  location_accuracy_meters NUMERIC(10,2)      NULL, 
  latitude                NUMERIC(10,7)       NULL, -- Mirror fields for backwards app compatibility
  longitude               NUMERIC(10,7)       NULL, -- Mirror fields for backwards app compatibility
  
  pincode                 VARCHAR(10)     NOT NULL,
  city                    VARCHAR(64)     NOT NULL DEFAULT 'Kochi',
  
  description             TEXT                NULL,
  scheduled_at            TIMESTAMPTZ            NULL,
  start_otp_hash          VARCHAR(60)         NULL,
  end_otp_hash            VARCHAR(60)         NULL,
  
  accepted_at             TIMESTAMPTZ            NULL,
  arrived_at              TIMESTAMPTZ            NULL,
  work_started_at         TIMESTAMPTZ            NULL,
  work_ended_at           TIMESTAMPTZ            NULL,
  dispute_raised_at       TIMESTAMPTZ            NULL,
  dispute_reason          TEXT                NULL,
  auto_escalate_at        TIMESTAMPTZ            NULL,
  cancellation_locked_at  TIMESTAMPTZ            NULL,
  
  rate_per_hour           NUMERIC(8,2)    NOT NULL,
  advance_amount          NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  travel_charge           NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  platform_fee            NUMERIC(10,2)       NULL,
  total_amount            NUMERIC(10,2)       NULL,
  
  chat_enabled            BOOLEAN         NOT NULL DEFAULT FALSE,
  escalated               BOOLEAN         NOT NULL DEFAULT FALSE,
  start_otp_attempts      INT             NOT NULL DEFAULT 0,
  end_otp_attempts        INT             NOT NULL DEFAULT 0,
  actual_hours            NUMERIC(5,2)        NULL,
  
  cancelled_by            cancel_actor_enum   NULL,
  cancel_reason           VARCHAR(255)        NULL,
  created_at              TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_jobs_worker ON jobs(worker_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_category_status ON jobs(category, status);
CREATE INDEX idx_jobs_city_status ON jobs(city, status);
CREATE INDEX idx_jobs_location ON jobs USING GIST (job_location);

-- Add cyclic FK constraint to worker_profiles now that jobs exist
ALTER TABLE worker_profiles
  ADD CONSTRAINT fk_workerprofile_job FOREIGN KEY (current_job_id) REFERENCES jobs(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
--  9. job_worker_notifications
-- ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS notif_status_enum CASCADE;
CREATE TYPE notif_status_enum AS ENUM ('sent', 'accepted', 'rejected', 'timeout', 'cancelled');

CREATE TABLE IF NOT EXISTS job_worker_notifications (
  id              BIGSERIAL PRIMARY KEY,
  job_id          BIGINT          NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id       BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          notif_status_enum NOT NULL DEFAULT 'sent',
  sent_at         TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at    TIMESTAMPTZ            NULL,
  distance_km     NUMERIC(10,2)          NULL,
  UNIQUE (job_id, worker_id)
);

CREATE INDEX idx_jwn_worker ON job_worker_notifications(worker_id);

-- ────────────────────────────────────────────────────────────
--  10. job_invoices
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_invoices (
  id              BIGSERIAL PRIMARY KEY,
  job_id          BIGINT          NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  invoice_number  VARCHAR(32)     NOT NULL UNIQUE,
  subtotal        NUMERIC(10,2)   NOT NULL,
  platform_fee    NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  travel_charge   NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  discount        NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  tax             NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  total           NUMERIC(10,2)   NOT NULL,
  s3_key          VARCHAR(512)        NULL,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
--  11. payments
-- ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS payment_type_enum CASCADE;
CREATE TYPE payment_type_enum AS ENUM ('advance', 'final', 'refund');
DROP TYPE IF EXISTS payment_method_enum CASCADE;
CREATE TYPE payment_method_enum AS ENUM ('razorpay', 'cash', 'wallet', 'upi');
DROP TYPE IF EXISTS payment_status_enum CASCADE;
CREATE TYPE payment_status_enum AS ENUM ('pending', 'captured', 'failed', 'refunded');

CREATE TABLE IF NOT EXISTS payments (
  id                  BIGSERIAL PRIMARY KEY,
  job_id              BIGINT          NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  customer_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type                payment_type_enum       NOT NULL,
  method              payment_method_enum     NOT NULL,
  status              payment_status_enum     NOT NULL DEFAULT 'pending',
  amount              NUMERIC(10,2)   NOT NULL,
  razorpay_order_id   VARCHAR(128)        NULL UNIQUE,
  razorpay_payment_id VARCHAR(128)        NULL,
  razorpay_signature  VARCHAR(512)        NULL,
  idempotency_key     VARCHAR(128)        NULL UNIQUE,
  meta                JSONB               NULL,
  captured_at         TIMESTAMPTZ            NULL,
  created_at          TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_job ON payments(job_id);
CREATE INDEX idx_payment_status ON payments(status);

-- ────────────────────────────────────────────────────────────
--  12. refund_queue
-- ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS refund_status_enum CASCADE;
CREATE TYPE refund_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS refund_queue (
  id                  BIGSERIAL PRIMARY KEY,
  payment_id          BIGINT          NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  job_id              BIGINT          NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  amount              NUMERIC(10,2)   NOT NULL,
  attempts            SMALLINT        NOT NULL DEFAULT 0,
  max_attempts        SMALLINT        NOT NULL DEFAULT 5,
  next_attempt_at     TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status              refund_status_enum NOT NULL DEFAULT 'pending',
  razorpay_refund_id  VARCHAR(128)        NULL,
  last_error          TEXT                NULL,
  created_at          TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refund_status_next ON refund_queue(status, next_attempt_at);

-- ────────────────────────────────────────────────────────────
--  13. reviews
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              BIGSERIAL PRIMARY KEY,
  job_id          BIGINT          NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reviewer_id     BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id     BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_role   user_role_enum  NOT NULL,
  score           SMALLINT        NOT NULL CHECK (score BETWEEN 1 AND 5),
  category_scores JSONB           NOT NULL DEFAULT '{}',
  comment         TEXT                NULL,
  is_flagged      BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (job_id, reviewer_id)
);

CREATE INDEX idx_review_reviewee ON reviews(reviewee_id);

-- ────────────────────────────────────────────────────────────
--  14. s3_upload_tokens
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS s3_upload_tokens (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  s3_key          VARCHAR(512)    NOT NULL,
  purpose         VARCHAR(64)     NOT NULL,
  is_used         BOOLEAN         NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ        NOT NULL,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_s3tok_user ON s3_upload_tokens(user_id);
CREATE INDEX idx_s3tok_expires ON s3_upload_tokens(expires_at);

-- ────────────────────────────────────────────────────────────
--  15. notification_log
-- ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS notif_channel_enum CASCADE;
CREATE TYPE notif_channel_enum AS ENUM ('push', 'sms', 'whatsapp', 'in_app');
DROP TYPE IF EXISTS notif_log_status_enum CASCADE;
CREATE TYPE notif_log_status_enum AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE IF NOT EXISTS notification_log (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_role      user_role_enum  NOT NULL,
  type            VARCHAR(64)     NOT NULL,
  channel         notif_channel_enum NOT NULL,
  title           VARCHAR(200)    NOT NULL,
  body            TEXT            NOT NULL,
  data            JSONB               NULL,
  status          notif_log_status_enum NOT NULL DEFAULT 'pending',
  is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
  sent_at         TIMESTAMPTZ            NULL,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notif_user_read ON notification_log(user_id, is_read);
CREATE INDEX idx_notif_type ON notification_log(type);

-- ────────────────────────────────────────────────────────────
--  16. worker_location_history
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_location_history (
  id          BIGSERIAL PRIMARY KEY,
  worker_id   BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      BIGINT              NULL REFERENCES jobs(id) ON DELETE SET NULL,
  latitude    NUMERIC(10,7)   NOT NULL,
  longitude   NUMERIC(10,7)   NOT NULL,
  location    GEOGRAPHY(Point, 4326) NULL, -- PostGIS Fallback
  accuracy    REAL                NULL,
  recorded_at TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wloc_worker_time ON worker_location_history(worker_id, recorded_at);
CREATE INDEX idx_wloc_job ON worker_location_history(job_id);

-- ────────────────────────────────────────────────────────────
--  17. unserviceable_requests (Analytics)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unserviceable_requests (
  id                          BIGSERIAL PRIMARY KEY,
  location                    GEOGRAPHY(Point, 4326) NOT NULL,
  service_type                VARCHAR(64)         NULL,
  nearest_worker_distance_km  NUMERIC(10,2)       NULL,
  requested_at                TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_unserviceable_loc ON unserviceable_requests USING GIST(location);
CREATE INDEX idx_unserviceable_time ON unserviceable_requests(requested_at);

-- ────────────────────────────────────────────────────────────
--  18. active_worker_coverage (Materialized View)
-- ────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS active_worker_coverage AS
SELECT 
  user_id as worker_profile_id,
  user_id,
  service_center,
  service_area,
  service_radius_km,
  service_types,
  city,
  is_available
FROM worker_profiles
WHERE is_online = true AND kyc_status = 'approved';

CREATE INDEX idx_active_coverage_area ON active_worker_coverage USING GIST(service_area);
CREATE UNIQUE INDEX idx_active_coverage_uid ON active_worker_coverage(user_id);

-- ────────────────────────────────────────────────────────────
--  19. support_tickets
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by_user_id BIGINT NOT NULL REFERENCES users(id),
  raised_by_role VARCHAR(20) NOT NULL,
  ticket_type VARCHAR(30) NOT NULL,
  job_id BIGINT REFERENCES jobs(id),
  dispute_category VARCHAR(100),
  is_formal_dispute BOOLEAN DEFAULT FALSE,
  status VARCHAR(30) DEFAULT 'open',
  affects_job_completion BOOLEAN DEFAULT FALSE,
  resolved_by BIGINT REFERENCES users(id),
  resolution_type VARCHAR(50),
  resolution_notes TEXT,
  resolution_amount DECIMAL(10, 2),
  priority VARCHAR(20) DEFAULT 'medium',
  ticket_number VARCHAR(30) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_tickets_user ON support_tickets(raised_by_user_id, status);
CREATE INDEX idx_tickets_job ON support_tickets(job_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_type ON support_tickets(ticket_type);

-- ────────────────────────────────────────────────────────────
--  20. ticket_messages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id BIGINT REFERENCES users(id),
  sender_role VARCHAR(20) NOT NULL,
  message_text TEXT,
  attachment_urls TEXT[],
  attachment_types VARCHAR(20)[],
  message_type VARCHAR(20) DEFAULT 'text',
  read_by_admin BOOLEAN DEFAULT FALSE,
  read_by_user BOOLEAN DEFAULT FALSE,
  is_internal_note BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at ASC);

-- ────────────────────────────────────────────────────────────
--  21. Job Concurrency Tracking & dispute additions to jobs
-- ────────────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN dispute_status VARCHAR(30) DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN active_ticket_id UUID REFERENCES support_tickets(id);

CREATE TABLE IF NOT EXISTS user_job_slots (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  active_job_count INTEGER DEFAULT 0,
  disputed_job_count INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  22. dispute_categories
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispute_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key VARCHAR(100) UNIQUE NOT NULL,
  category_name VARCHAR(200) NOT NULL,
  who_can_raise VARCHAR(20) NOT NULL,
  priority_default VARCHAR(20) DEFAULT 'medium',
  sla_hours INTEGER DEFAULT 24,
  active BOOLEAN DEFAULT TRUE
);

-- End of Postgre Schema
