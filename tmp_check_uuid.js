import { getPool } from './config/database.js';
const pool = getPool();
try {
    const [rows] = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' 
        AND data_type = 'uuid'
    `);
    console.log(JSON.stringify(rows, null, 2));
} catch (err) {
    console.error(err);
} finally {
    process.exit(0);
}
