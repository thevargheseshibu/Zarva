import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}`, override: false });

import { getPool } from './lib/db.js';

async function patchDB() {
    const pool = getPool();
    console.log('Adding missing billing columns to jobs table...');
    const queries = [
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_labor_paise BIGINT DEFAULT 0;",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_material_paise BIGINT DEFAULT 0;",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS grand_total_paise BIGINT DEFAULT 0;",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bill_preview_expires_at TIMESTAMPTZ;",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pause_count INT DEFAULT 0;"
    ];
    for (const q of queries) {
        try { 
            await pool.query(q); 
            console.log(`Executed: ${q}`);
        } catch(e) { 
            console.log('Notice:', e.message); 
        }
    }
    console.log('Database successfully patched!');
    process.exit(0);
}

patchDB().catch(err => {
    console.error('Fatal error during patch:', err);
    process.exit(1);
});
