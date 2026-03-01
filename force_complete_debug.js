
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'Vs@123456',
    database: 'zarva'
});

async function forceComplete() {
    try {
        await pool.query("UPDATE jobs SET status = 'completed' WHERE id = 10");
        console.log('Successfully forced Job 10 to completed');
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

forceComplete();
