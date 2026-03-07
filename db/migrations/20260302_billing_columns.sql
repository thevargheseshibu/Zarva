-- ZARVA Billing & Ledger Settlement System — DB Migration
-- Run once against PostgreSQL. All idempotent via IF NOT EXISTS / DO NOTHING patterns.

-- ─── Add paise-native billing columns to jobs ────────────────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS final_labor_paise      BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_material_paise   BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total_paise      BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_mode           VARCHAR(20) DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS job_source             VARCHAR(20) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS bill_preview_expires_at TIMESTAMPTZ NULL;

-- ─── Add per-item dispute fields to job_materials ────────────────────────────
ALTER TABLE job_materials
  ADD COLUMN IF NOT EXISTS status          VARCHAR(20) DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS dispute_reason  TEXT        NULL,
  ADD COLUMN IF NOT EXISTS receipt_s3_key  VARCHAR(512) NULL,
  ADD COLUMN IF NOT EXISTS amount_paise    BIGINT GENERATED ALWAYS AS (ROUND(amount * 100)) STORED,
  ADD COLUMN IF NOT EXISTS verified_at    TIMESTAMPTZ NULL;

-- ─── Index for material dispute queries ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_job_materials_status ON job_materials(job_id, status);

-- ─── Reconciliation alert flag in system_config ───────────────────────────────
INSERT INTO system_config (namespace, key, value, description)
VALUES ('zarva', 'reconciliation.withdrawals_paused', 'false', 'Pause all worker withdrawals when reconciliation fails')
ON CONFLICT (namespace, key) DO NOTHING;

INSERT INTO system_config (namespace, key, value, description)
VALUES ('zarva', 'reconciliation.last_run_at', 'null', 'Timestamp of last successful reconciliation run')
ON CONFLICT (namespace, key) DO NOTHING;

INSERT INTO system_config (namespace, key, value, description)
VALUES ('zarva', 'reconciliation.last_mismatch_details', 'null', 'Details of last reconciliation mismatch if any')
ON CONFLICT (namespace, key) DO NOTHING;
