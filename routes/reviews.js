/**
 * routes/reviews.js
 * 
 * ZARVA Review System — immutable, role-aware, time-gated reviews
 */

import { Router } from 'express';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';

const router = Router();

const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

// ─────────────────────────────────────────────────────────
// POST /api/reviews
// ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const { job_id, overall_score, category_scores = {}, comment } = req.body;
    if (!job_id || overall_score == null) return fail(res, 'job_id and overall_score are required', 400);

    const reviewConf = configLoader.get('review');
    const { min, max } = reviewConf.score;
    const windowHours = reviewConf.review_window_hours;

    // 1. Validate overall_score
    const score = parseInt(overall_score, 10);
    if (isNaN(score) || score < min || score > max) {
        return fail(res, `overall_score must be between ${min} and ${max}`, 400, 'INVALID_SCORE');
    }

    try {
        const pool = getPool();

        // 2. Fetch job — guard completed + requester is customer/worker
        const [jobs] = await pool.query(`SELECT customer_id, worker_id, status, work_ended_at
             FROM jobs WHERE id = $1`, [job_id]
        );
        const job = jobs[0];

        if (!job) return fail(res, 'Job not found', 404);
        if (job.status !== 'completed') return fail(res, 'Can only review completed jobs', 400, 'JOB_NOT_COMPLETED');

        const isCustomer = job.customer_id == userId;
        const isWorker = job.worker_id == userId;
        if (!isCustomer && !isWorker) return fail(res, 'Forbidden', 403, 'FORBIDDEN');

        // 3. Time window check
        const completedAt = new Date(job.work_ended_at);
        const windowMs = windowHours * 60 * 60 * 1000;
        if (Date.now() - completedAt.getTime() > windowMs) {
            return fail(res, 'Review window closed', 403, 'WINDOW_EXPIRED');
        }

        // 4. Validate category_scores keys against role config
        const reviewer_role = isCustomer ? 'customer' : 'worker';
        const reviewee_id = isCustomer ? job.worker_id : job.customer_id;
        const expectedKeys = reviewConf.category_scores[reviewer_role];
        const providedKeys = Object.keys(category_scores);

        const invalidKeys = providedKeys.filter(k => !expectedKeys.includes(k));
        if (invalidKeys.length > 0) {
            return fail(res, `Invalid category_score keys for ${reviewer_role}: ${invalidKeys.join(', ')}`, 400, 'INVALID_CATEGORY_KEYS');
        }

        // 5. Auto-flag moderation
        const flagWords = reviewConf.moderation?.auto_flag_words || [];
        const commentLow = (comment || '').toLowerCase();
        const is_flagged = flagWords.some(w => commentLow.includes(w.toLowerCase())) ? true : false;

        // 6. INSERT (UNIQUE KEY on job_id+reviewer_id enforces single review — catch 1062 → 409)
        try {
            await pool.query(`INSERT INTO reviews (job_id, reviewer_id, reviewee_id, reviewer_role, score, category_scores, comment, is_flagged)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [job_id, userId, reviewee_id, reviewer_role, score, JSON.stringify(category_scores), comment || null, is_flagged]
            );
        } catch (insertErr) {
            if (insertErr.code === 'ER_DUP_ENTRY' || insertErr.code === '23505') {
                return fail(res, 'You have already reviewed this job', 409, 'DUPLICATE_REVIEW');
            }
            throw insertErr;
        }

        // 7. Recalculate average_rating + increment rating_count on reviewee profile
        if (reviewer_role === 'customer') {
            // Customer rated the worker
            await pool.query(`UPDATE worker_profiles
                 SET average_rating = (SELECT AVG(score) FROM reviews WHERE reviewee_id = $1),
                     rating_count = rating_count + 1
                 WHERE user_id = $2`, [reviewee_id, reviewee_id]
            );
        } else {
            // Worker rated the customer
            await pool.query(`UPDATE customer_profiles
                 SET average_rating = (SELECT AVG(score) FROM reviews WHERE reviewee_id = $1),
                     rating_count = rating_count + 1
                 WHERE user_id = $2`, [reviewee_id, reviewee_id]
            );
        }

        return ok(res, {
            submitted: true,
            is_flagged: is_flagged === 1,
            reviewer_role
        }, 201);

    } catch (err) {
        return fail(res, err.message, 500);
    }
});

// ─────────────────────────────────────────────────────────
// GET /api/reviews/worker/:user_id  — public
// ─────────────────────────────────────────────────────────
router.get('/worker/:user_id', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.query(`SELECT r.id, r.score AS overall_score, r.category_scores, r.comment,
                    r.created_at, u.phone AS reviewer_phone
             FROM reviews r
             JOIN users u ON u.id = r.reviewer_id
             WHERE r.reviewee_id = $1 AND r.reviewer_role = 'customer'
             ORDER BY r.created_at DESC`, [req.params.user_id]
        );

        // Mask phone — only show last 4 digits for privacy
        const reviews = rows.map(r => {
            const out = {
                ...r,
                category_scores: typeof r.category_scores === 'string'
                    ? JSON.parse(r.category_scores) : (r.category_scores || {}),
                reviewer_identifier: `User ***${String(r.reviewer_phone).slice(-4)}`
            };
            delete out.reviewer_phone;
            return out;
        });

        return ok(res, { reviews });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

// ─────────────────────────────────────────────────────────
// GET /api/reviews/customer/:user_id  — worker-only
// ─────────────────────────────────────────────────────────
router.get('/customer/:user_id', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    try {
        const pool = getPool();

        // Role guard — only workers can see customer reviews
        const [callerRows] = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (!callerRows[0] || callerRows[0].role !== 'worker') {
            return fail(res, 'Only workers can view customer reviews', 403, 'FORBIDDEN');
        }

        const [rows] = await pool.query(`SELECT r.id, r.score AS overall_score, r.category_scores, r.comment, r.created_at
             FROM reviews r
             WHERE r.reviewee_id = $1 AND r.reviewer_role = 'worker'
             ORDER BY r.created_at DESC`, [req.params.user_id]
        );

        const reviews = rows.map(r => ({
            ...r,
            category_scores: typeof r.category_scores === 'string'
                ? JSON.parse(r.category_scores) : (r.category_scores || {})
        }));

        return ok(res, { reviews });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

export default router;
