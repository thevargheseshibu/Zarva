-- db/migrations/011_add_inspection_otp_columns.sql
-- Adds inspection OTP hash + expiry columns to jobs table
-- Safe to run multiple times (IF NOT EXISTS guards)

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS inspection_otp_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS inspection_expires_at TIMESTAMPTZ NULL;

-- Also ensure start_otp_hash & end_otp_hash exist (in case earlier migrations failed on PG)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS start_otp_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS start_otp_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS end_otp_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS end_otp_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS end_otp_verified_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(6,2) NULL;
