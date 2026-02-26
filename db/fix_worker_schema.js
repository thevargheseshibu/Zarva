import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: (process.env.DB_PORT == '3306' ? 5432 : Number(process.env.DB_PORT)) || 5432,
    user: (process.env.DB_USER === 'root' ? 'postgres' : process.env.DB_USER) || 'postgres',
    password: (process.env.DB_USER === 'root' || !process.env.DB_PASSWORD ? 'Vs@123456' : process.env.DB_PASSWORD),
    database: process.env.DB_NAME || 'zarva'
});

async function run() {
    try {
        console.log('[SchemaFix] Applying missing columns to worker_profiles...');
        await pool.query(`
            ALTER TABLE worker_profiles 
            ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NULL,
            ADD COLUMN IF NOT EXISTS experience_years VARCHAR(50) NULL,
            ADD COLUMN IF NOT EXISTS service_range INT NOT NULL DEFAULT 20,
            ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]';
            
            ALTER TABLE worker_profiles ALTER COLUMN experience_years TYPE VARCHAR(50);
        `);
        console.log('[SchemaFix] Success!');
    } catch (e) {
        console.error('[SchemaFix] Failed:', e.message);
    } finally {
        await pool.end();
    }
}

run();
