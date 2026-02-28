import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Vs@123456',
    database: process.env.DB_NAME || 'zarva',
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Running migration...');
        
        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE
        `);
        console.log('✅ Column added (or already exists)');

        const res = await client.query(`
            UPDATE users u
            SET onboarding_complete = TRUE
            WHERE EXISTS (
                SELECT 1 FROM worker_agreements wa WHERE wa.worker_id = u.id
            )
            RETURNING id
        `);
        console.log(`✅ Backfilled ${res.rowCount} worker(s) with onboarding_complete = true`);

        const check = await client.query(`
            SELECT 
                COUNT(*) FILTER (WHERE onboarding_complete = true) as completed,
                COUNT(*) FILTER (WHERE onboarding_complete = false) as pending
            FROM users WHERE active_role = 'worker'
        `);
        console.log('📊 Worker completion status:', check.rows[0]);

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
