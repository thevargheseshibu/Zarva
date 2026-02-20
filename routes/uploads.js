/**
 * routes/uploads.js — S3 Pre-signed Upload API
 *
 * Mounted at /api/uploads
 * ALL routes require active JWT (via the authenticateJWT global middleware).
 */

import { Router } from 'express';
import { getPool } from '../config/database.js';
import {
    generatePresignedUpload,
    confirmUpload,
} from '../services/upload.service.js';

const router = Router();

// Helper to quickly bail out or succeed
const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

/**
 * POST /api/uploads/presign
 * Generates an AWS S3 PUT URL directly to the bucket.
 * Logs the request internally using s3_upload_tokens (is_used = 0).
 */
router.post('/presign', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }

    const { purpose, filename, mime_type } = req.body ?? {};
    if (!purpose || !filename || !mime_type) {
        return fail(res, 'purpose, filename, and mime_type are all required.', 400, 'MISSING_FIELDS');
    }

    try {
        const pool = getPool();
        const result = await generatePresignedUpload(userId, purpose, filename, mime_type, pool);
        return ok(res, result);
    } catch (err) {
        console.error(`[Uploads] /presign failed for U:${userId}:`, err.message);
        const status = err.status ?? 500;
        const msg = status < 500 ? err.message : 'Failed to generate presigned URL.';
        return fail(res, msg, status, 'PRESIGN_ERROR');
    }
});

/**
 * POST /api/uploads/confirm
 * Freezes an upload after successful S3 delivery.
 * Validates token has not expired and matches user_id. Marks it used.
 */
router.post('/confirm', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }

    const { s3_key } = req.body ?? {};
    if (!s3_key) {
        return fail(res, 's3_key is required.', 400, 'MISSING_FIELDS');
    }

    try {
        const pool = getPool();
        await confirmUpload(userId, s3_key, pool);
        return ok(res, { s3_key, confirmed: true });
    } catch (err) {
        console.warn(`[Uploads] /confirm failed for U:${userId}, Key:${s3_key}:`, err.message);
        const status = err.status ?? 500;
        const msg = status < 500 ? err.message : 'Failed to confirm upload token.';
        return fail(res, msg, status, 'CONFIRM_ERROR');
    }
});

export default router;
