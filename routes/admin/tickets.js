import { Router } from 'express';
import { getPool } from '../../config/database.js';

const router = Router();

// Helper
const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

/**
 * GET /api/admin/tickets
 * Admin lists all support tickets
 */
router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const { status } = req.query;
        let query = `
            SELECT t.*, u.phone as raised_by_phone
            FROM support_tickets t
            JOIN users u ON t.raised_by_user_id = u.id
        `;
        const params = [];
        if (status) {
            query += ` WHERE t.status = $1`;
            params.push(status);
        }
        query += ` ORDER BY t.created_at DESC LIMIT 100`;

        const [tickets] = await pool.query(query, params);
        return ok(res, { tickets });
    } catch (err) {
        console.error('[Admin Tickets] List error:', err);
        return fail(res, 'Failed to fetch tickets', 500);
    }
});

/**
 * GET /api/admin/tickets/:id
 * Admin views a single ticket and its messages
 */
router.get('/:id', async (req, res) => {
    try {
        const pool = getPool();
        const ticketId = req.params.id;

        const [tickets] = await pool.query(`
            SELECT t.*, u.phone as raised_by_phone
            FROM support_tickets t
            JOIN users u ON t.raised_by_user_id = u.id
            WHERE t.id = $1
        `, [ticketId]);

        if (!tickets[0]) return fail(res, 'Ticket not found', 404);

        const [messages] = await pool.query(`
            SELECT m.*, u.phone as sender_phone
            FROM ticket_messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.ticket_id = $1
            ORDER BY m.created_at ASC
        `, [ticketId]);

        return ok(res, { ticket: tickets[0], messages });
    } catch (err) {
        console.error('[Admin Tickets] View error:', err);
        return fail(res, 'Failed to fetch ticket info', 500);
    }
});

export default router;
