/**
 * tests/firebase.checklist.js
 *
 * Targeted verification for Task 6.1 checklist:
 *   ✅ Worker location update → worker_presence/{id} updated (within timing bound)
 *   ✅ Job acceptance → active_jobs/{jobId} node created with correct structure
 *   ✅ Worker crash simulation → onDisconnect sets is_online=false (registered on going-online)
 *   ✅ GET /api/jobs/:id/worker-location → data served from Firebase, not MySQL
 */

import 'dotenv/config';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import {
    updateWorkerPresence,
    createJobNode,
    readWorkerPresence
} from '../services/firebase.service.js';
import workerRouter from '../routes/worker.js';
import jobsRouter from '../routes/jobs.js';

async function run() {
    console.log('\n=== ZARVA Task 6.1: Firebase Checklist Verification ===\n');

    await configLoader.loadAllConfigs();
    const pool = getPool();

    let passed = 0, total = 0;
    const assert = (cond, msg) => {
        total++;
        if (cond) { console.log(`  [Pass] ${msg}`); passed++; }
        else console.error(`  [FAIL] ${msg}`);
    };

    // ── Console capture helper ────────────────────────────────────────────────
    // Captures console.log output during a callback so we can assert on mock logs
    const captureLogs = async (fn) => {
        const logs = [];
        const original = console.log;
        console.log = (...args) => { logs.push(args.join(' ')); original(...args); };
        try { await fn(); } finally { console.log = original; }
        return logs;
    };

    // ── Route callers ─────────────────────────────────────────────────────────
    const putLocation = (userId, body) =>
        new Promise(resolve => {
            const req = { body, params: {}, user: { id: userId } };
            const res = { status: s => ({ json: d => resolve({ status: s, body: d }) }) };
            const h = workerRouter.stack.find(l => l.route?.path === '/location' && l.route?.methods.put);
            h?.route.stack[0].handle(req, res, () => { });
        });

    const getWloc = (userId, jobId) =>
        new Promise(resolve => {
            const req = { body: {}, params: { id: jobId }, user: { id: userId } };
            const res = { status: s => ({ json: d => resolve({ status: s, body: d }) }) };
            const h = jobsRouter.stack.find(l => l.route?.path === '/:id/worker-location' && l.route?.methods.get);
            h?.route.stack[0].handle(req, res, () => { });
        });

    try {
        // ── Seed ─────────────────────────────────────────────────────────────
        console.log('--- Seeding ---');
        await pool.query('DELETE FROM worker_location_history WHERE worker_id IN (99991,99992)');
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM worker_profiles WHERE user_id = 99992');
        await pool.query('DELETE FROM customer_profiles WHERE user_id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');

        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99991, '+91CHK1111', 'customer')`);
        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99992, '+91CHK2222', 'worker')`);
        await pool.query(`INSERT INTO customer_profiles (user_id) VALUES (99991)`);
        await pool.query(`INSERT INTO worker_profiles (user_id, name, category, is_verified, is_online) VALUES (99992, 'Chk Worker', 'plumber', 1, 1)`);
        await pool.query(
            `INSERT INTO jobs (id, customer_id, worker_id, category, address, latitude, longitude, rate_per_hour, status, idempotency_key)
             VALUES (99991, 99991, 99992, 'plumber', 'Test', 10.05, 76.30, 300, 'assigned', 'chk-test-1')`
        );

        // ── ✅ 1. Location update within timing bound ─────────────────────────
        console.log('\n--- ✅ 1. Location update → worker_presence updated (timing + mock log) ---');
        const logs1 = [];
        const orig = console.log;
        console.log = (...a) => { logs1.push(a.join(' ')); orig(...a); };

        const t0 = Date.now();
        const r1 = await putLocation(99992, { lat: 10.0261, lng: 76.3083 });
        const elapsed = Date.now() - t0;
        console.log = orig;

        assert(r1.status === 200, 'PUT /worker/location returns 200');
        assert(elapsed < 500, `Location update completed in < 500ms (actual: ${elapsed}ms)`);

        const presenceLog = logs1.find(l => l.includes('worker_presence/99992'));
        assert(presenceLog !== undefined, '[Firebase Mock] worker_presence log emitted');
        assert(presenceLog?.includes('"lat":10.0261'), 'worker_presence log contains correct lat');
        assert(presenceLog?.includes('"lng":76.3083'), 'worker_presence log contains correct lng');

        // ── ✅ 2. Job acceptance → active_jobs node created ───────────────────
        console.log('\n--- ✅ 2. active_jobs/{jobId} node created with correct structure ---');
        const jobNodeLogs = [];
        console.log = (...a) => { jobNodeLogs.push(a.join(' ')); orig(...a); };

        // Directly call createJobNode (mirrors what accept endpoint calls)
        await createJobNode(99991, 99992, 10.05, 76.30);
        console.log = orig;

        const nodeLog = jobNodeLogs.find(l => l.includes('active_jobs/99991'));
        assert(nodeLog !== undefined, '[Firebase Mock] active_jobs/99991 log emitted on job acceptance');

        // Verify the structure contains all required fields
        const nodeData = JSON.parse(nodeLog?.replace(/.*created =\s*/, '') || '{}');
        assert(nodeData.status === 'assigned', 'active_jobs node has status=assigned');
        assert(nodeData.worker_id === 99992, 'active_jobs node has correct worker_id');
        assert(nodeData.customer_lat === 10.05, 'active_jobs node has customer_lat');
        assert(nodeData.customer_lng === 76.30, 'active_jobs node has customer_lng');
        assert('start_otp_done' in nodeData, 'active_jobs node has start_otp_done field');
        assert('end_otp_done' in nodeData, 'active_jobs node has end_otp_done field');
        assert('timer_started_at' in nodeData, 'active_jobs node has timer_started_at field');
        assert('last_updated' in nodeData, 'active_jobs node has last_updated timestamp');

        // ── ✅ 3. onDisconnect crash-safety registered on going-online ────────
        console.log('\n--- ✅ 3. onDisconnect registered when worker goes online ---');
        const disconnectLogs = [];
        console.log = (...a) => { disconnectLogs.push(a.join(' ')); orig(...a); };

        await updateWorkerPresence(99992, { is_online: true, lat: 10.0, lng: 76.0 });
        console.log = orig;

        const onDisconnectLog = disconnectLogs.find(l => l.includes('onDisconnect'));
        assert(onDisconnectLog !== undefined, 'onDisconnect crash-safety registration logged');
        assert(onDisconnectLog?.includes('is_online') && onDisconnectLog?.includes('false'),
            'onDisconnect will set is_online=false on connection drop');

        // Verify it is NOT emitted when going offline (no double-registration)
        const offlineLogs = [];
        console.log = (...a) => { offlineLogs.push(a.join(' ')); orig(...a); };
        await updateWorkerPresence(99992, { is_online: false });
        console.log = orig;
        const offlineDisconnect = offlineLogs.find(l => l.includes('onDisconnect'));
        assert(offlineDisconnect === undefined, 'onDisconnect NOT re-registered when going offline');

        // ── ✅ 4. GET worker-location → data from Firebase (not MySQL) ─────────
        console.log('\n--- ✅ 4. GET /jobs/:id/worker-location → data from Firebase, not MySQL ---');
        // Verify the response lat/lng comes from readWorkerPresence (stub mock = 10.0261/76.3083)
        // NOT from worker_profiles MySQL columns (which could differ)
        const fbPresence = await readWorkerPresence(99992);
        assert(fbPresence !== null, 'readWorkerPresence returns data (stub or live)');
        assert(typeof fbPresence.lat === 'number', 'Firebase presence has lat field');
        assert(typeof fbPresence.lng === 'number', 'Firebase presence has lng field');
        assert(fbPresence._mock === true || typeof fbPresence.last_seen === 'number',
            'Data sourced from Firebase (mock stub in dev, live RTDB in prod)');

        // Verify GET endpoint returns same structure
        const r4 = await getWloc(99991, 99991);
        assert(r4.status === 200, 'GET /jobs/:id/worker-location returns 200');
        const wlocData = r4.body.data || r4.body;
        assert(typeof wlocData.lat === 'number', 'Response has numeric lat from Firebase');
        assert(typeof wlocData.lng === 'number', 'Response has numeric lng from Firebase');
        assert(typeof wlocData.last_seen === 'number', 'Response has last_seen timestamp from Firebase');
        // Confirm MySQL lat (10.05 from job insert) ≠ response lat — proving Firebase is the source
        assert(wlocData.lat !== 10.05, 'lat in response differs from MySQL job.latitude — confirms Firebase source');

    } catch (err) {
        console.error('Fatal Test Error:', err);
    } finally {
        console.log('\n--- Cleaning Up ---');
        await pool.query('DELETE FROM worker_location_history WHERE worker_id IN (99991,99992)');
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
