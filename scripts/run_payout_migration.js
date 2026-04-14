/**
 * Run the payout tables migration via Node.js
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

import fs from 'fs';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Vs@123456',
    database: process.env.DB_NAME || 'zarva',
});

async function run() {
    const sql = fs.readFileSync('./migrations/add_payout_tables.sql', 'utf8');
    try {
        await pool.query(sql);
        console.log('✅ Migration complete: payout tables created/verified.');
    } catch (err) {
        console.error('❌ Migration error:', err.message);
    } finally {
        await pool.end();
    }
}

run();
