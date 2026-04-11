import 'dotenv/config';
import { getPool } from './config/database.js';

async function fixTestUsers() {
    console.log('[Fix] Starting test users role adjustment...');
    const pool = getPool();
    const testPhones = ['+919746020743', '+919496229341'];
    
    try {
        for (const phone of testPhones) {
            console.log(`[Fix] Checking profiles for ${phone}...`);
            const [userRows] = await pool.query('SELECT id, role FROM users WHERE phone = $1', [phone]);
            if (userRows.length === 0) {
                console.log(`[Fix] User ${phone} not found.`);
                continue;
            }
            const userId = userRows[0].id;

            // Check if worker profile exists
            const [worker] = await pool.query('SELECT user_id FROM worker_profiles WHERE user_id = $1', [userId]);
            // Check if customer profile exists
            const [customer] = await pool.query('SELECT user_id FROM customer_profiles WHERE user_id = $1', [userId]);

            let activeRole = null;
            if (worker.length > 0) activeRole = 'worker';
            else if (customer.length > 0) activeRole = 'customer';

            if (activeRole) {
                console.log(`[Fix] Setting active_role to "${activeRole}" for ${phone} (User ID ${userId})`);
                await pool.query('UPDATE users SET active_role = $1 WHERE id = $2', [activeRole, userId]);
            } else {
                console.log(`[Fix] No profiles found for ${phone}. Defaulting to customer.`);
                await pool.query('UPDATE users SET active_role = $1 WHERE id = $2', [ 'customer', userId]);
            }
        }
    } catch (err) {
        console.error('[Fix] Error fixing test users:', err);
    } finally {
        await pool.end();
        console.log('[Fix] Done.');
        process.exit();
    }
}

fixTestUsers();
