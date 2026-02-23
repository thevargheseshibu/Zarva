import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });
    try {
        const [wp] = await pool.query('SELECT user_id, average_rating, rating_count, total_jobs FROM worker_profiles WHERE user_id = 99998');
        console.log("WORKER PROFILE:");
        console.log(JSON.stringify(wp, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
