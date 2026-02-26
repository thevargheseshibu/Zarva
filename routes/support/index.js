import { Router } from 'express';
import supportService from '../../services/supportService.js';

const router = Router();

// Helper
const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

// ── Create Ticket ─────────────────────────────────────────────
router.post('/tickets/create', async (req, res) => {
    try {
        const { ticket_type, job_id, category, description } = req.body;

        // Prevent random unauthenticated hits
        if (!req.user || !req.user.id) {
            return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');
        }

        const result = await supportService.createTicket({
            user_id: req.user.id,
            user_role: req.user.role || 'customer', // fallback if token omits
            ticket_type,
            job_id,
            category,
            description
        });

        return ok(res, result);
    } catch (error) {
        console.error('[Support Route] Create ticket error:', error);
        return fail(res, error.message, 400);
    }
});

export default router;
