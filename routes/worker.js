/**
 * routes/worker.js — Worker Onboarding API
 *
 * Mounted at /api/worker/onboard
 * ALL routes require active JWT (via the authenticateJWT global middleware).
 */

import { Router } from 'express';
import { getPool } from '../config/database.js';
import * as WorkerService from '../services/worker.service.js';

const router = Router();

// Helper to quickly bail out or succeed
const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

async function handle(req, res, action) {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }

    try {
        const pool = getPool();
        const result = await action(userId, pool);
        return ok(res, result);
    } catch (err) {
        const status = err.status ?? 500;
        // VERY IMPORTANT: Ensure we NEVER log raw error message if it hints at payment_details failing validation
        // The service handles formatting cleanly, but we must be careful with logging objects.
        if (status >= 500) {
            console.error(`[Worker Onboarding] Failed for U:${userId}:`, err.message);
        }
        const msg = status < 500 ? err.message : 'Internal Server Error.';
        return fail(res, msg, status, 'WORKER_ERROR');
    }
}

/**
 * 1. POST /onboard/start
 */
router.post('/onboard/start', (req, res) =>
    handle(req, res, (userId, pool) => WorkerService.startOnboarding(userId, pool))
);

/**
 * 2. PUT /onboard/profile
 */
router.put('/onboard/profile', (req, res) =>
    handle(req, res, (userId, pool) => WorkerService.updateProfile(userId, req.body, pool))
);

/**
 * 3. PUT /onboard/payment
 */
router.put('/onboard/payment', (req, res) =>
    handle(req, res, (userId, pool) => WorkerService.updatePayment(userId, req.body, pool))
);

/**
 * 4. POST /onboard/documents
 */
router.post('/onboard/documents', (req, res) =>
    handle(req, res, (userId, pool) => WorkerService.submitDocuments(userId, req.body, pool))
);

/**
 * 5. POST /onboard/agree
 */
router.post('/onboard/agree', (req, res) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return handle(req, res, (userId, pool) => WorkerService.agreeToTerms(userId, req.body?.name_typed, ipAddress, pool));
});

/**
 * 6. GET /onboard/status
 */
router.get('/onboard/status', (req, res) =>
    handle(req, res, (userId, pool) => WorkerService.getOnboardingStatus(userId, pool))
);

export default router;
