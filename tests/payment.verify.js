/**
 * tests/payment.verify.js
 * 
 * Comprehensive Verification Suite for ZARVA Task 4.5
 * - Feature Flag overrides dynamically evaluate Mock executions
 * - Idempotency generation bounds prevent Double Charges effectively
 * - Razorpay native SDK generations
 * - Crypto SHA256 Verification checks
 * - Dynamic Job Invoices flattening structures natively
 */

import 'dotenv/config';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import paymentRouter from '../routes/payment.js';
import crypto from 'crypto';

async function run() {
    console.log('\n=== ZARVA Task 4.5: Payment Engine Verification ===\n');

    await configLoader.loadAllConfigs();
    const pool = getPool();

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

    /** MOCK REQUEST ENGINE */
    const mockRequest = async (router, method, path, userId, body = {}) => {
        return new Promise((resolve) => {
            const req = {
                method, url: path, body, params: { job_id: 99991 }, user: { id: userId }, path: path.replace('/:job_id', '/99991')
            };
            const res = {
                status: (s) => ({
                    json: (data) => resolve({ status: s, body: data })
                })
            };

            const reqPath = path.split('?')[0];

            let matchedRoute = null;
            let middlewareFn = null;

            router.stack.forEach(r => {
                if (r.name === '<anonymous>' || r.name === 'router') {
                    // It's the global middleware config mock flag logic! We explicitly need to run this.
                    middlewareFn = r.handle;
                }
                if (r.route?.path === reqPath && r.route?.methods[method.toLowerCase()]) {
                    matchedRoute = r.route.stack[0].handle;
                }
            });

            if (!matchedRoute) resolve({ status: 404, body: { message: 'Route not found' } });

            // Execute global middleware flag parser first
            middlewareFn(req, res, () => {
                matchedRoute(req, res, () => { });
            });
        });
    };

    try {
        console.log('\n--- Environment Setup ---');
        await pool.query('DELETE FROM refund_queue WHERE job_id = 99991');
        await pool.query('DELETE FROM payments WHERE job_id = 99991');
        await pool.query('DELETE FROM job_invoices WHERE job_id = 99991');
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');

        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99991, '+91PAYT1111', 'customer')`);
        await pool.query(`INSERT INTO users (id, phone, role) VALUES (99992, '+91PAYT2222', 'worker')`);

        await pool.query(
            `INSERT INTO jobs (id, customer_id, worker_id, category, address, latitude, longitude, rate_per_hour, idempotency_key, status) 
             VALUES (99991, 99991, 99992, 'plumber', 'Mock', 10, 10, 300, 'test-pay', 'completed')`
        );

        await pool.query(
            `INSERT INTO job_invoices (job_id, invoice_number, subtotal, platform_fee, travel_charge, discount, tax, total) 
             VALUES (99991, 'INV-TEST', 800, 40, 50, 0, 0, 890)`
        );

        console.log('\n--- Test 1. Verify Global Config Mock ---');
        // Let's manually flip the feature tracker for a second
        const feats = configLoader.get('features');
        const originalConf = feats.payment.enabled;
        feats.payment.enabled = false;

        const resMock = await mockRequest(paymentRouter, 'POST', '/create-order', 99991, { job_id: 99991, payment_type: 'advance' });
        assert(resMock.status === 200, "If config payment.enabled is False, immediately returns 200");
        assert(resMock.body.mock === true || resMock.body.data?.mock === true, "Payload elegantly returns mock=true gracefully");

        feats.payment.enabled = originalConf; // reset


        console.log('\n--- Test 2. Cash Confirmation Engine ---');
        const resCash = await mockRequest(paymentRouter, 'POST', '/cash-confirm', 99991, { job_id: 99991, payment_type: 'final' });
        // Fails correctly because there is no pending record to authorize cash against
        assert(resCash.status === 404, "Cash trigger blocks natively if no queued 'pending' payment exists implicitly");


        console.log('\n--- Test 3. Order Generation (Advance) ---');
        const res1 = await mockRequest(paymentRouter, 'POST', '/create-order', 99991, { job_id: 99991, payment_type: 'advance' });

        if (res1.status !== 200) console.log('ERROR TRACE:', res1.body);

        assert(res1.status === 200, "Advance creation successfully computes algorithms returning Razorpay payload cleanly");
        assert(res1.body.data?.order_id.toString().length > 0, "Returns absolute razorpay_order_id effectively");
        assert(res1.body.data?.amount > 0, "Amount statically resolved mapping the base limits cleanly");

        const trackedOrderId = res1.body.data.order_id;


        console.log('\n--- Test 4. Idempotency Lock Enforcement ---');
        // Let's immediately retrigger the exact same POST request!
        const res2 = await mockRequest(paymentRouter, 'POST', '/create-order', 99991, { job_id: 99991, payment_type: 'advance' });
        assert(res2.status === 200, "Idempotency duplicate request parses 200 OK without crashing server bounds");
        assert(res2.body.data?.order_id === trackedOrderId, "STRICT: Returned exactly the same explicit order ID locking duplication vulnerabilities!");

        const [payCheck] = await pool.query('SELECT COUNT(*) as count FROM payments WHERE job_id=99991');
        assert(payCheck[0].count === 1, "Database definitively only inserted 1 Row natively. Double charge prevented.");


        console.log('\n--- Test 5. HMAC Sha256 Signature Integrations ---');
        process.env.RAZORPAY_KEY_SECRET = 'TEST_SECRET_MOCK_123';

        // Generate a valid theoretical signature natively:
        const dummyPaymentId = 'pay_MOCK123985';
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(trackedOrderId + "|" + dummyPaymentId)
            .digest('hex');

        // Execute valid Verification Trigger
        const resV1 = await mockRequest(paymentRouter, 'POST', '/verify', 99991, {
            razorpay_order_id: trackedOrderId, razorpay_payment_id: dummyPaymentId, razorpay_signature: expectedSignature
        });

        assert(resV1.status === 200, "Crypto successfully verifies perfect SHA256 HMAC structures gracefully");
        assert(resV1.body.data?.payment_id !== undefined, "Verification successfully binds the ID natively");

        // Verify status captured natively
        const [vDB] = await pool.query("SELECT status, razorpay_payment_id FROM payments WHERE id=?", [resV1.body.data.payment_id]);
        assert(vDB[0].status === 'captured', "Database mutated tracking structure securely to CAPTURED");

        // --- Tampered signature must 400 (use a fresh pending row so HMAC check is reached) ---
        const tamperOrderId = `mock_tamper_${Date.now()}`;
        await pool.query(
            `INSERT INTO payments (job_id, customer_id, type, method, status, amount, razorpay_order_id, idempotency_key)
             VALUES (99991, 99991, 'advance', 'razorpay', 'pending', 50, ?, ?)`,
            [tamperOrderId, `tamper_key_${Date.now()}`]
        );
        const resTamper = await mockRequest(paymentRouter, 'POST', '/verify', 99991, {
            razorpay_order_id: tamperOrderId,
            razorpay_payment_id: 'pay_tamper123',
            razorpay_signature: 'TAMPERED_INVALID_SIGNATURE_XYZ'
        });
        assert(resTamper.status === 400, "Tampered signature correctly rejected with 400");
        assert(resTamper.body.code === 'SIGNATURE_MISMATCH', "Error code is SIGNATURE_MISMATCH");


        console.log('\n--- Test 6. Dynamic JSON Invoice Generation ---');
        const resInv = await mockRequest(paymentRouter, 'GET', '/invoice/:job_id', 99991);

        assert(resInv.status === 200, "GET /api/payment/invoice/:job_id successes cleanly");

        const invPayload = resInv.body.data?.invoice_breakdown;
        assert(invPayload !== undefined, "JSON dynamic flattening executes formatting specs natively");
        assert(invPayload.subtotal === 800, "Raw DB numeric casts exactly to the specs");
        assert(invPayload.platform_fee === 40, "Platform metric pulled statically gracefully");
        assert(invPayload.total_amount === 890, "Totals reflect purely exactly");
        assert(invPayload.worker_payout === invPayload.subtotal, "worker_payout strictly equals subtotal (not total_amount)");
        assert(invPayload.worker_payout !== invPayload.total_amount, "worker_payout correctly != total_amount (platform fee not included in payout)");
        // Because of the advance payment capturing successfully in test 5, advance deductions should show up!
        assert(invPayload.advance_amount_paid > 0, "Advance calculations successfully integrated into Final Due aggregations cleanly!");


    } catch (err) {
        console.error('Fatal Test Error:', err);
    } finally {
        console.log('\n--- Cleaning Up ---');
        await pool.query('DELETE FROM refund_queue WHERE job_id = 99991');
        await pool.query('DELETE FROM payments WHERE job_id = 99991');
        await pool.query('DELETE FROM job_invoices WHERE job_id = 99991');
        await pool.query('DELETE FROM jobs WHERE id = 99991');
        await pool.query('DELETE FROM users WHERE id IN (99991, 99992)');
        await pool.end();

        console.log(`\n=== Verification Results: ${assertsPassed} / ${assertsTotal} PASSED ===`);
        setTimeout(() => process.exit(assertsPassed === assertsTotal ? 0 : 1), 200);
    }
}

run();
