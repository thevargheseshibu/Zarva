/**
 * scripts/debug_otp_recovery.js
 * Verifies that the backend regenerates a missing START OTP.
 */
import { getRedisClient } from '../lib/redis.js';
import { getPool } from '../lib/db.js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.development') });

async function testRecovery() {
    const jobId = process.argv[2];
    if (!jobId) {
        console.error('Usage: node scripts/debug_otp_recovery.js <jobId>');
        process.exit(1);
    }

    const redis = getRedisClient();
    const pool = getPool();

    console.log(`[Test] Checking job ${jobId} status...`);
    const [rows] = await pool.query('SELECT status FROM jobs WHERE id = $1', [jobId]);
    if (!rows[0] || rows[0].status !== 'estimate_submitted') {
        console.error(`Job ${jobId} is not in estimate_submitted status (Current: ${rows[0]?.status}). Please find a job in the correct phase.`);
        process.exit(1);
    }

    console.log(`[Test] Current status: ${rows[0].status}. Clearing Redis key...`);
    await redis.del(`zarva:otp:start:${jobId}`);

    console.log(`[Test] Redis cleared. You can now refresh the customer app or call the API.`);
    console.log(`[Test] If recovery works, the customer will see a code, and Redis will have a new value.`);
    
    // We can't easily call the API here without a valid JWT, so we'll just advise the user.
    console.log(`\n[ACTION REQUIRED] Now refresh the Job Status screen in the app.`);
    
    process.exit(0);
}

testRecovery().catch(err => {
    console.error(err);
    process.exit(1);
});
