import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function testUpdate() {
    const pool = getPool();
    try {
        console.log("Fetching a sample worker from worker_profiles...");
        const [workers] = await pool.query("SELECT user_id FROM worker_profiles LIMIT 1");
        if (!workers.length) {
            console.log("No workers found in worker_profiles.");
            return;
        }
        const userId = workers[0].user_id;
        console.log(`Using userId: ${userId}`);

        console.log("Attempting UPDATE with 'gender' column...");
        const [res] = await pool.query(`
            UPDATE worker_profiles 
            SET gender = 'test_gender' 
            WHERE user_id = $1
            RETURNING *
        `, [userId]);

        if (res.length > 0) {
            console.log("SUCCESS: Update completed with RETURNING.");
            console.log("Updated row gender:", res[0].gender);
        } else {
            console.log("FAIL: Update ran but affected 0 rows (user_id mismatch?).");
        }

    } catch (err) {
        console.error("FAIL: Error during update test:", err.message);
    } finally {
        await pool.end();
    }
}

testUpdate();
