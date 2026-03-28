/**
 * scripts/approve_workers.js
 * Utility to auto-approve pending workers and set them to online for testing.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.development
dotenv.config({ path: path.join(__dirname, '../.env.development') });

async function approveAllWorkers() {
    const pool = getPool();
    console.log('\n\x1b[36m--- Worker Auto-Approval Script ---\x1b[0m');
    
    try {
        const [pendingWorkers] = await pool.query(
            "SELECT user_id, name FROM worker_profiles WHERE kyc_status != 'approved' OR is_online = false OR is_available = false"
        );
        
        console.log(`\x1b[33m[INFO]\x1b[0m Found ${pendingWorkers.length} workers needing approval/status update.`);
        
        if (pendingWorkers.length === 0) {
            console.log('\x1b[32m[SUCCESS]\x1b[0m No workers to update.');
            process.exit(0);
        }

        for (const worker of pendingWorkers) {
            console.log(`\x1b[32m[PROCESS]\x1b[0m Approving worker: ${worker.name} (ID: ${worker.user_id})`);
            await pool.query(
                `UPDATE worker_profiles 
                 SET kyc_status = 'approved', 
                     is_verified = true, 
                     is_online = true,
                     is_available = true
                 WHERE user_id = $1`,
                [worker.user_id]
            );
        }

        console.log('\x1b[36m[DB]\x1b[0m Refreshing materialized view: active_worker_coverage...');
        try {
            await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY active_worker_coverage');
        } catch (e) {
            await pool.query('REFRESH MATERIALIZED VIEW active_worker_coverage');
        }

        console.log('\x1b[32m[SUCCESS]\x1b[0m All workers approved and coverage view refreshed successfully.\n');
    } catch (error) {
        console.error('\x1b[31m[ERROR]\x1b[0m during worker approval:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

approveAllWorkers();
