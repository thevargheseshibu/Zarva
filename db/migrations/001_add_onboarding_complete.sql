-- Migration 001: Add onboarding_complete to users table
-- Run this ONCE against your live PostgreSQL database.
-- Safe to re-run (uses IF NOT EXISTS).

-- 1. Add the column (safe to run even if it already exists)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill: mark workers who have already signed the agreement as complete
UPDATE users u
SET onboarding_complete = TRUE
WHERE EXISTS (
  SELECT 1 FROM worker_agreements wa WHERE wa.worker_id = u.id
);

-- 3. Verify
SELECT 
  COUNT(*) FILTER (WHERE onboarding_complete = true) as completed,
  COUNT(*) FILTER (WHERE onboarding_complete = false) as pending,
  COUNT(*) as total
FROM users
WHERE active_role = 'worker';
