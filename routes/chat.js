/**
 * routes/chat.js
 * 
 * HTTP endpoints for Job-Tied Chat functionality.
 */
import { Router } from 'express';
import * as ChatService from '../services/chat.service.js';

const router = Router({ mergeParams: true }); // Allows parsing :jobId from parent router if mounted that way, though we'll mount directly

const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });
const isValidJobId = (jobId) => typeof jobId === 'string' && /^\d+$/.test(jobId);

/**
 * Identify role based on job context (Customer or Worker)
 * Assumes req.user is populated by authenticateJWT.
 */
const getRoleContext = async (jobId, userId, pool) => {
    const [jobs] = await pool.query('SELECT customer_id, worker_id FROM jobs WHERE id = $1', [jobId]);
    if (!jobs.length) return null;
    const j = jobs[0];
    if (j.customer_id == userId) return 'customer';
    if (j.worker_id == userId) return 'worker';
    return null;
};

/**
 * GET /api/jobs/:jobId/chat/messages
 */
router.get('/messages', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.jobId;
    // FIX: Ensure JobID is strictly numeric before querying the DB
    if (!jobId || !/^\d+$/.test(jobId)) {
        return fail(res, 'Invalid Job ID format', 400, 'INVALID_JOB_ID');
    }

    // FIX: Catch the string "undefined" sent by React Native networking
    const beforeQuery = req.query.before;
    const beforeParsed = (beforeQuery && beforeQuery !== 'undefined') ? Number(beforeQuery) : null;
    const beforeMessageId = Number.isFinite(beforeParsed) ? beforeParsed : null;
    const limit = 50;

    try {
        const messages = await ChatService.getMessages(jobId, userId, beforeMessageId, limit);
        return ok(res, { messages });
    } catch (err) {
        console.error(`[ChatRoute] GET /messages error:`, err.message);
        return fail(res, err.message, err.status || 500, err.code);
    }
});

/**
 * POST /api/jobs/:jobId/chat/messages
 */
router.post('/messages', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.jobId;
    if (!jobId || !/^\d+$/.test(jobId)) {
        return fail(res, 'Invalid Job ID format', 400, 'INVALID_JOB_ID');
    }

    const { message_type, content, s3_key, client_message_id } = req.body;

    if (!client_message_id) return fail(res, 'client_message_id is required', 400);
    if (!message_type || !['text', 'image'].includes(message_type)) return fail(res, 'Invalid message_type', 400);

    try {
        const { getPool } = await import('../config/database.js');
        const role = await getRoleContext(jobId, userId, getPool());
        console.log(`[ChatRoute] SEND Message | Job:${jobId} | User:${userId} | Role:${role}`);

        if (!role) return fail(res, 'Access denied (Role not found)', 403, 'CHAT_ACCESS_DENIED');

        const message = await ChatService.sendMessage({
            jobId,
            senderId: userId,
            senderRole: role,
            messageType: message_type,
            content,
            s3Key: s3_key,
            clientMessageId: client_message_id
        });

        return ok(res, { message }, 201);
    } catch (err) {
        console.error(`[ChatRoute] POST /messages error:`, err.message, err.code);
        return fail(res, err.message, err.status || 500, err.code);
    }
});

/**
 * DELETE /api/jobs/:jobId/chat/messages/:messageId
 */
router.delete('/messages/:messageId', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const { jobId, messageId } = req.params;
    if (!jobId || !/^\d+$/.test(jobId)) {
        return fail(res, 'Invalid Job ID format', 400, 'INVALID_JOB_ID');
    }

    try {
        await ChatService.deleteMessage(jobId, messageId, userId);
        return ok(res, { deleted: true });
    } catch (err) {
        return fail(res, err.message, err.status || 500, err.code);
    }
});

/**
 * POST /api/jobs/:jobId/chat/read
 */
router.post('/read', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.jobId;
    if (!isValidJobId(jobId)) return fail(res, 'Invalid Job ID format', 400, 'INVALID_JOB_ID');

    try {
        const { getPool } = await import('../config/database.js');
        const role = await getRoleContext(jobId, userId, getPool());
        if (!role) return fail(res, 'Access denied', 403, 'CHAT_ACCESS_DENIED');

        await ChatService.markRead(jobId, userId, role);
        return ok(res, { read: true });
    } catch (err) {
        return fail(res, err.message, err.status || 500, err.code);
    }
});

/**
 * POST /api/jobs/:jobId/chat/typing
 */
router.post('/typing', (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    const jobId = req.params.jobId;
    if (!isValidJobId(jobId)) return fail(res, 'Invalid Job ID format', 400, 'INVALID_JOB_ID');

    // Fire & Forget
    ChatService.sendTypingIndicator(jobId, userId).catch(err => console.error('[Chat] Typing indicator error:', err));
    return ok(res, { typing: true });
});

export default router;
