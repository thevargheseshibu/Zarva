import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkCasing() {
    const pool = getPool();
    try {
        console.log("Checking for 'worker_profiles' variations...");
        const [rows] = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE LOWER(table_name) = 'worker_profiles';
        `);
        console.log("Tables found:", rows);
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkCasing();
