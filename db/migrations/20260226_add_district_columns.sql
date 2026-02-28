-- db/migrations/20260226_add_district_columns.sql
-- Adds district tracking to key entities for better service area resolution

-- 1. Add district to customer_profiles
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- 2. Add district to worker_profiles
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- 3. Add district to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- 4. Add district to unserviceable_requests
ALTER TABLE unserviceable_requests ADD COLUMN IF NOT EXISTS district VARCHAR(100);
