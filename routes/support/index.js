import { Router } from 'express';
import supportService from '../../services/supportService.js';
import { getPool } from '../../config/database.js';

const router = Router();

const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

// ── Create Ticket ─────────────────────────────────────────────────────────────
router.post('/tickets/create', async (req, res) => {
    try {
        if (!req.user?.id) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

        const { ticket_type, job_id, category, description } = req.body;
        if (!ticket_type || !description?.trim()) {
            return fail(res, 'ticket_type and description are required');
        }

        const result = await supportService.createTicket({
            user_id: req.user.id,
            user_role: req.user.role || 'customer',
            ticket_type,
            job_id: job_id || null,
            category: category || null,
            description: description.trim()
        });

        return ok(res, result, 201);
    } catch (error) {
        console.error('[Support] Create ticket:', error);
        const status = error.message?.includes('locked') || error.message?.includes('already have') ? 409 : 400;
        return fail(res, error.message, status);
    }
});

// ── List My Tickets ────────────────────────────────────────────────────────────
router.get('/tickets', async (req, res) => {
    try {
        if (!req.user?.id) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
        const pool = getPool();
        const { status, type } = req.query;

        let sql = `
            SELECT st.*,
                   j.category as job_category, j.status as job_status
            FROM support_tickets st
            LEFT JOIN jobs j ON st.job_id = j.id
            WHERE st.raised_by_user_id = $1
        `;
        const params = [req.user.id];
        let idx = 2;

        if (status) { sql += ` AND st.status = $${idx++}`; params.push(status); }
        if (type)   { sql += ` AND st.ticket_type = $${idx++}`; params.push(type); }

        sql += ' ORDER BY st.last_activity_at DESC LIMIT 50';

        const result = await pool.query(sql, params);
        return ok(res, { tickets: result.rows });
    } catch (err) {
        console.error('[Support] List tickets:', err);
        return fail(res, 'Failed to fetch tickets', 500, 'SERVER_ERROR');
    }
});

