import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function listTables() {
    const pool = getPool();
    try {
        const [rows] = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        console.log("Tables in public schema:");
        rows.forEach(r => console.log(` - ${r.table_name}`));
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

listTables();
