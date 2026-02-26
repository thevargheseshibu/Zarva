/**
 * routes/payment.js
 * 
 * ZARVA Payment Engine mapping Razorpay flows securely
 */

import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import { authenticateJWT } from '../middleware/index.js';
import { calculatePricing } from '../utils/pricingEngine.js';

const router = express.Router();

// Helper responses
const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

let razorpayInstance = null;
const initRazorpay = () => {
    if (!razorpayInstance && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }
    return razorpayInstance;
};

// Global Payment Config Evaluator (Mock Intercept)
router.use((req, res, next) => {
    const isEnabled = configLoader.get('features')?.payment?.enabled ?? true;

    // If the path isn't strictly Invoice read-only, intercept if disabled
    if (!isEnabled && !req.path.startsWith('/invoice')) {
        return ok(res, {
            success: true,
            mock: true,
            payment_id: `pay_MOCK_${Date.now()}`,
            message: 'Mock payment (disabled in config)'
        });
    }
    next();
});

// Guard all endpoints
router.use(authenticateJWT);

/**
 * 1. POST /api/payment/create-order
 */
router.post('/create-order', async (req, res) => {
    const userId = req.user?.id;
    const { job_id, payment_type } = req.body;

    if (!job_id || !['advance', 'final'].includes(payment_type)) {
        return fail(res, 'Valid job_id and payment_type (advance/final) required', 400);
    }

    try {
        const pool = getPool();
        const [jobs] = await pool.query('SELECT status, category, scheduled_at FROM jobs WHERE id=$1', [job_id]);
        const job = jobs[0];

        if (!job) return fail(res, 'Job not found', 404);

        // Calculate amount seamlessly
        let amountToCharge = 0;

        if (payment_type === 'advance') {
            const pricingConf = configLoader.get('jobs');
            const estimate = calculatePricing({
                category: job.category,
                hours: pricingConf.categories[job.category].min_hours,
                scheduledAt: job.scheduled_at
            }, pricingConf);
            amountToCharge = estimate.advance_amount;
        } else {
            const [invoices] = await pool.query('SELECT total FROM job_invoices WHERE job_id=$1', [job_id]);
            if (invoices.length === 0) return fail(res, 'Invoice not finalized yet', 400);

            // Subtract already captured advance from the total
            const [advancePay] = await pool.query(`SELECT SUM(amount) as adv FROM payments WHERE job_id=$1 AND type='advance' AND status='captured'`, [job_id]);
            const advanceTotal = parseFloat(advancePay[0]?.adv || 0);

            amountToCharge = parseFloat(invoices[0].total) - advanceTotal;
        }

        if (amountToCharge <= 0) {
            return fail(res, 'Amount due is zero', 400);
        }

        // --- IDEMPOTENCY CHECK ---
        const windowSeconds = configLoader.get('features')?.payment?.idempotency_window_seconds || 300;

        const [existingOrders] = await pool.query(`SELECT razorpay_order_id, amount 
             FROM payments 
             WHERE job_id=$1 AND type=$2 AND status='pending' 
             AND created_at > NOW() - (INTERVAL '1 second' * $3)`, [job_id, payment_type, windowSeconds]
        );

        if (existingOrders.length > 0) {
            console.log(`[Payment] Idempotency lock matched for Job ${job_id} (${payment_type}) natively`);
            return ok(res, {
                order_id: existingOrders[0].razorpay_order_id,
                amount: parseFloat(existingOrders[0].amount),
                currency: 'INR',
                key_id: process.env.RAZORPAY_KEY_ID || 'mock_key_id'
            });
        }

        // --- CREATE NEW ORDER ---
        let razorpayOrderId = `mock_order_${Date.now()}`;
        const amountPaise = Math.round(amountToCharge * 100);

        const rzp = initRazorpay();
        if (rzp) {
            const orderOptions = {
                amount: amountPaise,
                currency: 'INR',
                receipt: `receipt_job_${job_id}`
            };
            const rzpOrder = await rzp.orders.create(orderOptions);
            razorpayOrderId = rzpOrder.id;
        }

        const idempotencyKey = `job_${job_id}_${payment_type}_${Date.now()}`;

        await pool.query(`INSERT INTO payments (job_id, customer_id, type, method, status, amount, razorpay_order_id, idempotency_key) 
             VALUES ($1, $2, $3, 'razorpay', 'pending', $4, $5, $6)`, [job_id, userId, payment_type, amountToCharge, razorpayOrderId, idempotencyKey]
        );

        return ok(res, {
            order_id: razorpayOrderId,
            amount: amountToCharge,
            currency: 'INR',
            key_id: process.env.RAZORPAY_KEY_ID || 'mock_key_id'
        });

    } catch (err) {
        return fail(res, err.message, 500);
    }
});

