-- Migration: Hourly Billing System Additions

-- 1. Alter jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) DEFAULT 'hourly';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_fee DECIMAL(10,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS travel_charge DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS distance_km DECIMAL(6,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approved_extension_minutes INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS billing_cap_minutes INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS issue_notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_otp_hash VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_started_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_expires_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_started_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_ended_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_billed_minutes INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS exceeded_estimate BOOLEAN DEFAULT FALSE;

-- 2. Create job_timer_events table
CREATE TABLE IF NOT EXISTS job_timer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id BIGINT NOT NULL REFERENCES jobs(id),
  event_type VARCHAR(50) NOT NULL,
  triggered_by VARCHAR(20) NOT NULL,
  server_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  gps_lat DECIMAL(10,8),
  gps_lng DECIMAL(11,8),
  notes TEXT,
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_timer_events_job ON job_timer_events(job_id, server_timestamp ASC);

-- 3. Create job_extensions table
CREATE TABLE IF NOT EXISTS job_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id BIGINT NOT NULL REFERENCES jobs(id),
  requested_at TIMESTAMP DEFAULT NOW(),
  reason TEXT NOT NULL,
  additional_minutes INTEGER NOT NULL,
  photo_url TEXT NOT NULL,
  photo_captured_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  otp_hash VARCHAR(255),
  resolved_at TIMESTAMP
);
