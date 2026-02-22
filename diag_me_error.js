import { getPool } from './config/database.js';
import { getUserProfile } from './services/auth.service.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function test() {
    const pool = getPool();
    try {
        // Find a worker user to test with
        const [users] = await pool.query('SELECT id, role FROM users WHERE role = "worker" LIMIT 1');
        if (users.length === 0) {
            console.error('No worker users found in DB');
            return;
        }

        const testId = users[0].id;
        console.log(`Testing getUserProfile for User ID: ${testId} (${users[0].role})`);

        const profile = await getUserProfile(testId, pool);
        console.log('Profile fetched successfully:');
        console.log(JSON.stringify(profile, null, 2));
    } catch (err) {
        console.error('FAILED to fetch profile:', err);
        if (err.sql) console.error('SQL:', err.sql);
    } finally {
        process.exit();
    }
}

test();
