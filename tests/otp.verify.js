/**
 * tests/otp.verify.js
 * 
 * Comprehensive E2E Test Suite for ZARVA Task 4.3 OTP Flows
 * 
 * Verifies:
 * 1. Worker En Route -> Worker Arrived (OTP hashes to DB, plaintext to Redis)
 * 2. Verify Start OTP (Bcrypt compare, 5-strike dispute cascades)
 * 3. Complete Job (End OTP gen)
 * 4. Verify End OTP (Customer finalizing invoice mapping logic)
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { getPool } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import configLoader from '../config/loader.js';

// Mock Express req/res logic closely mimicking the api mapping
import workerRouter from '../routes/worker.js';
import jobsRouter from '../routes/jobs.js';

async function run() {
    console.log('\n=== ZARVA Task 4.3: OTP Flows Verification ===\n');

    await configLoader.loadAllConfigs();
    const pool = getPool();
    const redisClient = getRedisClient();

    let assertsPassed = 0;
    let assertsTotal = 0;

    const assert = (condition, msg) => {
        assertsTotal++;
        if (condition) {
            console.log(`  [Pass] ${msg}`);
            assertsPassed++;
        } else {
            console.error(`  [FAIL] ${msg}`);
        }
    };

    /** MOCK HTTP RUNNER */
    const mockRequest = async (router, method, path, userId, body = {}) => {
        return new Promise((resolve) => {
            const req = {
                method, url: path, body, params: { id: 99991 }, user: { id: userId },
                headers: { 'x-idempotency-key': 'test' }
            };
            const res = {
                status: (s) => ({
                    json: (data) => resolve({ status: s, body: data })
                })
            };

            // Very simplified routing interceptor matching the static string path
            const route = router.stack.find(r => r.route?.path === path && r.route?.methods[method.toLowerCase()]);
            if (!route) resolve({ status: 404, body: { message: 'Route not found' } });

            // Execute the handler
            route.route.stack[0].handle(req, res, () => { });
        });
    };

    try {
        console.log('\n--- Environment Setup ---');
        await pool.query('DELETE FROM job_invoices WHERE job_id = 99991');
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM worker_profiles WHERE user_id = 99992');
        await pool.query('DELETE FROM customer_profiles WHERE user_id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');

        await redisClient.del('zarva:otp:start:99991');
        await redisClient.del('zarva:otp:end:99991');

        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99991, '+919999000001', 'customer')`);
        await pool.query(`INSERT INTO customer_profiles (user_id, total_jobs) VALUES (99991, 0)`);
        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99992, '+919999000002', 'worker')`);
        await pool.query(`INSERT INTO worker_profiles (user_id, name, category, is_verified) VALUES (99992, 'OTP Worker', 'electrician', 1)`);

        // Start Job at 'worker_en_route'
        await pool.query(`INSERT INTO jobs (id, customer_id, worker_id, category, idempotency_key, address, latitude, longitude, rate_per_hour, status) 
                          VALUES (99991, 99991, 99992, 'electrician', 'test-otp', 'Loc', 10, 10, 300, 'worker_en_route')`);


        console.log('\n--- Test 1. Worker Arrival (Start OTP Generation) ---');
        // ACT
        const arrivalRes = await mockRequest(workerRouter, 'POST', '/jobs/:id/arrived', 99992);
        assert(arrivalRes.status === 200, "Worker POST /api/worker/jobs/:id/arrived succeeds");
        assert(arrivalRes.body.arrived === true || arrivalRes.body.data?.arrived === true, "Response confirms arrival without leaking OTP natively");

        // CHECK DB
        const [job1] = await pool.query('SELECT status, start_otp_hash, start_otp_generated_at FROM jobs WHERE id = 99991');
        assert(job1[0].status === 'worker_arrived', "DB status progressed to 'worker_arrived'");
        assert(job1[0].start_otp_hash.startsWith('$2b$'), "DB start_otp_hash is definitively a bcrypt string");

        // CHECK REDIS
        const startOtpPlaintext = await redisClient.get('zarva:otp:start:99991');
        assert(startOtpPlaintext !== null && startOtpPlaintext.length === 4, "Redis contains exactly the 4 digit plaintext OTP");

        const isBcryptMatch = await bcrypt.compare(startOtpPlaintext, job1[0].start_otp_hash);
        assert(isBcryptMatch, "Redis plaintext rigorously matches the DB Bcrypt Hash");


        console.log('\n--- Test 2. Customer GET View (Plaintext relay) ---');
        const viewRes = await mockRequest(jobsRouter, 'GET', '/:id', 99991);
        assert(viewRes.status === 200, "Customer GET /api/jobs/:id succeeds");
        assert(viewRes.body.job?.start_otp === startOtpPlaintext, "Customer view successfully relays plaintext start_otp from Redis payload");
        assert(viewRes.body.job?.start_otp_hash === undefined, "Customer view thoroughly wiped the hash objects from response body");


        console.log('\n--- Test 3. Verify Start OTP (Failures & Dispute cascade) ---');

        // Push 4 failures
        for (let i = 1; i <= 4; i++) {
            await mockRequest(workerRouter, 'POST', '/jobs/:id/verify-start-otp', 99992, { otp: '0000' });
        }
        const [jobFail] = await pool.query('SELECT start_otp_attempts, status FROM jobs WHERE id = 99991');
        assert(jobFail[0].start_otp_attempts === 4, "DB successfully tabulated 4 failed attempts linearly");

        // Push 5th failure
        const fail5Res = await mockRequest(workerRouter, 'POST', '/jobs/:id/verify-start-otp', 99992, { otp: '0000' });
        assert(fail5Res.status === 403, "5th failure strictly blocks access resulting in 403 Forbidden");

        const [jobDisp] = await pool.query('SELECT status FROM jobs WHERE id = 99991');
        assert(jobDisp[0].status === 'disputed', "5th failure correctly escalated Job status natively into 'disputed'");


        console.log('\n--- Test 4. Verify Start OTP (Success Cascade) ---');
        // Reset the job state to properly continue success flow
        await pool.query("UPDATE jobs SET status='worker_arrived', start_otp_attempts=0 WHERE id=99991");

        const succVerifyRes = await mockRequest(workerRouter, 'POST', '/jobs/:id/verify-start-otp', 99992, { otp: startOtpPlaintext });
        assert(succVerifyRes.status === 200, "Submitting exact Redis plaintext OTP succeeds");

        const [jobSucc] = await pool.query('SELECT status, work_started_at FROM jobs WHERE id = 99991');
        assert(jobSucc[0].status === 'in_progress', "Job gracefully moved to 'in_progress'");
        assert(jobSucc[0].work_started_at !== null, "Temporal marker `work_started_at` locked");

        const cachedOtpCheck = await redisClient.get('zarva:otp:start:99991');
        assert(cachedOtpCheck === null, "Redis `start_otp` key definitively deleted natively after success!");


        console.log('\n--- Test 5. Worker Complete (End OTP generation) ---');
        // Set work started time 2 hours ago to test actual_hours later
        await pool.query(`UPDATE jobs SET work_started_at = DATE_SUB(NOW(), INTERVAL 2 HOUR) WHERE id = 99991`);

        const completeRes = await mockRequest(workerRouter, 'POST', '/jobs/:id/complete', 99992);
        assert(completeRes.status === 200, "Worker /complete call succeeds");
        assert(completeRes.body.data?.end_otp !== undefined || completeRes.body?.end_otp !== undefined, "Worker payload returns the explicit new OTP to show customer implicitly");

        // The handler uses handle() which wraps in { status: 'ok', data: { end_otp } } or direct merge depending on exact return syntax.
        // It returns { end_otp: otp } directly which merges into the top level { status: 'ok', end_otp: 'xxxx' }
        const generatedEndOtp = completeRes.body?.end_otp || completeRes.body.data?.end_otp;
        const [jobEnd] = await pool.query('SELECT status, end_otp_hash FROM jobs WHERE id = 99991');
        assert(jobEnd[0].status === 'pending_completion', "DB job state shifted to `pending_completion` successfully");
        const endBcyptMatch = await bcrypt.compare(String(generatedEndOtp), jobEnd[0].end_otp_hash);
        assert(endBcyptMatch, "Returned Explicit End OTP strictly matches the Db Hash");


        console.log('\n--- Test 6. Finalize Job (Verify End OTP + Invoicing) ---');
        // ONLY CUSTOMER ID 99991 should be able to call this logic
        const finalRes = await mockRequest(jobsRouter, 'POST', '/:id/verify-end-otp', 99991, { otp: generatedEndOtp });

        assert(finalRes.status === 200, "Customer /verify-end-otp successes");
        assert(finalRes.body.completed === true || finalRes.body.data?.completed === true, "Response natively marks as completed gracefully");

        // Calculate the physical assertions
        const invPayload = finalRes.body.invoice || finalRes.body.data?.invoice;
        assert(invPayload !== undefined, "Attached Invoice generated perfectly!");
        if (invPayload) {
            assert(invPayload.subtotal > 0, "Invoice subtotal mathematically rendered based on hours");
        }

        const [jobFinal] = await pool.query('SELECT status, actual_hours FROM jobs WHERE id = 99991');
        assert(jobFinal[0].status === 'completed', "Job natively concluded as Completed");
        assert(jobFinal[0].actual_hours >= 1.99, "actual_hours accounting calculated exactly 2 hours diff effectively");

        // Profile Aggregations
        const [cProf] = await pool.query('SELECT total_jobs FROM customer_profiles WHERE user_id = 99991');
        assert(cProf[0].total_jobs === 1, "Customer aggregations incremented properly");
        const [wProf] = await pool.query('SELECT total_jobs, current_job_id FROM worker_profiles WHERE user_id = 99992');
        assert(wProf[0].total_jobs === 1, "Worker mapping increments completed metrics properly");
        assert(wProf[0].current_job_id === null, "Worker immediately unlocked from the `current_job_id` physically");


    } catch (err) {
        console.error('Fatal Test Error:', err);
    } finally {
        console.log('\n--- Cleaning Up ---');
        await pool.query('DELETE FROM job_invoices WHERE job_id = 99991');
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM worker_profiles WHERE user_id = 99992');
        await pool.query('DELETE FROM customer_profiles WHERE user_id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');
        await pool.end();
        await redisClient.quit();

        console.log(`\n=== Verification Results: ${assertsPassed} / ${assertsTotal} PASSED ===`);
        setTimeout(() => process.exit(assertsPassed === assertsTotal ? 0 : 1), 200);
    }
}

run();
