import { getPool } from '../config/database.js';

async function migrate() {
    const pool = getPool();
    try {
        console.log('Adding fcm_token column to users table...');
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255) NULL`);
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        pool.end();
    }
}

migrate();