/**
 * 2. POST /api/payment/verify
 */
router.post('/verify', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return fail(res, 'Missing verification parameters', 400);
    }

    try {
        const pool = getPool();
        const [payments] = await pool.query('SELECT id, status FROM payments WHERE razorpay_order_id=$1', [razorpay_order_id]);

        if (payments.length === 0) return fail(res, 'Order not found', 404);
        if (payments[0].status === 'captured') return ok(res, { success: true, payment_id: payments[0].id, message: 'Already captured' });

        // Crypto HMAC evaluation
        if (process.env.RAZORPAY_KEY_SECRET) {
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return fail(res, 'Invalid signature natively evaluated', 400, 'SIGNATURE_MISMATCH');
            }
        }

        // Mark successfully validated
        await pool.query(`UPDATE payments SET status='captured', razorpay_payment_id=$1, razorpay_signature=$2, captured_at=NOW() WHERE id=$3`, [razorpay_payment_id, razorpay_signature, payments[0].id]
        );

        return ok(res, { success: true, payment_id: payments[0].id });
    } catch (err) {
        console.log(err);
        return fail(res, err.message, 500);
    }
});

/**
 * 3. POST /api/payment/cash-confirm
 */
router.post('/cash-confirm', async (req, res) => {
    const userId = req.user?.id;
    const { job_id, payment_type } = req.body;

    const allowCash = configLoader.get('features')?.payment?.cash_payment_allowed ?? true;
    if (!allowCash) return fail(res, 'Cash payments are currently disabled statically', 403);

    try {
        const pool = getPool();
        const [jobs] = await pool.query('SELECT customer_id FROM jobs WHERE id=$1', [job_id]);

        if (!jobs[0] || jobs[0].customer_id !== userId) return fail(res, 'Job owner forbidden lock', 403);

        const [payments] = await pool.query(`SELECT id FROM payments WHERE job_id=$1 AND type=$2 AND status='pending'`, [job_id, payment_type]
        );

        if (payments.length === 0) return fail(res, 'No pending payment queue found for this type', 404);

        await pool.query(`UPDATE payments SET status='captured', method='cash', captured_at=NOW() WHERE id=$1`, [payments[0].id]
        );

        return ok(res, { success: true, method: 'cash', payment_id: payments[0].id });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

/**
 * 4. GET /api/payment/invoice/:job_id
 */
router.get('/invoice/:job_id', async (req, res) => {
    const userId = req.user?.id;
    const jobId = req.params.job_id;

    try {
        const pool = getPool();
        const [jobs] = await pool.query('SELECT customer_id, worker_id, actual_hours FROM jobs WHERE id=$1', [jobId]);
        const job = jobs[0];

        if (!job || (job.customer_id !== userId && job.worker_id !== userId)) {
            return fail(res, 'Role Isolation bounds locked. Forbidden', 403);
        }

        const [invoices] = await pool.query('SELECT * FROM job_invoices WHERE job_id=$1', [jobId]);
        if (invoices.length === 0) return fail(res, 'Invoice not generated yet', 404);

        const rawInv = invoices[0];

        const [advances] = await pool.query(`SELECT SUM(amount) as total FROM payments WHERE job_id=$1 AND type='advance' AND status='captured'`, [jobId]);
        const paidAdvance = parseFloat(advances[0]?.total || 0);

        // Dynamically restructures schema flat columns back into structured `invoice_breakdown` JSON specs!
        const totalAmount = parseFloat(rawInv.total);

        return ok(res, {
            invoice_number: rawInv.invoice_number,
            actual_hours: job.actual_hours,
            invoice_breakdown: {
                base_amount: parseFloat(rawInv.subtotal) - parseFloat(rawInv.travel_charge),
                travel_charge: parseFloat(rawInv.travel_charge),
                subtotal: parseFloat(rawInv.subtotal),
                platform_fee: parseFloat(rawInv.platform_fee),
                discount: parseFloat(rawInv.discount),
                tax: parseFloat(rawInv.tax),
                total_amount: totalAmount,
                worker_payout: parseFloat(rawInv.subtotal), // Worker earns full subtotal, platform takes fee on top
                advance_amount_paid: paidAdvance,
                balance_due: Number((totalAmount - paidAdvance).toFixed(2))
            }
        });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

export default router;
