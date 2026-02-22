/**
 * tests/review.verify.js
 * 
 * Targeted verification for Task 5.2 checklist:
 *   ✅ POST returns 201 for valid review
 *   ✅ POST after 24h → 403 'Review window closed'
 *   ✅ Duplicate POST → 409
 *   ✅ average_rating recalculated from all reviews
 *   ✅ Word 'fraud' → is_flagged=true
 */

import 'dotenv/config';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import reviewsRouter from '../routes/reviews.js';

async function run() {
    console.log('\n=== ZARVA Task 5.2: Review System Checklist Verification ===\n');

    await configLoader.loadAllConfigs();
    const pool = getPool();

    let passed = 0, total = 0;
    const assert = (cond, msg) => {
        total++;
        if (cond) { console.log(`  [Pass] ${msg}`); passed++; }
        else console.error(`  [FAIL] ${msg}`);
    };

    const postReview = (userId, body) =>
        new Promise(resolve => {
            const req = { method: 'POST', body, params: {}, user: userId ? { id: userId } : undefined };
            const res = { status: s => ({ json: d => resolve({ status: s, body: d }) }) };
            const handler = reviewsRouter.stack.find(l => l.route?.path === '/' && l.route?.methods.post);
            handler?.route.stack[0].handle(req, res, () => { });
        });

    const getWorkerReviews = callerId =>
        new Promise(resolve => {
            const req = { method: 'GET', body: {}, params: { user_id: 99992 }, user: callerId ? { id: callerId } : undefined };
            const res = { status: s => ({ json: d => resolve({ status: s, body: d }) }) };
            const handler = reviewsRouter.stack.find(l => l.route?.path === '/worker/:user_id' && l.route?.methods.get);
            handler?.route.stack[0].handle(req, res, () => { });
        });

    const getCustomerReviews = callerId =>
        new Promise(resolve => {
            const req = { method: 'GET', body: {}, params: { user_id: 99991 }, user: callerId ? { id: callerId } : undefined };
            const res = { status: s => ({ json: d => resolve({ status: s, body: d }) }) };
            const handler = reviewsRouter.stack.find(l => l.route?.path === '/customer/:user_id' && l.route?.methods.get);
            handler?.route.stack[0].handle(req, res, () => { });
        });

    try {
        // ── Seed ─────────────────────────────────────────────────────────────
        console.log('--- Seeding ---');
        await pool.query('DELETE FROM reviews WHERE job_id IN (99991, 99992)');
        await pool.query('DELETE FROM job_invoices WHERE job_id IN (99991, 99992)');
        await pool.query('DELETE FROM payments WHERE job_id IN (99991, 99992)');
        await pool.query('DELETE FROM jobs WHERE id IN (99991, 99992)');
        await pool.query('DELETE FROM worker_profiles WHERE user_id = 99992');
        await pool.query('DELETE FROM customer_profiles WHERE user_id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');

        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99991, '+91REV1111', 'customer')`);
        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99992, '+91REV2222', 'worker')`);
        await pool.query(`INSERT INTO customer_profiles (user_id) VALUES (99991)`);
        await pool.query(`INSERT INTO worker_profiles (user_id, name, category, is_verified) VALUES (99992, 'Rev Worker', 'plumber', 1)`);

        // Job completed NOW (within 24h window)
        await pool.query(
            `INSERT INTO jobs (id, customer_id, worker_id, category, address, latitude, longitude, rate_per_hour, status, end_otp_verified_at, idempotency_key)
             VALUES (99991, 99991, 99992, 'plumber', 'Test', 10, 10, 300, 'completed', NOW(), 'rev-test-ok')`
        );
        // Job completed 48h AGO (outside window)
        await pool.query(
            `INSERT INTO jobs (id, customer_id, worker_id, category, address, latitude, longitude, rate_per_hour, status, end_otp_verified_at, idempotency_key)
             VALUES (99992, 99991, 99992, 'plumber', 'Test', 10, 10, 300, 'completed', DATE_SUB(NOW(), INTERVAL 48 HOUR), 'rev-test-old')`
        );

        // ── ✅ 1. Valid review within 24h → 201 ──────────────────────────────
        console.log('\n--- ✅ 1. Valid review within window → 201 ---');
        const r1 = await postReview(99991, {
            job_id: 99991,
            overall_score: 4,
            category_scores: { punctuality: 4, communication: 5, professionalism: 4 },
            comment: 'Good job overall.'
        });
        assert(r1.status === 201, 'POST /api/reviews returns HTTP 201 Created');
        assert(r1.body.data?.submitted === true, 'submitted=true in response');
        assert(r1.body.data?.reviewer_role === 'customer', 'reviewer_role=customer');

        // ── ✅ 2. Submit after 24h → 403 'Review window closed' ─────────────
        console.log('\n--- ✅ 2. Submit after 24h → 403 ---');
        const r2 = await postReview(99991, {
            job_id: 99992,      // completed 48h ago
            overall_score: 3,
            category_scores: {}
        });
        assert(r2.status === 403, 'POST after 24h returns 403');
        assert(r2.body.message === 'Review window closed', "Error message is exactly 'Review window closed'");
        assert(r2.body.code === 'WINDOW_EXPIRED', 'Error code is WINDOW_EXPIRED');

        // ── ✅ 3. Duplicate review → 409 ─────────────────────────────────────
        console.log('\n--- ✅ 3. Duplicate review → 409 ---');
        const r3 = await postReview(99991, {
            job_id: 99991,      // already reviewed in test 1
            overall_score: 5,
            category_scores: {}
        });
        assert(r3.status === 409, 'Second review for same job → 409');
        assert(r3.body.code === 'DUPLICATE_REVIEW', 'Error code is DUPLICATE_REVIEW');

        // ── ✅ 4. avg_rating recalculated from all reviews ───────────────────
        console.log('\n--- ✅ 4. avg_rating recalculated from all reviews ---');
        // Current: 1 review with score 4 → avg should be 4.00
        const [wp1] = await pool.query('SELECT average_rating, rating_count FROM worker_profiles WHERE user_id=99992');
        assert(parseFloat(wp1[0].average_rating) === 4.00, 'average_rating = 4.00 after one score-4 review');

        // Worker now reviews the customer on the same job → customer_profiles updated
        const rW = await postReview(99992, {
            job_id: 99991,
            overall_score: 3,
            category_scores: { cleanliness: 3, friendliness: 3, payment_promptness: 3 },
            comment: 'Decent customer.'
        });
        assert(rW.status === 201, 'Worker review also returns 201');

        const [cp] = await pool.query('SELECT average_rating, rating_count FROM customer_profiles WHERE user_id=99991');
        assert(parseFloat(cp[0].average_rating) === 3.00, 'Customer average_rating recalculated to 3.00');
        assert(cp[0].rating_count === 1, 'Customer rating_count incremented to 1');

        // Now verify avg across multiple reviews — insert a second job completed now for a second customer review
        await pool.query(
            `INSERT INTO jobs (id, customer_id, worker_id, category, address, latitude, longitude, rate_per_hour, status, end_otp_verified_at, idempotency_key)
             VALUES (99993, 99991, 99992, 'plumber', 'Test2', 10, 10, 300, 'completed', NOW(), 'rev-test-avg')
            ON DUPLICATE KEY UPDATE id=99993`
        );
        const rAvg = await postReview(99991, {
            job_id: 99993,
            overall_score: 2, // avg should now be (4+2)/2 = 3.00
            category_scores: { punctuality: 2, communication: 2, professionalism: 2 }
        });
        assert(rAvg.status === 201, 'Second score-2 review submitted (201)');
        const [wp2] = await pool.query('SELECT average_rating, rating_count FROM worker_profiles WHERE user_id=99992');
        assert(parseFloat(wp2[0].average_rating) === 3.00, 'average_rating correctly recalculated to 3.00 from (4+2)/2');
        assert(wp2[0].rating_count === 2, 'rating_count now 2');

        // ── ✅ 5. Word 'fraud' → is_flagged=true ─────────────────────────────
        console.log('\n--- ✅ 5. "fraud" keyword → is_flagged=true ---');
        await pool.query(
            `INSERT INTO jobs (id, customer_id, worker_id, category, address, latitude, longitude, rate_per_hour, status, end_otp_verified_at, idempotency_key)
             VALUES (99994, 99991, 99992, 'plumber', 'Test3', 10, 10, 300, 'completed', NOW(), 'rev-test-flag')
            ON DUPLICATE KEY UPDATE id=99994`
        );
        const rFlag = await postReview(99991, {
            job_id: 99994,
            overall_score: 1,
            category_scores: { punctuality: 1, communication: 1, professionalism: 1 },
            comment: 'This worker is a total fraud, stay away!'
        });
        assert(rFlag.status === 201, 'Flagged review still returns 201 (not blocked, just flagged)');
        assert(rFlag.body.data?.is_flagged === true, 'Response payload has is_flagged=true');

        const [flagRow] = await pool.query('SELECT is_flagged FROM reviews WHERE job_id=99994');
        assert(flagRow[0]?.is_flagged === 1, "DB stores is_flagged=1 for comment containing 'fraud'");

        // ── ✅ 6. GET endpoints ───────────────────────────────────────────────
        console.log('\n--- ✅ 6. GET endpoints ---');
        const rGetW = await getWorkerReviews(null); // public — no auth needed
        assert(rGetW.status === 200, 'GET /worker/:id returns 200 (public)');
        assert(rGetW.body.data?.reviews?.length >= 1, 'At least one worker review returned');

        const rGetCFail = await getCustomerReviews(99991); // customer caller → 403
        assert(rGetCFail.status === 403, 'GET /customer/:id returns 403 for non-worker');

        const rGetCOk = await getCustomerReviews(99992); // worker caller → 200
        assert(rGetCOk.status === 200, 'GET /customer/:id returns 200 for worker caller');

    } catch (err) {
        console.error('Fatal Test Error:', err);
    } finally {
        console.log('\n--- Cleaning Up ---');
        await pool.query('DELETE FROM reviews WHERE job_id IN (99991,99992,99993,99994)');
        await pool.query('DELETE FROM jobs WHERE id IN (99991,99992,99993,99994)');
        await pool.query('DELETE FROM worker_profiles WHERE user_id = 99992');
        await pool.query('DELETE FROM customer_profiles WHERE user_id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');
        await pool.end();
        console.log(`\n=== Verification Results: ${passed} / ${total} PASSED ===`);
        setTimeout(() => process.exit(passed === total ? 0 : 1), 200);
    }
}

run();
