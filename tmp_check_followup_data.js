import { getPool } from './config/database.js';
const pool = getPool();
try {
    const [rows] = await pool.query(`
        SELECT id FROM jobs WHERE followup_job_id IS NOT NULL LIMIT 5
    `);
    console.log(JSON.stringify(rows, null, 2));
} catch (err) {
    console.error(err);
} finally {
    process.exit(0);
}
