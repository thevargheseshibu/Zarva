import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'Vs@123456',
    database: 'zarva'
});

async function run() {
    try {
        console.log("Adding metadata column to jobs table...");
        await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`);
        console.log("Success.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

run();
