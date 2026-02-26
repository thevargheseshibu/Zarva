import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

const keys = [
    'worker_doc/3/3666818e-a231-49d9-9f97-9d7e364e9f68.jpeg',
    'worker_doc/3/eb4787cb-0715-45a0-ab79-9e7f799dab34.jpeg',
    'worker_doc/3/3c02e8d7-c2cd-4110-aaa3-7786e4a86d57.jpeg'
];

async function checkSpecificKeys() {
    const pool = getPool();
    try {
        console.log("--- CHECKING SPECIFIC KEYS ---");
        for (const key of keys) {
            const [rows] = await pool.query('SELECT * FROM s3_upload_tokens WHERE s3_key = $1', [key]);
            if (rows.length > 0) {
                console.log(`KEY FOUND: ${key} | Used: ${rows[0].is_used}`);
            } else {
                console.log(`KEY NOT FOUND: ${key}`);
            }
        }
        console.log("--- CHECK COMPLETE ---");
    } finally {
        await pool.end();
    }
}

checkSpecificKeys();
