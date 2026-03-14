-- db/migrations/20260313_add_inspection_required.sql
-- Adds the missing inspection_required column to the jobs table
-- which was causing 500 errors during new job dispatch.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_required BOOLEAN DEFAULT FALSE;
