import { getPool } from './config/database.js';

async function checkNotifications() {
    const pool = getPool();
    try {
        console.log(`Checking latest notifications...`);
        const [logs] = await pool.query(`
            SELECT id, user_id, title, body, status, sent_at 
            FROM notification_log 
            ORDER BY sent_at DESC NULLS LAST 
            LIMIT 10
        `);
        
        console.log('Recent Notifications:', logs);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkNotifications();
