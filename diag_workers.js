
import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function checkWorkers() {
    const pool = getPool();
    try {
        const [workers] = await pool.query(`
            SELECT 
                wp.user_id, 
                wp.name, 
                wp.category, 
                wp.skills,
                wp.is_verified, 
                wp.is_online, 
                wp.is_available, 
                wp.last_location_lat, 
                wp.last_location_lng, 
                wp.last_location_at,
                u.fcm_token,
                u.phone
            FROM worker_profiles wp
            JOIN users u ON u.id = wp.user_id
        `);

        console.log('--- Detailed Worker Status Report ---');
        workers.forEach(w => {
            console.log(`Worker ID: ${w.user_id} | Phone: ${w.phone} | Name: ${w.name}`);
            console.log(`- Category: ${w.category}`);
            console.log(`- Skills: ${JSON.stringify(w.skills)}`);
            console.log(`- Verified: ${w.is_verified} | Online: ${w.is_online} | Available: ${w.is_available}`);
            console.log(`- FCM Token: ${w.fcm_token ? 'YES' : 'MISSING'}`);
            console.log(`- Last Location: ${w.last_location_lat}, ${w.last_location_lng} at ${w.last_location_at}`);

            const thirtyMinsAgo = new Date(Date.now() - 30 * 60000);
            const isFresh = w.last_location_at > thirtyMinsAgo;
            console.log(`- Location Fresh: ${isFresh ? 'YES' : 'NO'}`);
            console.log('----------------------------');
        });

        if (workers.length === 0) {
            console.log('No workers found in database.');
        }
    } catch (err) {
        console.error('Error checking workers:', err);
    } finally {
        process.exit();
    }
}

checkWorkers();
