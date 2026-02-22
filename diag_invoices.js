import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function check() {
    const pool = getPool();
    try {
        const [cols] = await pool.query('SHOW COLUMNS FROM job_invoices');
        console.log('--- job_invoices columns ---');
        for (const c of cols) {
            console.log(`Column: ${c.Field.padEnd(20)} | Type: ${c.Type}`);
        }
    } catch (err) {
        console.error('Error checking columns:', err);
    } finally {
        process.exit();
    }
}

check();
