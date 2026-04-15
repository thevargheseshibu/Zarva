import { getPool } from './config/database.js';

async function run() {
    const pool = getPool();
    console.log('[Schema] Running status migration...');
    
    try {
        // 1. Add the missing columns for payout processing
        await pool.query(`
            ALTER TABLE withdrawal_requests 
            ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(128),
            ADD COLUMN IF NOT EXISTS failure_reason TEXT,
            ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20) DEFAULT 'bank',
            ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) UNIQUE;
        `);
        
        console.log('[Schema] withdrawal_requests table updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error('[Schema] Error updating table:', err.message);
        process.exit(1);
    }
}

run();
