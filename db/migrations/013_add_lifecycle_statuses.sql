-- Migration 013: Add missing job_status_enum values for enhanced lifecycle
-- pause_requested, work_paused, resume_requested, suspend_requested,
-- customer_stopping, inspection_extension_requested

ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'pause_requested';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'work_paused';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'resume_requested';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'suspend_requested';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'customer_stopping';
ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'inspection_extension_requested';
