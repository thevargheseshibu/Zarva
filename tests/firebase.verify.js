/**
 * tests/firebase.verify.js
 *
 * Verification suite for Task 6.1 — Firebase Realtime + Worker Location.
 * Runs entirely in stub mode (no Firebase credentials needed in dev).
 */

import 'dotenv/config';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import workerRouter from '../routes/worker.js';
import jobsRouter from '../routes/jobs.js';

async function run() {
    console.log('\n=== ZARVA Task 6.1: Firebase + Worker Location Verification ===\n');

    await configLoader.loadAllConfigs();
    const pool = getPool();

    let passed = 0, total = 0;
    const assert = (cond, msg) => {
        total++;
        if (cond) { console.log(`  [Pass] ${msg}`); passed++; }
        else console.error(`  [FAIL] ${msg}`);
    };

    // ── Lightweight route caller ──────────────────────────────────────────────
    const call = (router, method, path, userId, body = {}, params = {}) =>
        new Promise(resolve => {
            const req = { method, body, params, user: userId ? { id: userId } : undefined };
            const res = { status: s => ({ json: d => resolve({ status: s, body: d }) }) };
            const routePath = path.replace(/\/\d+$/, '/:id'); // normalize :id params
            for (const layer of router.stack) {
                if (!layer.route) continue;
                if (layer.route.path !== path && layer.route.path !== routePath) continue;
                if (!layer.route.methods[method.toLowerCase()]) continue;
                layer.route.stack[0].handle(req, res, err => {
                    resolve({ status: err?.status || 500, body: { message: err?.message } });
                });
                return;
            }
            // Try scanning all layers for matching path prefixes
            resolve({ status: 404, body: { message: `No route matched: ${method} ${path}` } });
        });

    const putLocation = (userId, body) => call(workerRouter, 'PUT', '/location', userId, body);
    const putAvail = (userId, body) => call(workerRouter, 'PUT', '/availability', userId, body);
    const getWloc = (userId, params) => call(jobsRouter, 'GET', '/:id/worker-location', userId, {}, params);

    try {
        // ── Seed ─────────────────────────────────────────────────────────────
        console.log('--- Seeding ---');
        await pool.query('DELETE FROM worker_location_history WHERE worker_id IN (99991, 99992)');
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM worker_profiles WHERE user_id = 99992');
        await pool.query('DELETE FROM customer_profiles WHERE user_id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');

        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99991, '+91FB1111', 'customer')`);
        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99992, '+91FB2222', 'worker')`);
        await pool.query(`INSERT INTO customer_profiles (user_id) VALUES (99991)`);
        await pool.query(
            `INSERT INTO worker_profiles (user_id, name, category, is_verified, is_online)
             VALUES (99992, 'Firebase Worker', 'plumber', 1, 1)`
        );
        await pool.query(
            `INSERT INTO jobs (id, customer_id, worker_id, category, address, latitude, longitude, rate_per_hour, status, idempotency_key)
             VALUES (99991, 99991, 99992, 'plumber', 'Test', 10, 10, 300, 'assigned', 'fb-test-1')`
        );

        // ── Test 1. PUT /api/worker/location — happy path ─────────────────────
        console.log('\n--- Test 1. Location Update (verified + online worker) ---');
        const r1 = await putLocation(99992, { lat: 10.0261, lng: 76.3083 });
        assert(r1.status === 200, 'PUT /worker/location returns 200 for verified online worker');
        assert(r1.body.updated === true || r1.body?.updated === true, 'Response has updated=true');

        // Verify DB column updated
        const [dbLoc] = await pool.query('SELECT last_location_lat, last_location_lng, last_location_at FROM worker_profiles WHERE user_id=99992');
        assert(parseFloat(dbLoc[0].last_location_lat) === 10.0261, 'DB last_location_lat updated correctly');
        assert(dbLoc[0].last_location_at !== null, 'DB last_location_at timestamp set');

        // Verify location_history logged
        const [hist] = await pool.query('SELECT * FROM worker_location_history WHERE worker_id=99992 ORDER BY id DESC LIMIT 1');
        assert(hist.length >= 1, 'worker_location_history row inserted');
        assert(parseFloat(hist[0].latitude) === 10.0261, 'Location history stores correct latitude');

        // ── Test 2. PUT /api/worker/location — offline worker should fail ─────
        console.log('\n--- Test 2. Location Update Blocked for Offline Worker ---');
        await pool.query("UPDATE worker_profiles SET is_online=0 WHERE user_id=99992");
        const r2 = await putLocation(99992, { lat: 10.01, lng: 76.30 });
        assert(r2.status === 403, 'Offline worker cannot update location — 403');
        await pool.query("UPDATE worker_profiles SET is_online=1 WHERE user_id=99992"); // restore

        // ── Test 3. PUT /api/worker/availability — go online ──────────────────
        console.log('\n--- Test 3. Availability Toggle ---');
        const r3a = await putAvail(99992, { is_online: false });
        assert(r3a.status === 200, 'Toggle offline returns 200');
        assert(r3a.body.is_online === false, 'Response confirms is_online=false');

        const [dbOnline] = await pool.query('SELECT is_online FROM worker_profiles WHERE user_id=99992');
        assert(dbOnline[0].is_online === 0, 'DB is_online updated to 0');

        const r3b = await putAvail(99992, { is_online: true });
        assert(r3b.status === 200, 'Toggle back online returns 200');
        assert(r3b.body.is_online === true, 'Response confirms is_online=true');

        // ── Test 4. Offline with active job → warning ─────────────────────────
        console.log('\n--- Test 4. Offline with Active Job → Warning ---');
        await pool.query("UPDATE worker_profiles SET current_job_id=99991 WHERE user_id=99992");
        const r4 = await putAvail(99992, { is_online: false });
        assert(r4.status === 200, 'Goes offline with active job — still 200 (not blocked)');
        assert(typeof r4.body.warning === 'string', 'Warning field present in response');
        assert(r4.body.warning.includes('99991'), 'Warning includes the active job ID');
        await pool.query("UPDATE worker_profiles SET is_online=1, current_job_id=NULL WHERE user_id=99992");

        // ── Test 5. GET /api/jobs/:id/worker-location — customer auth ─────────
        console.log('\n--- Test 5. GET Worker Location (customer, active job) ---');
        const r5 = await getWloc(99991, { id: 99991 });
        assert(r5.status === 200, 'GET /jobs/:id/worker-location returns 200');
        assert(r5.body.data?.lat !== undefined || r5.body.lat !== undefined, 'lat field returned');

        // ── Test 6. GET worker-location guarded against non-customer ──────────
        console.log('\n--- Test 6. GET Worker Location — non-owner blocked ---');
        const r6 = await getWloc(99992, { id: 99991 }); // worker trying to call customer endpoint
        assert(r6.status === 403, 'Non-owner (worker) gets 403 on worker-location endpoint');

        // ── Test 7. GET worker-location on completed job → 400 ───────────────
        console.log('\n--- Test 7. GET Worker Location — completed job blocked ---');
        await pool.query("UPDATE jobs SET status='completed' WHERE id=99991");
        const r7 = await getWloc(99991, { id: 99991 });
        assert(r7.status === 400, 'Completed job status blocks worker-location read — 400');
        assert(r7.body.code === 'INVALID_STATE', 'Error code is INVALID_STATE');

    } catch (err) {
        console.error('Fatal Test Error:', err);
    } finally {
        console.log('\n--- Cleaning Up ---');
        await pool.query('DELETE FROM worker_location_history WHERE worker_id IN (99991, 99992)');
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM worker_profiles WHERE user_id = 99992');
        await pool.query('DELETE FROM customer_profiles WHERE user_id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');
        await pool.end();
        console.log(`\n=== Verification Results: ${passed} / ${total} PASSED ===`);
        setTimeout(() => process.exit(passed === total ? 0 : 1), 200);
    }
}

run();
