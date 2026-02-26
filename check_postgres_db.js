import pg from 'pg';
const { Pool } = pg;

async function checkPostgresDB() {
    const pool = new Pool({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'Vs@123456',
        database: 'postgres'
    });

    try {
        console.log("Checking for 'worker_profiles' in 'postgres' database...");
        const result = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'worker_profiles';
        `);
        console.log("Tables found in 'postgres' DB:", result.rows);
    } catch (err) {
        console.error("Error checking 'postgres' DB:", err.message);
    } finally {
        await pool.end();
    }
}

// Wrapper to mimic my pool.query if needed, but Pool.query is enough for basic check
checkPostgresDB();
