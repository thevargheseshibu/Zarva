-- db/migrations/006_add_worker_location_columns.sql
-- Adds last-known location tracking columns to worker_profiles

ALTER TABLE worker_profiles
  ADD COLUMN last_location_lat DECIMAL(10,7) NULL COMMENT 'Last GPS latitude' AFTER current_lng,
  ADD COLUMN last_location_lng DECIMAL(10,7) NULL COMMENT 'Last GPS longitude' AFTER last_location_lat,
  ADD COLUMN last_location_at  DATETIME      NULL COMMENT 'Timestamp of last location ping' AFTER last_location_lng;
