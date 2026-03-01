
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'Vs@123456',
    database: 'zarva'
});

async function checkJob10() {
    try {
        const res = await pool.query('SELECT status, customer_id, worker_id, end_otp_hash FROM jobs WHERE id = 10');
        console.log('Job 10 status:', JSON.stringify(res.rows[0], null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkJob10();
