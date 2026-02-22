-- db/migrations/008_add_subscription_status.sql
-- Adds subscription tier tracking to worker_profiles

ALTER TABLE worker_profiles
  ADD COLUMN subscription_status ENUM('free', 'basic', 'pro') NOT NULL DEFAULT 'free' AFTER kyc_status;
