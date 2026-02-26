import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkTokens() {
    const pool = getPool();
    try {
        console.log("--- S3 TOKENS DIAGNOSTIC (ALL) ---");

        const [tokens] = await pool.query(`
            SELECT * FROM s3_upload_tokens 
            ORDER BY created_at DESC LIMIT 50
        `);
        console.log(`Found ${tokens.length} recent tokens.`);
        tokens.forEach(t => {
            console.log(`U:${t.user_id} | Used:${t.is_used} | Key: ${t.s3_key}`);
        });

        console.log("--- DIAGNOSTIC COMPLETE ---");
    } catch (err) {
        console.error("Diagnostic failed:", err.message);
    } finally {
        await pool.end();
    }
}

checkTokens();
