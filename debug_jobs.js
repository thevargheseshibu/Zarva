
import { getPool } from './config/database.js';

async function debugJobs() {
    const pool = getPool();
    try {
        const [jobs] = await pool.query(`
            SELECT id, category, status, address, ST_AsText(job_location) as loc 
            FROM jobs 
            WHERE status = 'searching'
        `);
        console.log('--- Searching Jobs ---');
        console.table(jobs);

        const [profiles] = await pool.query(`
            SELECT user_id, category, is_online, is_verified, ST_AsText(service_area) as area, ST_AsText(current_location) as current_loc
            FROM worker_profiles
        `);
        console.log('\n--- Worker Profiles ---');
        console.table(profiles);

        if (jobs.length > 0 && profiles.length > 0) {
            console.log('\n--- Intersection Check ---');
            for (const job of jobs) {
                for (const profile of profiles) {
                    const [res] = await pool.query(`
                        SELECT ST_Intersects(
                            ST_GeogFromText($1),
                            ST_GeogFromText($2)
                        ) as intersects
                    `, [job.loc, profile.area]);
                    console.log(`Job ${job.id} (${job.category}) intersects Worker ${profile.user_id} (${profile.category}) area: ${res[0].intersects}`);
                }
            }
        }
    } catch (err) {
        console.error('Debug Error:', err);
    } finally {
        process.exit(0);
    }
}

debugJobs();
