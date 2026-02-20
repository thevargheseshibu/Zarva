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
import redisClient from '../config/redis.js';
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

    } finally {
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM worker_profiles WHERE user_id IN (99992, 99993)');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992, 99993)');
        await pool.end();
        await redisClient.quit();
    }
}

run().catch(err => {
    console.error('Fatal Test Fail:', err);
    process.exit(1);
});
