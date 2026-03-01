
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'Vs@123456',
    database: 'zarva'
});

async function updateSchema() {
    try {
        await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_ended_at TIMESTAMP");
        console.log('Successfully added inspection_ended_at column');
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

updateSchema();
