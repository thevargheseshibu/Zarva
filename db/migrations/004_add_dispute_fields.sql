-- db/migrations/004_add_dispute_fields.sql
-- Adds dispute escalation and penalty tracking to the database

ALTER TABLE jobs
  ADD COLUMN escalated BOOLEAN NOT NULL DEFAULT 0 AFTER dispute_raised_at,
  ADD COLUMN dispute_reason TEXT NULL AFTER escalated;

ALTER TABLE worker_profiles
  ADD COLUMN worker_cancel_penalty TINYINT(1) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Tracks abusive worker post-lock cancels' AFTER current_lat;
