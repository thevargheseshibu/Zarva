/**
 * routes/uploads.js — S3 Pre-signed Upload API
 *
 * Mounted at /api/uploads
 * ALL routes require active JWT (via the authenticateJWT global middleware).
 */

import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { getPool } from '../config/database.js';
import {
    generatePresignedUpload,
    confirmUpload,
    uploadBufferToS3
} from '../services/upload.service.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

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
        console.log(`[Uploads API] Generating presigned URL for U:${userId} -> Purpose: ${purpose}, File: ${filename}`);
        const pool = getPool();
        const result = await generatePresignedUpload(userId, purpose, filename, mime_type, pool);
        console.log(`[Uploads API] Presigned URL generated successfully: ${result.s3_key}`);
        return ok(res, result);
    } catch (err) {
        console.error(`[Uploads API] /presign API failed for U:${userId}:`, err.message);
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
        console.log(`[Uploads API] Confirming upload for U:${userId} -> S3 Key: ${s3_key}`);
        const pool = getPool();
        await confirmUpload(userId, s3_key, pool);
        console.log(`[Uploads API] Upload confirmed and locked for: ${s3_key}`);
        return ok(res, { s3_key, confirmed: true });
    } catch (err) {
        console.warn(`[Uploads API] /confirm API failed for U:${userId}, Key:${s3_key}:`, err.message);
        const status = err.status ?? 500;
        const msg = status < 500 ? err.message : 'Failed to confirm upload token.';
        return fail(res, msg, status, 'CONFIRM_ERROR');
    }
});

/**
 * POST /api/uploads/image
 * Accepts a multipart/form-data image, compresses it natively via Sharp,
 * and pushes it directly to S3 without intermediary presigned links.
 */
router.post('/image', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]), async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }

    const file = req.files?.file?.[0] || req.files?.image?.[0];

    if (!file) {
        return fail(res, 'No file provided in the "file" or "image" field.', 400, 'MISSING_FILE');
    }

    const { purpose } = req.body;
    if (!purpose) {
        return fail(res, 'Upload purpose is required.', 400, 'MISSING_PURPOSE');
    }

    try {
        console.log(`[Uploads API] Processing and compressing image for U:${userId} -> Purpose: ${purpose}`);
        const pool = getPool();

        // Use Sharp to resize and compress the uploaded in-memory buffer
        const compressedBuffer = await sharp(file.buffer)
            .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, force: true }) // Convert almost everything to JPEG, preserving size
            .toBuffer();

        const result = await uploadBufferToS3(
            userId,
            purpose,
            file.originalname,
            'image/jpeg',
            compressedBuffer,
            pool
        );

        console.log(`[Uploads API] Image compressed and uploaded successfully: ${result.s3_key}`);

        // Return both S3 key and full URL (matches presigned + manual confirm flow behavior indirectly)
        return ok(res, result);
    } catch (err) {
        console.error(`[Uploads API] /image API failed for U:${userId}:`, err);
        const status = err.status ?? 500;
        const msg = status < 500 ? err.message : 'Failed to compress and upload image.';
        return fail(res, msg, status, 'UPLOAD_ERROR');
    }
});

export default router;
