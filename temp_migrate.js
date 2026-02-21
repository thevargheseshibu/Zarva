import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import { getPool } from './config/database.js';

async function run() {
    try {
        const pool = getPool();
        await pool.query("ALTER TABLE users ADD COLUMN active_role ENUM('customer','worker','admin') NULL DEFAULT NULL AFTER role;");
        console.log('Successfully added active_role column.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column active_role already exists.');
        } else {
            console.error('Migration failed:', err);
        }
    }
    process.exit(0);
}
run();
