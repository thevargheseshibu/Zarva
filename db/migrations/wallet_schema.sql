-- ZARVA Server-Side Wallet & Ledger System
-- Run this migration ONCE against your PostgreSQL database.
-- Compatible with existing users (BIGINT) and jobs (BIGINT) tables.

-- ────────────────────────────────────────────────────────────
-- Internal accounts (one row per account type, system-wide)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code VARCHAR(50) UNIQUE NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  normal_balance VARCHAR(10) NOT NULL,
  is_system_account BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed ledger accounts
INSERT INTO ledger_accounts (account_code, account_name, account_type, normal_balance) VALUES
('CUSTOMER_PAYABLE',      'Customer Payables',        'asset',     'debit'),
('WORKER_EARNINGS',       'Worker Earnings Payable',  'liability', 'credit'),
('PLATFORM_REVENUE',      'Platform Commission',      'revenue',   'credit'),
('ESCROW',                'Job Escrow',               'escrow',    'credit'),
('PAYMENT_GATEWAY_FEES',  'Gateway Fees Payable',     'liability', 'credit'),
('GST_COLLECTED',         'GST Payable',              'liability', 'credit'),
('BANK_INFLOW',           'Bank Receipts',            'asset',     'debit'),
('BANK_OUTFLOW',          'Bank Disbursements',       'asset',     'credit')
ON CONFLICT (account_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- User wallet accounts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id),
  account_code VARCHAR(50) NOT NULL,
  currency VARCHAR(5) DEFAULT 'INR',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_user ON user_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_code ON user_accounts(account_code);

-- ────────────────────────────────────────────────────────────
-- Immutable ledger (core of the system)
-- NEVER UPDATE OR DELETE ROWS — corrections = reversal entries
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  entry_sequence INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  user_account_id UUID REFERENCES user_accounts(id),
  entry_type VARCHAR(10) NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  event_type VARCHAR(50) NOT NULL,
  job_id BIGINT REFERENCES jobs(id),
  payment_id BIGINT,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by_user_id BIGINT REFERENCES users(id),
  triggered_by_system BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_account ON ledger_entries(user_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_job ON ledger_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_event ON ledger_entries(event_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_posted ON ledger_entries(posted_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotency ON ledger_entries(idempotency_key);

-- ────────────────────────────────────────────────────────────
-- Materialized balance cache (read optimization, ledger is truth)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_balance_cache (
  user_account_id UUID PRIMARY KEY REFERENCES user_accounts(id),
  balance_paise BIGINT NOT NULL DEFAULT 0,
  pending_paise BIGINT NOT NULL DEFAULT 0,
  available_paise BIGINT NOT NULL DEFAULT 0,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_entry_id UUID REFERENCES ledger_entries(id)
);

-- ────────────────────────────────────────────────────────────
-- Customer pending dues
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_pending_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id BIGINT NOT NULL REFERENCES users(id),
  job_id BIGINT NOT NULL REFERENCES jobs(id) UNIQUE,
  amount_paise BIGINT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customer_pending_dues_customer ON customer_pending_dues(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_pending_dues_status ON customer_pending_dues(status);

-- ────────────────────────────────────────────────────────────
-- Withdrawal requests
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id BIGINT NOT NULL REFERENCES users(id),
  amount_paise BIGINT NOT NULL,
  bank_account_id UUID NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  gateway_reference VARCHAR(255),
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_worker ON withdrawal_requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status);

-- ────────────────────────────────────────────────────────────
-- Worker bank accounts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id BIGINT NOT NULL REFERENCES users(id),
  account_holder_name VARCHAR(200) NOT NULL,
  account_number_encrypted TEXT NOT NULL,
  ifsc_code VARCHAR(20) NOT NULL,
  bank_name VARCHAR(100),
  is_verified BOOLEAN DEFAULT FALSE,
  is_primary BOOLEAN DEFAULT FALSE,
  verification_reference VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_bank_accounts_worker ON worker_bank_accounts(worker_id);

-- ────────────────────────────────────────────────────────────
-- Wallet audit log
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  actor_user_id BIGINT REFERENCES users(id),
  actor_type VARCHAR(20),
  affected_user_id BIGINT REFERENCES users(id),
  job_id BIGINT REFERENCES jobs(id),
  amount_paise BIGINT,
  before_balance_paise BIGINT,
  after_balance_paise BIGINT,
  ip_address INET,
  device_fingerprint TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON wallet_audit_log(affected_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_job ON wallet_audit_log(job_id);

-- ────────────────────────────────────────────────────────────
-- Immutability trigger on ledger_entries
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable. Create a reversal entry instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_ledger_immutability ON ledger_entries;
CREATE TRIGGER enforce_ledger_immutability
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

-- ────────────────────────────────────────────────────────────
-- Double-entry balance trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_double_entry()
RETURNS TRIGGER AS $$
DECLARE
  debit_total BIGINT;
  credit_total BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount_paise ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_paise ELSE 0 END), 0)
  INTO debit_total, credit_total
  FROM ledger_entries
  WHERE transaction_id = NEW.transaction_id;

  IF debit_total > 0 AND credit_total > 0 AND debit_total != credit_total THEN
    RAISE EXCEPTION 'Double-entry violation: debits % != credits % for transaction %',
      debit_total, credit_total, NEW.transaction_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_double_entry ON ledger_entries;
CREATE TRIGGER enforce_double_entry
AFTER INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION verify_double_entry();
