-- Migration: Manual Payout System Tables
-- Run this ONCE against your database.

-- 1. Worker Bank Accounts (IF NOT EXISTS — safe to re-run)
CREATE TABLE IF NOT EXISTS worker_bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  worker_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_holder_name VARCHAR(100) NOT NULL,
  account_number_encrypted VARCHAR(512) NOT NULL,
  ifsc_code VARCHAR(20) NOT NULL,
  bank_name VARCHAR(100),
  is_primary BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Withdrawal Status Enum
DO $$ BEGIN
  CREATE TYPE withdrawal_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Withdrawal Requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY,
  worker_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL,
  bank_account_id BIGINT REFERENCES worker_bank_accounts(id),
  status withdrawal_status_enum DEFAULT 'pending',
  idempotency_key VARCHAR(128) UNIQUE,
  transaction_ref VARCHAR(128),   -- Admin note or RazorpayX Payout ID
  failure_reason TEXT,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wr_worker_status ON withdrawal_requests(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_wr_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_wba_worker ON worker_bank_accounts(worker_id);

-- 5. Add payment_status column to jobs if missing
DO $$ BEGIN
  ALTER TABLE jobs ADD COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
