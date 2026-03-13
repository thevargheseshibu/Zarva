-- Add missing location columns to customer_profiles table
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS home_address VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS home_location GEOGRAPHY(Point, 4326) NULL,
  ADD COLUMN IF NOT EXISTS current_location GEOGRAPHY(Point, 4326) NULL,
  ADD COLUMN IF NOT EXISTS home_pincode VARCHAR(10) NULL;