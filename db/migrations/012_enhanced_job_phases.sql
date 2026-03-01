-- =============================================================================
-- Migration 012: Enhanced Job Phases
-- Inspection extensions, work pause/resume/suspend, stop-early, materials, bill preview
-- ALL columns are nullable with safe defaults — zero breaking changes
-- =============================================================================

-- ── INSPECTION EXTENSIONS ─────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_extension_count    INTEGER      DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_extended_until     TIMESTAMPTZ  NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_extension_otp_hash TEXT         NULL;

-- ── WORK PAUSE / RESUME ───────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pause_count              INTEGER      DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paused_at                TIMESTAMPTZ  NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pause_reason             TEXT         NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_paused_seconds     INTEGER      DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pause_otp_hash           TEXT         NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS resume_otp_hash          TEXT         NULL;

-- ── SUSPENSION / RESCHEDULE ───────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suspended_at             TIMESTAMPTZ  NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suspend_reason           TEXT         NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suspend_reschedule_at    TIMESTAMPTZ  NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suspend_otp_hash         TEXT         NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS followup_job_id          UUID         NULL;

-- ── CUSTOMER STOP-EARLY ───────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_stopped_at      TIMESTAMPTZ  NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS safe_stop_window_ends_at TIMESTAMPTZ  NULL;

-- ── ESTIMATE REJECT ───────────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimate_rejected_at     TIMESTAMPTZ  NULL;

-- ── MATERIALS ─────────────────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_declared       BOOLEAN      DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_cost           NUMERIC(10,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS job_materials (
    id          SERIAL       PRIMARY KEY,
    job_id      UUID         NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    name        TEXT         NOT NULL,
    amount      NUMERIC(10,2) NOT NULL,
    receipt_url TEXT         NULL,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_materials_job_id ON job_materials(job_id);

-- ── BILL PREVIEW WINDOW ───────────────────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bill_preview_expires_at  TIMESTAMPTZ  NULL;
