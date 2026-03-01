/**
 * routes/jobs.js
 * 
 * HTTP endpoints for Job Pricing Estimates and IDEMPOTENT Creation.
 */

import { Router } from 'express';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import bcrypt from 'bcrypt';
import { getRedisClient } from '../config/redis.js';
import * as JobService from '../services/job.service.js';
import { generateEstimate, calculatePricing } from '../utils/pricingEngine.js';
import { readWorkerPresence } from '../services/firebase.service.js';
import supportService from '../services/supportService.js';

const router = Router();

// Helper responses
const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

/**
 * GET /api/jobs/config
 * Unauthenticated endpoint returning category lists and dynamic questions.
 */
router.get('/config', (req, res) => {
    try {
        const jobsCfg = configLoader.get('jobs');

        // Extract clean categories and questions
        const categories = {};
        const questions = {};

        for (const [key, details] of Object.entries(jobsCfg.categories)) {
            const match = details.label.match(/^([^\w\s]+)\s+(.*)$/u) || details.label.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base})\s+(.*)$/u);
            const icon = match ? match[1] : '🛠️';
            const cleanLabel = match ? match[2] : details.label;

            categories[key] = {
                id: details.id,
                label: cleanLabel,
                icon: icon
            };
            questions[key] = details.questions;
        }

        return ok(res, {
            categories,
            questions,
            global_pricing: jobsCfg.global_pricing
        });
    } catch (err) {
        return fail(res, 'Failed to fetch jobs configuration', 500, 'SERVER_ERROR');
    }
});

/**
 * POST /api/jobs/estimate
 * Dynamically computes mathematical range estimates based on pricing configurations.
 */
router.post('/estimate', (req, res) => {
    const { category, hours, is_emergency, lat, lng } = req.body || {};

    if (!category) {
        return fail(res, 'category is required', 400, 'MISSING_FIELDS');
    }

    try {
        // Assume some heuristic distance calculation based on lat/lng here
        // For estimating simply pass 0 or a mocked 5km until we build matching engine geo features
        const travelKm = (lat && lng) ? 5 : 0;

        const estimate = generateEstimate({
            category,
            hours,
            isEmergency: Boolean(is_emergency),
            travelKm
        }, configLoader.get('jobs'));

        return ok(res, estimate);
    } catch (err) {
        return fail(res, err.message, 400, 'ESTIMATE_ERROR');
    }
});

/**
 * GET /api/jobs
 * List all jobs for the authenticated customer.
 */
