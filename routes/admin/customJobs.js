import { Router } from 'express';
import { getPool } from '../../config/database.js';
import CustomJobService from '../../services/customJob.service.js';

const router = Router();
const ok = (res, data) => res.status(200).json({ status: 'ok', ...data });
const fail = (res, message, status = 400) => res.status(status).json({ status: 'error', message });

router.get('/', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.query(`SELECT * FROM custom_job_templates ORDER BY created_at DESC`);
        return ok(res, { templates: rows });
    } catch (e) { return fail(res, e.message, 500); }
});

router.post('/:id/approve', async (req, res) => {
    try {
        const { notes, estimatedCost } = req.body;
        await CustomJobService.adminApproveTemplate(req.user.id, req.params.id, notes || '', estimatedCost);
        return ok(res, { success: true });
    } catch (e) { return fail(res, e.message, 500); }
});

router.post('/:id/reject', async (req, res) => {
    try {
        await CustomJobService.adminRejectTemplate(req.user.id, req.params.id, req.body.reason);
        return ok(res, { success: true });
    } catch (e) { return fail(res, e.message, 500); }
});

export default router;
