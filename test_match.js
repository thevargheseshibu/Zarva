
import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function clearDavid() {
    const pool = getPool();
    const workerId = 99998;

    try {
        await pool.query('UPDATE worker_profiles SET current_job_id = NULL WHERE user_id = ?', [workerId]);
        console.log('David is now FREE.');
    } catch (err) {
        console.error('Action Failed:', err);
    } finally {
        process.exit();
    }
}

clearDavid();