router.get('/', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    try {
        const pool = getPool();
        const [jobsWithWorkers] = await pool.query(`
            SELECT 
                j.*,
                COALESCE(wp.name, 'Worker') as worker_name,
                wp.category as worker_category,
                wp.average_rating as worker_rating,
                wp.profile_s3_key as worker_photo,
                (wp.kyc_status = 'approved') as worker_verified,
                (SELECT COUNT(*)::INT FROM reviews r WHERE r.job_id = j.id AND r.reviewer_role = 'customer') as is_reviewed,
                (SELECT score FROM reviews r WHERE r.job_id = j.id AND r.reviewer_role = 'customer' LIMIT 1) as rating_given
            FROM jobs j
            LEFT JOIN worker_profiles wp ON j.worker_id = wp.user_id
            WHERE j.customer_id = $1
            ORDER BY j.created_at DESC
        `, [userId]);

        const bucket = process.env.AWS_BUCKET_NAME;
        const region = process.env.AWS_REGION;

        const formattedJobs = jobsWithWorkers.map(job => {
            const { arrived_at, end_otp_hash, worker_name, worker_rating, worker_photo, worker_category, worker_verified, ...safeJob } = job;
            if (job.worker_id) {
                const w_name = worker_name || 'Worker'; // Base name for the worker
                const photoUrl = worker_photo
                    ? `https://${bucket}.s3.${region}.amazonaws.com/${worker_photo}`
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(w_name)}&background=random`;

                safeJob.worker = {
                    id: job.worker_id,
                    name: w_name,
                    category: worker_category || 'Service',
                    rating: worker_rating, // Raw rating, 0 or null is fine
                    photo: photoUrl,
                    is_verified: !!worker_verified
                };
            }
            safeJob.is_reviewed = !!job.is_reviewed;
            safeJob.ratingGiven = job.rating_given;
            return safeJob;
        });

        return ok(res, { jobs: formattedJobs });
    } catch (err) {
        console.error('[Jobs] API GET / failed for U:' + userId, err);
        return fail(res, 'Internal Error fetching jobs', 500);
    }
});

/**
 * POST /api/jobs
 * Creates a job requiring an idempotency token `X-Idempotency-Key` and user auth.
 */
router.post('/', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
        return fail(res, 'X-Idempotency-Key header is required', 400, 'MISSING_HEADER');
    }

    try {
        const pool = getPool();

        // Check if user is locked due to active disputes
        const concurrencyCheck = await supportService.canUserTakeNewJob(userId);
        if (!concurrencyCheck.can_take) {
            return fail(res, concurrencyCheck.reason, 403, 'CONCURRENCY_LOCKED');
        }

        const { job, is_duplicate } = await JobService.createJob(userId, req.body || {}, idempotencyKey, pool);

        // Ensure returning 200 for BOTH initial creates AND idempotent hits, indicating success.
        // Standard practice for idempotent POST endpoints.
        return ok(res, { job, is_duplicate });

    } catch (err) {
        const status = err.status || 500;
        if (status >= 500) {
            console.error(`[Jobs] Creation failed for U:${userId}:`, err.message);
        }
        return fail(res, err.message, status, 'JOB_CREATION_FAILED');
    }
});

/**
 * DELETE /api/jobs/:id
 * Allows customer to delete a job if it hasn't been assigned yet.
 */
router.delete('/:id', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    try {
        const jobId = req.params.id;
        const pool = getPool();

        const [jobs] = await pool.query('SELECT status FROM jobs WHERE id = $1 AND customer_id = $2', [jobId, userId]);
        if (jobs.length === 0) {
            return fail(res, 'Job not found or unauthorized', 404, 'NOT_FOUND');
        }

        const job = jobs[0];
        if (!['open', 'searching', 'no_worker_found'].includes(job.status)) {
            return fail(res, 'Job cannot be deleted at this stage because a worker is involved. Please cancel or dispute it.', 400, 'CANNOT_DELETE');
        }

        await pool.query('DELETE FROM jobs WHERE id = $1', [jobId]);

        // Cleanup Firebase representation
        const { updateJobNode } = await import('../services/firebase.service.js');
        await updateJobNode(jobId, { status: 'cancelled' });

        return ok(res, { message: 'Job deleted successfully' });
    } catch (err) {
        console.error(`[Jobs] API DELETE /${req.params.id} failed for U:${req.user?.id}`, err);
        return fail(res, 'Internal Error deleting job', 500);
    }
});

/**
 * GET /api/jobs/:id
 * Customer Job Details. Injects plaintext start_otp from Redis if arriving.
 */
router.get('/:id', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    try {
        const jobId = req.params.id;
        if (!jobId || isNaN(parseInt(jobId, 10))) {
            return fail(res, 'Invalid Job ID', 400, 'INVALID_ID');
        }

        const pool = getPool();
        const [jobsWithWorkers] = await pool.query(`
            SELECT 
                j.*,
                COALESCE(wp.name, 'Worker') as worker_name,
                wp.category as worker_category,
                wp.average_rating as worker_rating,
                wp.profile_s3_key as worker_photo,
                wp.total_jobs as worker_jobs,
                wp.last_location_lat as worker_lat,
                wp.last_location_lng as worker_lng,
                j.inspection_expires_at,
                (wp.kyc_status = 'approved') as worker_verified,
                (SELECT COUNT(*)::INT FROM reviews r WHERE r.job_id = j.id AND r.reviewer_role = 'customer') as is_reviewed,
                (SELECT json_build_object('score', score, 'category_scores', category_scores, 'comment', comment) FROM reviews r WHERE r.job_id = j.id AND r.reviewer_role = 'customer' LIMIT 1) as review_details
            FROM jobs j
            LEFT JOIN worker_profiles wp ON j.worker_id = wp.user_id
            WHERE j.id = $1
        `, [jobId]);

        const job = jobsWithWorkers[0];

        // Use loose comparison (==) because req.user.id might be string while job.customer_id is integer
        if (!job || job.customer_id != userId) {
            console.warn(`[Jobs] Job ${req.params.id} not found or mismatch: C:${job?.customer_id} vs U:${userId}`);
            return fail(res, 'Not found', 404, 'NOT_FOUND');
        }

        // Strip sensitive hashes from response
        delete job.start_otp_hash;
        delete job.end_otp_hash;
        delete job.inspection_otp_hash;

        // Build worker sub-object if a worker is assigned
        if (job.worker_id) {
            const bucket = process.env.AWS_BUCKET_NAME;
            const region = process.env.AWS_REGION;
            const w_name = job.worker_name || 'Worker';
            const photoUrl = job.worker_photo
                ? `https://${bucket}.s3.${region}.amazonaws.com/${job.worker_photo}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(w_name)}&background=random`;

            job.worker = {
                id: job.worker_id,
                name: w_name,
                category: job.worker_category || 'Service',
                rating: job.worker_rating,
                photo: photoUrl,
                completed_jobs: job.worker_jobs || 0,
                lat: job.worker_lat,
                lng: job.worker_lng,
                is_verified: !!job.worker_verified
            };
        }

        // Build review sub-object
        job.is_reviewed = !!job.is_reviewed;
        if (job.review_details && typeof job.review_details === 'string') {
            try { job.review = JSON.parse(job.review_details); }
            catch (e) { job.review = job.review_details; }
        } else {
            job.review = job.review_details || null;
        }

        // Remove flattened fields
        delete job.review_details;
        delete job.rating_given;
        delete job.worker_name;
        delete job.worker_rating;
        delete job.worker_photo;
        delete job.worker_category;
        delete job.worker_verified;
        delete job.worker_lat;
        delete job.worker_lng;
        delete job.worker_jobs;

        // Inject plaintext OTPs from Redis based on current job status
        const redisClient = getRedisClient();
        if (['worker_arrived', 'inspection_active'].includes(job.status)) {
            try {
                const otp = await redisClient.get(`zarva:otp:inspection:${job.id}`);
                if (otp) job.inspection_otp = otp;
            } catch (_e) { /* Redis unavailable */ }
        } else if (job.status === 'estimate_submitted') {
            try {
                const otp = await redisClient.get(`zarva:otp:start:${job.id}`);
                if (otp) job.start_otp = otp;
            } catch (_e) { /* Redis unavailable */ }
        }

        return ok(res, { job });
    } catch (err) {
        console.error('[Jobs] Detailed error fetching job:', err);
        return fail(res, 'Internal Error fetching job: ' + err.message, 500);
    }
});

