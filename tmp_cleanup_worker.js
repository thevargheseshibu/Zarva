import { getPool } from './config/database.js';
const pool = getPool();
const userId = 5;

// Mark all pending completion as completed
await pool.query("UPDATE jobs SET status = 'completed', work_ended_at = NOW() WHERE worker_id = $1 AND status = 'pending_completion'", [userId]);

// Reset concurrency slot to 0
await pool.query("INSERT INTO user_job_slots(user_id, active_job_count) VALUES($1, 0) ON CONFLICT(user_id) DO UPDATE SET active_job_count = 0, updated_at = NOW()", [userId]);

console.log('Successfully cleared all ghost jobs for Dean (Worker ID 5). Code 0.');
process.exit(0);
