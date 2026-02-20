-- db/migrations/002_add_fcm_token.sql
-- Adds the fcm_token required for the Matching Engine Haversine wave query

ALTER TABLE users
  ADD COLUMN fcm_token VARCHAR(255) NULL COMMENT 'Firebase Cloud Messaging Device Token' AFTER phone;
