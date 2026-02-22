
import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function checkCols() {
    const pool = getPool();
    try {
        const [cols] = await pool.query('SHOW COLUMNS FROM worker_profiles');
        console.log('--- worker_profiles columns ---');
        for (const c of cols) {
            console.log(`Column: ${c.Field.padEnd(20)} | Type: ${c.Type}`);
        }

        const [rows] = await pool.query('SELECT * FROM worker_profiles LIMIT 1');
        if (rows.length > 0) {
            console.log('\n--- Sample Row Content ---');
            console.log(JSON.stringify(rows[0], null, 2));
        }
    } catch (err) {
        console.error('Error checking columns:', err);
    } finally {
        process.exit();
    }
}

checkCols();
