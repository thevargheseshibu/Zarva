import { getPool } from './config/database.js';
import { updateJobNode } from './services/firebase.service.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getRedisClient } from './config/redis.js';

async function run() {
    const pool = getPool();
    const redisClient = getRedisClient();

    try {
        const [jobs] = await pool.query("SELECT id, status, metadata FROM jobs WHERE status IN ('worker_arrived', 'inspection_active')");
        console.log(`Found ${jobs.length} stuck jobs:`, jobs);

        for (const job of jobs) {
            // Is it a follow up job or just an old job?
            if (job.status === 'worker_arrived' || job.status === 'inspection_active') {
                const startOtp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
                const hash = await bcrypt.hash(startOtp, 10);

                await pool.query(`
                    UPDATE jobs 
                    SET start_otp_hash = $1, 
                        status = 'estimate_submitted',
                        arrived_at = COALESCE(arrived_at, NOW())
                    WHERE id = $2
                `, [hash, job.id]);

                await redisClient.set(`zarva:otp:start:${job.id}`, startOtp, 'EX', 10800);
                
                // Make sure metadata has is_followup = true if it's missing
                let newMeta = job.metadata || {};
                newMeta.is_followup = true;
                await pool.query('UPDATE jobs SET metadata = $1 WHERE id = $2', [JSON.stringify(newMeta), job.id]);

                await updateJobNode(job.id, { status: 'estimate_submitted', arrived_at: new Date().toISOString() });
                console.log(`Fixed job ${job.id} - moved to estimate_submitted and set is_followup=true`);
            }
        }
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
