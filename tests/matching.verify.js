/**
 * tests/matching.verify.js
 * 
 * Verifies ATOMIC REDIS LOCKS + MYSQL FOR UPDATE behaviors via extreme rapid concurrency tests.
 * 
 * 1. Creates a dummy Job and Two concurrent workers.
 * 2. Fires N identical acceptance requests concurrently using Promise.all
 * 3. Expects exactly 1 success (200), and N-1 Race Condition rejections (409)
 */

import 'dotenv/config';
import { getPool } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import configLoader from '../config/loader.js';
import { acceptJob } from '../services/matchingEngine.js';

async function run() {
    console.log('\n=== ZARVA Matching Engine: Race Condition Test ===\n');

    await configLoader.loadAllConfigs();
    const pool = getPool();

    try {
        // 1. Setup Data
        // Clear old dummy data if exists (using hardcoded big IDs to avoid collision safely)
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');

        // Insert Customer & Workers
        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99991, '+919999000001', 'customer')`);
        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99992, '+919999000002', 'worker')`);
        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99993, '+919999000003', 'worker')`);

        // Insert Profiles
        await pool.query(`INSERT INTO worker_profiles (user_id, name, category, is_verified, is_online, is_available) VALUES (99992, 'Worker A', 'plumber', 1, 1, 1)`);
        await pool.query(`INSERT INTO worker_profiles (user_id, name, category, is_verified, is_online, is_available) VALUES (99993, 'Worker B', 'plumber', 1, 1, 1)`);

        // Insert Searching Job
        await pool.query(`INSERT INTO jobs (id, customer_id, category, idempotency_key, address, latitude, longitude, rate_per_hour, status) 
                          VALUES (99991, 99991, 'plumber', 'atomic-test', 'Loc', 10, 10, 300, 'searching')`);

        // Ensure Redis key is clean
        const redisClient = getRedisClient();
        await redisClient.del('zarva:job:99991:lock');

        console.log('⬡ Firing 5 concurrent acceptance requests against Job 99991 (2 from Worker A, 3 from Worker B)...');

        let successes = 0;
        let raceErrors = 0;
        let otherErrors = 0;

        // 2. Fire atomic concurrent collisions
        const requests = [
            acceptJob(99991, 99992),
            acceptJob(99991, 99993),
            acceptJob(99991, 99992),
            acceptJob(99991, 99993),
            acceptJob(99991, 99993)
        ];

        const results = await Promise.allSettled(requests);

        results.forEach((res, i) => {
            if (res.status === 'fulfilled') {
                successes++;
                console.log(`  [Req ${i}] -> SUCCESS (Claimed)`);
            } else {
                if (res.reason.code === 'RACE_CONDITION' || res.reason.code === 'JOB_UNAVAILABLE') {
                    raceErrors++;
                    console.log(`  [Req ${i}] -> REJECTED (${res.reason.code})`);
                } else {
                    otherErrors++;
                    console.log(`  [Req ${i}] -> UNKNOWN ERROR:`, res.reason);
                }
            }
        });

        console.log('\n⬡ RESULTS:');
        if (successes === 1 && raceErrors === 4 && otherErrors === 0) {
            console.log('  ✔ RACE CONDITION IMMUNITY VERIFIED. Exactly 1 worker claimed the assignment.');

            // Check Job Status
            const [j] = await pool.query('SELECT status, worker_id FROM jobs WHERE id = 99991');
            console.log(`  ✔ Job state locked: STATUS=${j[0].status} | WORKER_ID=${j[0].worker_id}`);
        } else {
            console.error('  ✖ RACE CONDITION DETECTED! Lock logic failed.');
            console.log(`    Successes: ${successes}, Race Rejections: ${raceErrors}, Other: ${otherErrors}`);
            process.exitCode = 1;
        }

        // ============================================
        // 3. HAVERSINE RADIUS TEST
        // ============================================
        console.log('\n⬡ Dislodging previous Test Environment Data...');
        await redisClient.del('zarva:job:99991:lock');
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM worker_profiles WHERE user_id IN (99992, 99993)');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992, 99993)');

        console.log('⬡ Setting up Haversine Bounds Coordinates...');
        await pool.query(`INSERT INTO users (id, phone, role, fcm_token) VALUES (99991, '+919999000001', 'customer', 'cust-token')`);
        // Worker A (99992) will be 2.5km away (Inside 3km Wave 1)
        await pool.query(`INSERT INTO users (id, phone, role, fcm_token) VALUES (99992, '+919999000002', 'worker', 'fcm-2')`);
        // Worker B (99993) will be 9km away (Inside 15km Wave 3, Outside 3km/7km)
        await pool.query(`INSERT INTO users (id, phone, role, fcm_token) VALUES (99993, '+919999000003', 'worker', 'fcm-3')`);

        // Center Coordinate (Customer Job)
        // Kochi Center approx: 9.9312, 76.2673
        const JOB_LAT = 9.9312;
        const JOB_LNG = 76.2673;

        // Roughly 1 deg Lat/Lng ~ 111km. 
        // 2.5km shift = ~0.0225 deg
        const W1_LAT = 9.9312 + 0.0225;
        const W1_LNG = 76.2673;

        // 9km shift = ~0.081 deg
        const W2_LAT = 9.9312 + 0.0810;
        const W2_LNG = 76.2673;

        await pool.query(`INSERT INTO worker_profiles (user_id, name, category, is_verified, is_online, is_available, current_lat, current_lng) 
                          VALUES (99992, 'Worker Close', 'painter', 1, 1, 1, ?, ?)`, [W1_LAT, W1_LNG]);

        await pool.query(`INSERT INTO worker_profiles (user_id, name, category, is_verified, is_online, is_available, current_lat, current_lng) 
                          VALUES (99993, 'Worker Far', 'painter', 1, 1, 1, ?, ?)`, [W2_LAT, W2_LNG]);

        await pool.query(`INSERT INTO jobs (id, customer_id, category, idempotency_key, address, latitude, longitude, rate_per_hour, status) 
                          VALUES (99991, 99991, 'painter', 'haversine-test', 'Loc', ?, ?, 350, 'searching')`, [JOB_LAT, JOB_LNG]);

        console.log('⬡ Executing matchingEngine.startMatching() wave simulation...');
        // Start wave asynchronously but do not await full completion
        import('../services/matchingEngine.js').then(m => m.startMatching(99991));

        // Wait 2 seconds for Wave 1 evaluating (3km radius)
        await new Promise(r => setTimeout(r, 2000));

        const [w1Notifs] = await pool.query('SELECT worker_id FROM job_worker_notifications WHERE job_id = 99991');
        if (w1Notifs.length === 1 && w1Notifs[0].worker_id === 99992) {
            console.log('  ✔ HAVERSINE WAVE 1 SUCCESS: Exactly identified 1 proximate worker (Worker A) within 3km bounds.');
        } else {
            console.error('  ✖ HAVERSINE LOGIC FAILED Wave 1 Bound Isolation. Found:', w1Notifs);
            process.exitCode = 1;
        }

        // Wait an arbitrary amount for the wave to finish logging (simulates graceful shutdown)
        await new Promise(r => setTimeout(r, 500));

    } finally {
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM worker_profiles WHERE user_id IN (99992, 99993)');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992, 99993)');
        await pool.query('DELETE FROM job_worker_notifications WHERE job_id = 99991');
        await pool.end();

        const redisClient = getRedisClient();
        await redisClient.quit();

        // Kill gracefully without triggering unhandled exceptions on hanging asyncs
        setTimeout(() => process.exit(process.exitCode || 0), 200);
    }
}

run().catch(err => {
    console.error('Fatal Test Fail:', err);
    process.exit(1);
});
