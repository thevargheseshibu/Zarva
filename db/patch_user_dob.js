
import { getPool } from '../config/database.js';

async function patch() {
    const pool = getPool();
    console.log('[DB Patch] Adding date_of_birth to users table...');

    try {
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL;
        `);
        console.log('[DB Patch] Success: date_of_birth column added.');
    } catch (err) {
        console.error('[DB Patch] Failed:', err.message);
    } finally {
        process.exit(0);
    }
}

patch();
