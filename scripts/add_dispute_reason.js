
import { getPool } from '../config/database.js';

async function migrate() {
    const pool = getPool();
    try {
        await pool.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispute_reason TEXT NULL;');
        console.log('Successfully added dispute_reason to jobs table');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
