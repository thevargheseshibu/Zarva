-- db/migrations/007_add_user_fcm_language.sql
-- Adds FCM push token and preferred language to users table

ALTER TABLE users
  ADD COLUMN fcm_token VARCHAR(512) NULL    COMMENT 'Firebase Cloud Messaging device token' AFTER updated_at,
  ADD COLUMN language  ENUM('en','ml') NOT NULL DEFAULT 'en' COMMENT 'Preferred notification language' AFTER fcm_token;
