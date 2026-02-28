import express from 'express';
import { authenticateJWT as authenticateToken } from '../../middleware/index.js';
import CustomJobService from '../../services/customJob.service.js';

// NOTE: In a real app, authenticateToken should be followed by an `isAdmin` middleware
const router = express.Router();

/**
 * GET /api/admin/custom-jobs/pending
 * List all pending templates
 */
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const { getPool } = await import('../../config/database.js');
        const pool = getPool();
        const [rows] = await pool.query(`
      SELECT t.*, u.full_name as customer_name, u.phone_number 
      FROM custom_job_templates t
      JOIN users u ON t.customer_id = u.id
      WHERE t.approval_status = 'pending' AND t.is_archived = FALSE
      ORDER BY t.created_at ASC
    `);
        res.json(rows);
    } catch (error) {
        console.error('Admin Get Pending Custom Jobs Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/custom-jobs/:id/approve
 */
router.post('/:id/approve', authenticateToken, async (req, res) => {
    try {
        const adminId = req.user.id;
        const { id } = req.params;
        const { notes } = req.body;

        await CustomJobService.adminApproveTemplate(adminId, id, notes);
        res.json({ message: 'Template approved successfully' });
    } catch (error) {
        console.error('Admin Approve Custom Job Error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
});

/**
 * POST /api/admin/custom-jobs/:id/reject
 */
router.post('/:id/reject', authenticateToken, async (req, res) => {
    try {
        const adminId = req.user.id;
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });

        await CustomJobService.adminRejectTemplate(adminId, id, reason);
        res.json({ message: 'Template rejected successfully' });
    } catch (error) {
        console.error('Admin Reject Custom Job Error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
});

export default router;
