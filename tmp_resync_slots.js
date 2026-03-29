import { getPool } from './config/database.js';
const pool = getPool();
const userId = 5;

// Count actual active jobs
const [actualJobs] = await pool.query(
    "SELECT id, status FROM jobs WHERE worker_id = $1 AND status NOT IN ('completed', 'cancelled', 'no_worker_found', 'disputed', 'suspended')",
    [userId]
);
console.log(`Actual active jobs for user ${userId}:`, actualJobs);

// Update user_job_slots
await pool.query(
    "INSERT INTO user_job_slots(user_id, active_job_count) VALUES($1, $2) ON CONFLICT(user_id) DO UPDATE SET active_job_count = $2, updated_at = NOW()",
    [userId, actualJobs.length]
);
console.log(`Concurrency slot for user ${userId} resynced to:`, actualJobs.length);
process.exit(0);
