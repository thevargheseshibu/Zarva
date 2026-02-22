-- db/migrations/009_add_customer_profile_columns.sql
-- Adds missing tracking columns to customer_profiles

ALTER TABLE customer_profiles
  ADD COLUMN cancelled_jobs INT UNSIGNED NOT NULL DEFAULT 0 AFTER avg_rating,
  ADD COLUMN saved_addresses JSON NULL AFTER cancelled_jobs;
