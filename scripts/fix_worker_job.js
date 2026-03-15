/**
 * scripts/fix_worker_job.js
 * 
 * One-time recovery script to clear the current_job_id for a worker.
 * Usage: node scripts/fix_worker_job.js
 */

import { getPool } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });
dotenv.config();

const WORKER_PHONE = '+919746020743';

async function run() {
    const pool = getPool();
    console.log(`[Recovery] Attempting to clear active job for worker: ${WORKER_PHONE}`);

    try {
        // Find worker ID
        const [users] = await pool.query('SELECT id FROM users WHERE phone = $1', [WORKER_PHONE]);
        if (!users.length) {
            console.error('[Recovery] Worker not found');
            process.exit(1);
        }
        const workerId = users[0].id;

        // Check profile
        const [profiles] = await pool.query('SELECT current_job_id FROM worker_profiles WHERE user_id = $1', [workerId]);
        if (!profiles.length) {
            console.error('[Recovery] Worker profile not found');
            process.exit(1);
        }

        console.log(`[Recovery] Found worker ID ${workerId}. Current job ID: ${profiles[0].current_job_id}`);

        if (!profiles[0].current_job_id) {
            console.log('[Recovery] Worker already has no active job. Nothing to do.');
            process.exit(0);
        }

        // Clear it
        await pool.query('UPDATE worker_profiles SET current_job_id = NULL WHERE user_id = $1', [workerId]);
        console.log(`[Recovery] Successfully cleared current_job_id for worker ${WORKER_PHONE}`);

    } catch (err) {
        console.error('[Recovery] Fatal error:', err);
    } finally {
        process.exit(0);
    }
}

run();
