import { getPool } from './config/database.js';

const sql = `
-- Insert Default System Accounts needed by Zarva
INSERT INTO ledger_accounts (account_code, account_name, account_type, normal_balance) VALUES
('ESCROW', 'Escrow', 'liability', 'credit'),
('CUSTOMER_PAYABLE', 'Customer Payable', 'asset', 'debit'),
('WORKER_EARNINGS', 'Worker Earnings', 'liability', 'credit'),
('PLATFORM_REVENUE', 'Platform Revenue', 'revenue', 'credit'),
('PAYMENT_GATEWAY_FEES', 'Payment Gateway Fees', 'expense', 'debit'),
('GST_COLLECTED', 'GST Collected', 'liability', 'credit'),
('BANK_INFLOW', 'Bank Inflow', 'asset', 'debit'),
('BANK_OUTFLOW', 'Bank Outflow', 'asset', 'debit')
ON CONFLICT (account_code) DO NOTHING;

-- 2. User Sub-Accounts (Ledger mapping per user)
CREATE TABLE IF NOT EXISTS user_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_code VARCHAR(50) NOT NULL REFERENCES ledger_accounts(account_code),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, account_code)
);

-- 3. Core Ledger Entries (The Double-Entry Log)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    transaction_id UUID NOT NULL,
    entry_sequence INT NOT NULL,
    account_id UUID NOT NULL REFERENCES ledger_accounts(id),
    user_account_id BIGINT REFERENCES user_accounts(id) ON DELETE CASCADE,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('credit', 'debit')),
    amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
    event_type VARCHAR(50) NOT NULL,
    job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
    payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    description TEXT,
    triggered_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    triggered_by_system BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_txn ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user_acc ON ledger_entries(user_account_id);

-- 4. Fast Balance Cache
CREATE TABLE IF NOT EXISTS wallet_balance_cache (
    user_account_id BIGINT PRIMARY KEY REFERENCES user_accounts(id) ON DELETE CASCADE,
    balance_paise BIGINT NOT NULL DEFAULT 0,
    pending_paise BIGINT NOT NULL DEFAULT 0,
    available_paise BIGINT NOT NULL DEFAULT 0,
    last_computed_at TIMESTAMPTZ DEFAULT NOW(),
    last_entry_id BIGINT REFERENCES ledger_entries(id)
);

-- 5. Customer Pending Dues Tracker
CREATE TABLE IF NOT EXISTS customer_pending_dues (
    job_id BIGINT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_paise BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Wallet Audit Log
CREATE TABLE IF NOT EXISTS wallet_audit_log (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    actor_user_id BIGINT,
    actor_type VARCHAR(20),
    affected_user_id BIGINT,
    job_id BIGINT,
    amount_paise BIGINT,
    before_balance_paise BIGINT,
    after_balance_paise BIGINT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function applyMigration() {
    console.log("Applying ledger migration...");
    const pool = getPool();
    try {
        await pool.query(sql);
        console.log("Migration applied successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

applyMigration();
