import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function checkProfiles() {
    const pool = getPool();
    try {
        console.log("--- WORKER PROFILES KYC STATUS ---");

        const [rows] = await pool.query("SELECT user_id, name, kyc_status FROM worker_profiles LIMIT 20");
        console.log("Worker Profiles:");
        rows.forEach(r => console.log(` - U:${r.user_id} | Name: ${r.name} | Status: ${r.kyc_status}`));

        console.log("--- DIAGNOSTIC COMPLETE ---");
    } catch (err) {
        console.error("Diagnostic failed:", err.message);
    } finally {
        await pool.end();
    }
}

checkProfiles();