/**
 * PUT /api/jobs/:id
 * Edit an existing job
 */
router.put('/:id', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.id;
    const {
        category,
        description,
        address,
        latitude,
        longitude,
        scheduled_at,
        is_emergency
    } = req.body;

    try {
        const pool = getPool();
        const [jobs] = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
        const job = jobs[0];

        if (!job || job.customer_id !== userId) return fail(res, 'Not found', 404, 'NOT_FOUND');
        if (['completed', 'cancelled', 'no_worker_found'].includes(job.status)) {
            return fail(res, 'Cannot edit a finalized job', 400);
        }

        const updates = {};
        if (category) updates.category = category;
        if (description !== undefined) updates.description = description;
        if (address) updates.address = address;
        if (latitude) updates.latitude = latitude;
        if (longitude) updates.longitude = longitude;
        if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at ? new Date(scheduled_at) : null;
        // is_emergency column doesn't exist in the jobs table, skipping it for now to avoid errors

        if (Object.keys(updates).length === 0) return ok(res, { message: 'No changes provided' });

        const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
        const values = [...Object.values(updates), jobId];

        await pool.query(`UPDATE jobs SET ${setClause} WHERE id = $${Object.keys(updates).length + 1}`, values);

        // If a worker is assigned, we should probably notify them
        if (job.worker_id) {
            console.log(`[Jobs] Job ${jobId} edited. Notifying worker ${job.worker_id}...`);
            // Real-time listeners in the app will update the UI
        }

        return ok(res, { message: 'Job updated successfully' });
    } catch (err) {
        console.error('[Jobs] Edit failed:', err);
        return fail(res, 'Internal Error updating job', 500);
    }
});

