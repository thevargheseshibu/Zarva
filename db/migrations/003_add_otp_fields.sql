-- db/migrations/003_add_otp_fields.sql
-- Adds temporal tracking and attempt limiters for Physical OTPs

ALTER TABLE jobs
  ADD COLUMN start_otp_generated_at DATETIME NULL AFTER start_otp_hash,
  ADD COLUMN start_otp_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER start_otp_generated_at,
  ADD COLUMN end_otp_generated_at DATETIME NULL AFTER end_otp_hash,
  ADD COLUMN end_otp_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER end_otp_generated_at,
  ADD COLUMN end_otp_verified_at DATETIME NULL AFTER end_otp_attempts,
  ADD COLUMN actual_hours DECIMAL(6,2) NULL COMMENT 'Computed diff of end-start time' AFTER updated_at,
  ADD COLUMN otp_bypass_reason VARCHAR(255) NULL COMMENT 'If start_otp_enabled is false' AFTER actual_hours;
