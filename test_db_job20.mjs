import { getPool } from './config/database.js';

async function check() {
    const pool = getPool();
    const [rows] = await pool.query('SELECT status, customer_id, worker_id, inspection_otp_hash, start_otp_hash, end_otp_hash FROM jobs WHERE id = 20');
    console.log(rows[0]);
    process.exit(0);
}
check();
