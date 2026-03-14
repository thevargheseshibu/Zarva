-- db/migrations/20260314_full_schema_sync.sql
-- Comprehensive schema sync migration to resolve all column/enum mismatches
-- Safe to re-run (IF NOT EXISTS / DO NOTHING guards)

-- ISSUE 1: Add missing lifecycle timestamp columns to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_otp_verified_at  TIMESTAMPTZ NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_otp_verified_at    TIMESTAMPTZ NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_ended_at    TIMESTAMPTZ NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS open_message_at        TIMESTAMPTZ NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_started_at         TIMESTAMPTZ NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_ended_at           TIMESTAMPTZ NULL;

-- ISSUE 2: inspection_required was already added by previous migration,
-- this is just a guard in case it wasn't
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_required    BOOLEAN DEFAULT FALSE;

-- ISSUE 3: Ensure job_status_enum has 'created' (legacy value used in older INSERT)
-- We won't add it -- instead we fix the INSERT to use 'open' (see routes/jobs.js fix)
-- 'created' will NOT be added to the enum since 'open' is the correct initial state

-- ISSUE 4: Fix experience_years column type (currently varchar, should be numeric)
-- Safe alter using explicit cast
ALTER TABLE worker_profiles
  ALTER COLUMN experience_years TYPE NUMERIC(4,1)
    USING CASE WHEN experience_years ~ '^[0-9]+(\.[0-9]+)?$' THEN experience_years::NUMERIC(4,1) ELSE NULL END;

-- ISSUE 5: Add missing enum statuses referenced in route code
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'pause_requested';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'work_paused';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'resume_requested';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'suspend_requested';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'customer_stopping';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'inspection_extension_requested';

-- All done
