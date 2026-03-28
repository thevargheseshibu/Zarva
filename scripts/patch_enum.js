import { getPool } from '../config/database.js';

async function run() {
    const pool = getPool();
    try {
        await pool.query(`ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'suspended'`);
        await pool.query(`ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'pause_requested'`);
        await pool.query(`ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'resume_requested'`);
        await pool.query(`ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'work_paused'`);
        await pool.query(`ALTER TYPE job_status_enum ADD VALUE IF NOT EXISTS 'suspend_requested'`);
        console.log('✅ Successfully updated job_status_enum with required values');
    } catch (e) {
        if (e.message.includes('already exists')) {
             console.log('⚠️ Some values already exist - that is fine.');
        } else {
             console.error('❌ Failed to update enum:', e.message);
        }
    } finally {
        process.exit(0);
    }
}
run();
