
import { getPool } from './config/database.js';

async function checkIntersection() {
    const pool = getPool();
    try {
        const [res] = await pool.query(`
            SELECT 
                ST_Intersects(
                    (SELECT service_area FROM worker_profiles WHERE user_id = 5)::geography,
                    (SELECT job_location FROM jobs WHERE id = 20)::geography
                ) as intersects
        `);
        console.log('Intersects:', res[0].intersects);
    } catch (err) {
        console.error('SQL Error:', err);
    } finally {
        process.exit(0);
    }
}

checkIntersection();
