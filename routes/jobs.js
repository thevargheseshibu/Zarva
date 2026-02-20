/**
 * routes/jobs.js
 * 
 * HTTP endpoints for Job Pricing Estimates and IDEMPOTENT Creation.
 */

import { Router } from 'express';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import * as JobService from '../services/job.service.js';
import { generateEstimate } from '../utils/pricingEngine.js';

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
        const pricing = configLoader.get('pricing');
        const jobsCfg = configLoader.get('jobs');

        return ok(res, {
            categories: Object.keys(pricing.categories),
            questions: jobsCfg.questions
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
        }, configLoader.get('pricing'));

        return ok(res, estimate);
    } catch (err) {
        return fail(res, err.message, 400, 'ESTIMATE_ERROR');
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

export default router;
