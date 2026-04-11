import { Router } from 'express';
import { getPool } from '../../config/database.js';
import supportService from '../../services/supportService.js';

const router = Router();

const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

/**
 * GET /api/admin/tickets
 * Admin lists all support tickets with filters
 */
router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const { status, type, priority, limit, offset } = req.query;

        let query = `
            SELECT t.*, u.phone as raised_by_phone, COALESCE(cp.name, wp.name, 'Zarva User') as raised_by_name,
                   j.category as job_category
            FROM support_tickets t
            JOIN users u ON t.raised_by_user_id = u.id
            LEFT JOIN customer_profiles cp ON cp.user_id = u.id
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id
            LEFT JOIN jobs j ON t.job_id = j.id
        `;
        const conditions = [];
        const params = [];
        let idx = 1;

        if (status)   { conditions.push(`t.status = $${idx++}`);      params.push(status); }
        if (type)     { conditions.push(`t.ticket_type = $${idx++}`); params.push(type); }
        if (priority) { conditions.push(`t.priority = $${idx++}`);    params.push(priority); }

        if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
        
        // ⭐ FIX: Safely parse limits to prevent NaN SQL errors
        const safeLimit = parseInt(limit) || 50;
        const safeOffset = parseInt(offset) || 0;
        
        query += ` ORDER BY t.last_activity_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(safeLimit, safeOffset);

        // ⭐ FIX: Array destructuring matches your DB wrapper instead of result.rows
        const [rows] = await pool.query(query, params);
        
        return ok(res, { tickets: rows, count: rows.length });
    } catch (err) {
        console.error('[Admin Tickets] List error:', err);
        return fail(res, 'Failed to fetch tickets', 500, 'SERVER_ERROR');
    }
});

/**
 * GET /api/admin/tickets/:id
 * Admin views a single ticket and its messages
 */
router.get('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const { id } = req.params;

        // ⭐ FIX: Destructure as [ticketRows]
        const [ticketRows] = await pool.query(`
            SELECT t.*, u.phone as raised_by_phone, COALESCE(cp.name, wp.name, 'Zarva User') as raised_by_name,
                   j.category as job_category, j.status as job_current_status
            FROM support_tickets t
            JOIN users u ON t.raised_by_user_id = u.id
            LEFT JOIN customer_profiles cp ON cp.user_id = u.id
            LEFT JOIN worker_profiles wp ON wp.user_id = u.id
            LEFT JOIN jobs j ON t.job_id = j.id
            WHERE t.id = $1
        `, [id]);

        if (!ticketRows[0]) return fail(res, 'Ticket not found', 404, 'NOT_FOUND');

        // ⭐ FIX: Destructure as [msgsRows]
        const [msgsRows] = await pool.query(`
            SELECT m.*, u.phone as sender_phone
            FROM ticket_messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.ticket_id = $1 AND m.deleted_at IS NULL
            ORDER BY m.created_at ASC
        `, [id]);

        // Mark all messages as read by admin
        await pool.query(
            `UPDATE ticket_messages SET read_by_admin = TRUE WHERE ticket_id = $1`,
            [id]
        );

        return ok(res, { ticket: ticketRows[0], messages: msgsRows });
    } catch (err) {
        console.error('[Admin Tickets] View error:', err);
        return fail(res, 'Failed to fetch ticket info', 500, 'SERVER_ERROR');
    }
});

/**
 * PATCH /api/admin/tickets/:id/status
 * Admin updates ticket status
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const pool = getPool();
        const { id } = req.params;
        const { status } = req.body;

        const VALID = ['open', 'admin_replied', 'awaiting_user', 'awaiting_admin', 'resolved', 'closed'];
        if (!VALID.includes(status)) return fail(res, `Invalid status. Must be one of: ${VALID.join(', ')}`);

        // ⭐ FIX: Destructure as [resultRows]
        const [resultRows] = await pool.query(
            `UPDATE support_tickets SET status = $1, last_activity_at = NOW() WHERE id = $2 RETURNING *`,
            [status, id]
        );
        
        if (!resultRows[0]) return fail(res, 'Ticket not found', 404, 'NOT_FOUND');

        return ok(res, { ticket: resultRows[0] });
    } catch (err) {
        console.error('[Admin Tickets] Update status error:', err);
        return fail(res, 'Failed to update ticket', 500, 'SERVER_ERROR');
    }
});

/**
 * POST /api/admin/tickets/:id/message
 * Admin sends a message on a ticket
 */
router.post('/:id/message', async (req, res) => {
    try {
        if (!req.user?.id) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
        const pool = getPool();
        const { id } = req.params;
        
        // ⭐ FIX: Safely parse payload regardless of camelCase/snake_case
        const message_text = req.body.message_text || req.body.content;
        const is_internal_note = req.body.is_internal_note !== undefined ? req.body.is_internal_note : req.body.isInternalNote;
        const attachment_urls = req.body.attachment_urls;

        if (!message_text?.trim()) return fail(res, 'Message text is required');

        const [ticketRows] = await pool.query(`SELECT id, status FROM support_tickets WHERE id = $1`, [id]);
        if (!ticketRows[0]) return fail(res, 'Ticket not found', 404, 'NOT_FOUND');

        if (is_internal_note) {
            const [msgRows] = await pool.query(`
                INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, message_text, is_internal_note)
                VALUES ($1, $2, 'admin', $3, TRUE) RETURNING *
            `, [id, req.user.id, message_text.trim()]);
            return ok(res, { message: msgRows[0] });
        }

        const msg = await supportService.addMessage(
            id,
            req.user.id,
            'admin',
            message_text.trim(),
            attachment_urls || []
        );

        await pool.query(
            `UPDATE support_tickets SET status = 'admin_replied', last_activity_at = NOW() WHERE id = $1`,
            [id]
        );

        return ok(res, { message: msg });
    } catch (err) {
        console.error('[Admin Tickets] Send message error:', err);
        return fail(res, 'Failed to send message', 500, 'SERVER_ERROR');
    }
});

/**
 * POST /api/admin/tickets/:id/resolve
 * Admin resolves a ticket with resolution type and optional compensation
 */
router.post('/:id/resolve', async (req, res) => {
    try {
        if (!req.user?.id) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

        const { id } = req.params;
        const { type, notes, amount } = req.body;

        const VALID_TYPES = [
            'no_action',
            'refund_full',
            'refund_partial',
            'worker_warning',
            'worker_suspended',
            'customer_warned',
            'reimbursement',
            'job_cancelled_refund',
            'resolved_by_mutual_agreement'
        ];
        if (!type) return fail(res, 'resolution type is required');
        if (!VALID_TYPES.includes(type)) return fail(res, `Invalid resolution type. Must be one of: ${VALID_TYPES.join(', ')}`);

        await supportService.resolveTicket(id, req.user.id, {
            type,
            notes: notes || null,
            amount: amount ? parseFloat(amount) : null
        });

        return ok(res, { message: 'Ticket resolved successfully.' });
    } catch (err) {
        console.error('[Admin Tickets] Resolve error:', err);
        return fail(res, err.message || 'Failed to resolve ticket', 500, 'SERVER_ERROR');
    }
});

export default router;
