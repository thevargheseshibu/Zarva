import { getPool } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });
dotenv.config();

async function run() {
    const pool = getPool();
    console.log('[Search] Looking for worker 9746020743...');

    try {
        const [users] = await pool.query('SELECT id, phone, role FROM users WHERE phone LIKE $1', ['%9746020743%']);
        console.log('[Search] Found matches:', JSON.stringify(users, null, 2));

        if (users.length > 0) {
            const userId = users[0].id;
            const [profiles] = await pool.query('SELECT user_id, current_job_id FROM worker_profiles WHERE user_id = $1', [userId]);
            console.log('[Search] Profile matches:', JSON.stringify(profiles, null, 2));
        }

    } catch (err) {
        console.error('[Search] Error:', err);
    } finally {
        process.exit(0);
    }
}

run();