// ── Get Single Ticket + Messages ───────────────────────────────────────────────
router.get('/tickets/:ticketId', async (req, res) => {
    try {
        if (!req.user?.id) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
        const pool = getPool();
        const { ticketId } = req.params;

        const ticketRes = await pool.query(
            `SELECT st.*, j.category as job_category, j.status as job_status
             FROM support_tickets st
             LEFT JOIN jobs j ON st.job_id = j.id
             WHERE st.id = $1 AND st.raised_by_user_id = $2`,
            [ticketId, req.user.id]
        );

        if (!ticketRes.rows[0]) return fail(res, 'Ticket not found', 404, 'NOT_FOUND');

        const msgsRes = await pool.query(
            `SELECT * FROM ticket_messages WHERE ticket_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
            [ticketId]
        );

        // Mark messages as read by user
        await pool.query(
            `UPDATE ticket_messages SET read_by_user = TRUE WHERE ticket_id = $1 AND sender_role = 'admin'`,
            [ticketId]
        );

        return ok(res, { ticket: ticketRes.rows[0], messages: msgsRes.rows });
    } catch (err) {
        console.error('[Support] Get ticket:', err);
        return fail(res, 'Failed to fetch ticket', 500, 'SERVER_ERROR');
    }
});

// ── Send Message on Ticket ─────────────────────────────────────────────────────
router.post('/tickets/:ticketId/messages', async (req, res) => {
    try {
        if (!req.user?.id) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
        const pool = getPool();
        const { ticketId } = req.params;
        const { message_text, attachment_urls } = req.body;

        if (!message_text?.trim() && (!attachment_urls || attachment_urls.length === 0)) {
            return fail(res, 'message_text or attachment is required');
        }

        // Verify ownership & that ticket is still open
        const ticketRes = await pool.query(
            `SELECT id, status, raised_by_user_id FROM support_tickets WHERE id = $1`,
            [ticketId]
        );
        const ticket = ticketRes.rows[0];
        if (!ticket) return fail(res, 'Ticket not found', 404, 'NOT_FOUND');
        if (String(ticket.raised_by_user_id) !== String(req.user.id))
            return fail(res, 'Unauthorized', 403, 'FORBIDDEN');
        if (['resolved', 'closed'].includes(ticket.status))
            return fail(res, 'Ticket is already resolved or closed. Please open a new ticket.', 409);

        const msg = await supportService.addMessage(
            ticketId,
            req.user.id,
            req.user.role || 'customer',
            message_text?.trim() || null,
            attachment_urls || []
        );

        // Change status to 'awaiting_admin' if it was 'admin_replied'
        if (ticket.status === 'admin_replied') {
            await pool.query(
                `UPDATE support_tickets SET status = 'awaiting_admin', last_activity_at = NOW() WHERE id = $1`,
                [ticketId]
            );
        }

        return ok(res, { message: msg });
    } catch (err) {
        console.error('[Support] Send message:', err);
        return fail(res, 'Failed to send message', 500, 'SERVER_ERROR');
    }
});

// ── Close Ticket (User) ────────────────────────────────────────────────────────
router.post('/tickets/:ticketId/close', async (req, res) => {
    try {
        if (!req.user?.id) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
        const pool = getPool();
        const { ticketId } = req.params;

        const ticketRes = await pool.query(
            `SELECT id, status, raised_by_user_id FROM support_tickets WHERE id = $1`,
            [ticketId]
        );
        const ticket = ticketRes.rows[0];
        if (!ticket) return fail(res, 'Ticket not found', 404, 'NOT_FOUND');
        if (String(ticket.raised_by_user_id) !== String(req.user.id))
            return fail(res, 'Unauthorized', 403, 'FORBIDDEN');
        if (['closed', 'resolved'].includes(ticket.status))
            return fail(res, 'Ticket is already closed or resolved');

        await pool.query(
            `UPDATE support_tickets SET status = 'closed', closed_at = NOW(), last_activity_at = NOW() WHERE id = $1`,
            [ticketId]
        );

        // Add system message
        await supportService.addMessage(ticketId, req.user.id, 'system', 'User closed this ticket.');

        return ok(res, { message: 'Ticket closed successfully.' });
    } catch (err) {
        console.error('[Support] Close ticket:', err);
        return fail(res, 'Failed to close ticket', 500, 'SERVER_ERROR');
    }
});

// ── Eligible Jobs for Tickets ──────────────────────────────────────────────────
router.get('/eligible-jobs', async (req, res) => {
    try {
        if (!req.user?.id) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
        const pool = getPool();
        const ACTIVE_STATUSES = ['assigned', 'worker_en_route', 'worker_arrived', 'in_progress', 'pending_completion', 'estimate_submitted', 'disputed'];
        const HISTORY_STATUSES = ['completed', 'cancelled'];

        const currentRes = await pool.query(
            `SELECT j.id, j.category, j.status, j.created_at, j.customer_address,
                    wp.name as worker_name, wp.photo as worker_photo
             FROM jobs j
             LEFT JOIN worker_profiles wp ON j.worker_id = wp.user_id
             WHERE (j.customer_id = $1 OR j.worker_id = $1)
               AND j.status = ANY($2::text[])
             ORDER BY j.created_at DESC LIMIT 20`,
            [req.user.id, ACTIVE_STATUSES]
        );

        const historyRes = await pool.query(
            `SELECT j.id, j.category, j.status, j.created_at, j.customer_address,
                    wp.name as worker_name, wp.photo as worker_photo
             FROM jobs j
             LEFT JOIN worker_profiles wp ON j.worker_id = wp.user_id
             WHERE (j.customer_id = $1 OR j.worker_id = $1)
               AND j.status = ANY($2::text[])
             ORDER BY j.created_at DESC LIMIT 30`,
            [req.user.id, HISTORY_STATUSES]
        );

        return ok(res, { current: currentRes.rows, history: historyRes.rows });
    } catch (err) {
        console.error('[Support] Eligible jobs:', err);
        return fail(res, 'Failed to fetch jobs', 500, 'SERVER_ERROR');
    }
});

// ── Dispute Categories (for picker) ───────────────────────────────────────────
router.get('/categories', async (req, res) => {
    try {
        const pool = getPool();
        const { role } = req.query;
        let sql = `SELECT category_key, category_name, who_can_raise, priority_default, sla_hours FROM dispute_categories WHERE active = TRUE`;
        if (role) sql += ` AND (who_can_raise = $1 OR who_can_raise = 'both')`;
        const result = await pool.query(sql, role ? [role] : []);
        return ok(res, { categories: result.rows });
    } catch (err) {
        console.error('[Support] Categories:', err);
        return fail(res, 'Failed to fetch categories', 500, 'SERVER_ERROR');
    }
});

// ── Concurrency Status ─────────────────────────────────────────────────────────
router.get('/slot-status', async (req, res) => {
    try {
        if (!req.user?.id) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
        const check = await supportService.canUserTakeNewJob(req.user.id);
        return ok(res, check);
    } catch (err) {
        return fail(res, 'Failed to check slot status', 500, 'SERVER_ERROR');
    }
});

export default router;
