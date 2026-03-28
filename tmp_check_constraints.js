import { getPool } from './config/database.js';
const pool = getPool();
try {
    const [rows] = await pool.query(`
        SELECT 
            conname AS constraint_name, 
            contype AS constraint_type, 
            pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND conrelid = 'jobs'::regclass
    `);
    console.log(JSON.stringify(rows, null, 2));
} catch (err) {
    console.error(err);
} finally {
    process.exit(0);
}