/**
 * POST /api/jobs/:id/verify-end-otp
 * Customer provides completion code. Invoices and Finalizes.
 */
router.post('/:id/verify-end-otp', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.id;
    const { otp } = req.body;

    try {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [jobs] = await conn.query('SELECT * FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
            const job = jobs[0];

            if (!job || job.customer_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'pending_completion') throw Object.assign(new Error('Invalid state'), { status: 400 });

            // VALIDATE EXPIRES / ATTEMPTS
            if (!job.end_otp_hash) throw new Error('OTP was never generated');
            const match = await bcrypt.compare(String(otp), job.end_otp_hash);

            if (match) {
                // SUCCESS - INVOICE GENERATION
                const { default: billingService } = await import('../services/billing.service.js');
                console.log(`[OTP Debug] Success for Job ${jobId}. OTP: ${otp}, Hash: ${job.end_otp_hash}`);

                // Finalize exact times and pricing 
                const billDetails = await billingService.stopJobAndBill(jobId, 'customer', conn, 'completed');

                // Draft Invoice Row (Using the BillingService breakdown)
                const invNo = `INV-${Date.now()}-${jobId}`;
                await conn.query(`INSERT INTO job_invoices (job_id, invoice_number, subtotal, platform_fee, travel_charge, discount, tax, total) VALUES ($1, $2, $3, $4, $5, 0, 0, $6)`,
                    [jobId, invNo, billDetails.jobAmount, 0, billDetails.travelCharge, billDetails.totalAmount]
                );

                // Worker Aggregations
                await conn.query(`UPDATE worker_profiles SET total_jobs = total_jobs + 1, current_job_id = NULL WHERE user_id=$1`, [job.worker_id]);

                // Customer Aggregation
                await conn.query(`UPDATE customer_profiles SET total_jobs = total_jobs + 1 WHERE user_id=$1`, [job.customer_id]);

                // Wallet: post job complete entries
                const finalAmountPaise = Math.ceil(billDetails.totalAmount * 100);
                const walletService = await import('../services/wallet.service.js');
                await walletService.postJobCompleteEntries(jobId, finalAmountPaise, job.customer_id, job.worker_id, conn);

                // Cleanup Redis
                const redisClient = getRedisClient();
                await redisClient.del(`zarva:otp:end:${jobId}`);

                await conn.commit();

                // Real Firebase Update
                const { updateJobNode } = await import('../services/firebase.service.js');
                await updateJobNode(jobId, { status: 'completed' });

                return ok(res, { completed: true, invoice: billDetails });

            } else {
                console.log(`[OTP Debug] Failed for Job ${jobId}. Input: ${otp}, Hash: ${job.end_otp_hash}`);
                const attempts = job.end_otp_attempts + 1;
                if (attempts >= 5) {
                    await conn.query(`UPDATE jobs SET status='disputed', end_otp_attempts=$1, dispute_raised_at=NOW(), auto_escalate_at=NOW() + INTERVAL '48 hours' WHERE id=$2`, [attempts, jobId]);
                    await conn.commit();
                    throw Object.assign(new Error('Job disputed due to max attempts'), { status: 403 });
                } else {
                    await conn.query(`UPDATE jobs SET end_otp_attempts=$1 WHERE id=$2`, [attempts, jobId]);
                    await conn.commit();
                    throw Object.assign(new Error('Incorrect completion code'), { status: 400 });
                }
            }
        } catch (txnErr) {
            await conn.rollback();
            throw txnErr;
        } finally {
            conn.release();
        }

    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * 4.4 CANCELLATION ENGINE
 */

/**
 * POST /api/jobs/:id/cancel (Customer)
 */
router.post('/:id/cancel', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.id;

    try {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [jobs] = await conn.query('SELECT status, customer_id, worker_id, cancellation_locked_at FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
            const job = jobs[0];

            if (!job || job.customer_id != userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

            if (['in_progress', 'pending_completion', 'completed', 'disputed', 'cancelled'].includes(job.status)) {
                throw Object.assign(new Error('Work in progress or already finalized. Raise a dispute.'), { status: 403, code: 'CANNOT_CANCEL' });
            }

            if (['assigned', 'worker_en_route'].includes(job.status)) {
                if (job.cancellation_locked_at && new Date() > new Date(job.cancellation_locked_at)) {
                    throw Object.assign(new Error('Too late to cancel. Raise a dispute instead.'), { status: 403, code: 'CANCELLATION_LOCKED' });
                }
            } else if (job.status === 'worker_arrived') {
                throw Object.assign(new Error('Worker has arrived. Too late to cancel. Raise a dispute.'), { status: 403, code: 'CANCELLATION_LOCKED' });
            }

            // Valid Cancellation Process
            await conn.query(`UPDATE jobs SET status='cancelled', chat_enabled=false, cancelled_by='customer', cancel_reason='Customer requested cancellation' WHERE id=$1`, [jobId]);

            if (job.worker_id) {
                await conn.query(`UPDATE worker_profiles SET current_job_id = NULL WHERE user_id=$1`, [job.worker_id]);

                // Real Firebase Update
                const { updateJobNode } = await import('../services/firebase.service.js');
                await updateJobNode(jobId, { status: 'cancelled' });
            }

            // Execute full refund sweep
            const [payments] = await conn.query(`SELECT id, amount FROM payments WHERE job_id=$1 AND status='captured'`, [jobId]);
            for (let payment of payments) {
                await conn.query(`INSERT INTO refund_queue (payment_id, job_id, amount, status) VALUES ($1, $2, $3, 'pending')`, [payment.id, jobId, payment.amount]);
            }

            await conn.commit();
            return ok(res, { cancelled: true, message: 'Job successfully cancelled and refunded' });
        } catch (txnErr) {
            await conn.rollback();
            throw txnErr;
        } finally {
            conn.release();
        }
    } catch (err) {
        return fail(res, err.message, err.status || 500, err.code || 'CANCEL_ERROR');
    }
});

/**
 * POST /api/jobs/:id/dispute (Customer)
 */
router.post('/:id/dispute', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.id;
    const { reason } = req.body;

    if (!reason) return fail(res, 'reason field is required for dispute', 400);

    try {
        const pool = getPool();
        const [jobs] = await pool.query('SELECT status, customer_id, worker_id FROM jobs WHERE id = $1', [jobId]);
        const job = jobs[0];

        if (!job || job.customer_id != userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

        if (job.status === 'completed' || job.status === 'cancelled') {
            throw Object.assign(new Error('Job is finalized.'), { status: 400 });
        }

        await pool.query(`UPDATE jobs SET chat_enabled=false, status='disputed', dispute_reason=$1, dispute_raised_at=NOW(), auto_escalate_at=NOW() + INTERVAL '48 hours' WHERE id=$2`, [reason, jobId]
        );

        // Real Firebase Update
        const { updateJobNode } = await import('../services/firebase.service.js');
        await updateJobNode(jobId, { status: 'disputed' });

        return ok(res, { disputed: true, message: 'Dispute submitted. Admin will review within 48h.' });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * POST /api/jobs/:id/extension/approve (Customer)
 */
router.post('/:id/extension/approve', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.id;
    const { otp } = req.body;

    try {
        const billingService = (await import('../services/billing.service.js')).default;
        await billingService.approveExtension(jobId, otp, userId);

        const redisClient = getRedisClient();
        await redisClient.del(`zarva:otp:extension:${jobId}`);

        return ok(res, { approved: true });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * POST /api/jobs/:id/extension/reject (Customer)
 */
router.post('/:id/extension/reject', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.id;

    try {
        const billingService = (await import('../services/billing.service.js')).default;
        await billingService.rejectExtension(jobId, userId);
        return ok(res, { rejected: true });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * POST /api/jobs/:id/stop (Customer Stops Job Early)
 */
router.post('/:id/stop', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.id;

    try {
        const pool = getPool();
        const [jobs] = await pool.query('SELECT status, customer_id FROM jobs WHERE id = $1', [jobId]);
        const job = jobs[0];

        if (!job || job.customer_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
        if (job.status !== 'in_progress') throw Object.assign(new Error('Job is not in progress'), { status: 400 });

        const { default: billingService } = await import('../services/billing.service.js');
        const billInfo = await billingService.stopJobAndBill(jobId, 'customer');

        return ok(res, { stopped: true, billInfo });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

// ── NEW LIFECYCLE ROUTES ──────────────────────────────────────────────────────

/**
 * POST /api/jobs/:id/inspection/approve-extension
 * Customer approves inspection extension with OTP
 */
router.post('/:id/inspection/approve-extension', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
    try {
        const { otp } = req.body;
        if (!otp) return fail(res, 'OTP is required', 400);
        const { default: billingService } = await import('../services/billing.service.js');
        const result = await billingService.approveInspectionExtension(req.params.id, otp, userId);
        return ok(res, result);
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * POST /api/jobs/:id/reject-estimate
 * Customer rejects submitted estimate → cancel with inspection fee only
 */
router.post('/:id/reject-estimate', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
    try {
        const { default: billingService } = await import('../services/billing.service.js');
        const result = await billingService.rejectEstimate(req.params.id, userId);
        return ok(res, result);
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * POST /api/jobs/:id/approve-pause
 * Customer approves worker's pause request via OTP
 */
router.post('/:id/approve-pause', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
    try {
        const { otp } = req.body;
        if (!otp) return fail(res, 'OTP is required', 400);
        const { default: billingService } = await import('../services/billing.service.js');
        const result = await billingService.approvePause(req.params.id, otp, userId);
        return ok(res, result);
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * POST /api/jobs/:id/approve-resume
 * Customer approves worker's resume request via OTP
 */
router.post('/:id/approve-resume', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
    try {
        const { otp } = req.body;
        if (!otp) return fail(res, 'OTP is required', 400);
        const { default: billingService } = await import('../services/billing.service.js');
        const result = await billingService.approveResume(req.params.id, otp, userId);
        return ok(res, result);
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * POST /api/jobs/:id/approve-suspend
 * Customer approves worker's reschedule/suspend request via OTP
 */
router.post('/:id/approve-suspend', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
    try {
        const { otp } = req.body;
        if (!otp) return fail(res, 'OTP is required', 400);
        const { default: billingService } = await import('../services/billing.service.js');
        const result = await billingService.approveSuspend(req.params.id, otp, userId);
        return ok(res, result);
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * POST /api/jobs/:id/customer-stop
 * Customer stops work early — opens 5-min safe-stop window
 */
router.post('/:id/customer-stop', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
    try {
        const { default: billingService } = await import('../services/billing.service.js');
        const result = await billingService.customerStopWork(req.params.id, userId);
        return ok(res, result);
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/**
 * GET /api/jobs/:id/bill-preview
 * Returns itemized bill preview (inspection+travel+labor+materials) with 10-min window
 */
router.get('/:id/bill-preview', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
    try {
        const pool = getPool();
        const [rows] = await pool.query('SELECT customer_id FROM jobs WHERE id=$1', [req.params.id]);
        if (!rows[0] || rows[0].customer_id != userId) return fail(res, 'Forbidden', 403);
        const { default: billingService } = await import('../services/billing.service.js');
        const preview = await billingService.generateBillPreview(req.params.id);
        return ok(res, { preview });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

export default router;


// ─── GET /api/jobs/:id/worker-location ────────────────────────────────────────
// Customer: get live worker GPS for their active job
router.get('/:id/worker-location', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = Number(req.params.id);
    const ACTIVE_STATUSES = ['assigned', 'worker_en_route', 'worker_arrived', 'in_progress'];

    try {
        const pool = getPool();
        const [jobs] = await pool.query('SELECT customer_id, worker_id, status FROM jobs WHERE id=$1', [jobId]
        );
        const job = jobs[0];

        if (!job) return fail(res, 'Job not found', 404);
        if (job.customer_id != userId) return fail(res, 'Forbidden', 403, 'FORBIDDEN');
        if (!ACTIVE_STATUSES.includes(job.status)) {
            return fail(res, `Worker location only available when job is active (current: ${job.status})`, 400, 'INVALID_STATE');
        }

        const presence = await readWorkerPresence(job.worker_id);
        if (!presence) return fail(res, 'Worker location unavailable', 503);

        return ok(res, {
            lat: presence.lat,
            lng: presence.lng,
            last_seen: presence.last_seen,
            eta_minutes: presence.eta_minutes || null,
            is_mock: presence._mock || false
        });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});
