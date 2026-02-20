-- db/migrations/005_add_review_columns.sql
-- Adds category_scores, is_flagged to reviews and avg_rating, rating_count to profiles

ALTER TABLE reviews
  ADD COLUMN category_scores JSON NULL AFTER score,
  ADD COLUMN is_flagged TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Auto-flagged by moderation' AFTER category_scores;

ALTER TABLE worker_profiles
  ADD COLUMN avg_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00 COMMENT 'Live recalculated average' AFTER is_verified,
  ADD COLUMN rating_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER avg_rating;

ALTER TABLE customer_profiles
  ADD COLUMN avg_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00 AFTER total_jobs,
  ADD COLUMN rating_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER avg_rating;
