/**
 * routes/admin/jobs.js
 *
 * Admin Jobs Data Explorer — view, filter, and god-mode-edit any job.
 *
 * GET   /api/admin/jobs        — Paginated jobs list (filter by status, category)
 * PATCH /api/admin/jobs/:id    — Inline edit with Firebase sync + audit log
 * GET   /api/admin/jobs/:id    — Full job detail (for detail panels)
 */

import express from 'express';
import { getPool, handle, fail } from '../../lib/db.js';

const router = express.Router();

const ALLOWED_JOB_FIELDS = new Set(['status', 'hourly_rate', 'final_amount', 'description', 'worker_id']);

/**
 * GET /api/admin/jobs
 * Feeds the main Jobs DataGrid with pagination and filters.
 */
router.get('/', handle(async (adminId, pool, req) => {
    const {
        page     = 1,
        limit    = 50,
        status,
        category,
        search   = '',
        sortField  = 'created_at',
        sortOrder  = 'DESC',
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const SORT_SAFE = new Set(['id', 'created_at', 'updated_at', 'hourly_rate', 'final_amount', 'status']);

    let query = `
        SELECT
            j.id, j.status, j.category, j.city, j.address,
            j.hourly_rate, j.final_amount, j.created_at, j.updated_at,
            j.estimated_duration_minutes, j.billing_cap_minutes,
            c.name AS customer_name, c.user_id AS customer_id,
            w.name AS worker_name, w.user_id  AS worker_id
        FROM jobs j
        LEFT JOIN customer_profiles c ON j.customer_id = c.user_id
        LEFT JOIN worker_profiles   w ON j.worker_id   = w.user_id
        WHERE 1=1
    `;
    const values = [];
    let idx = 1;

    if (status)   { query += ` AND j.status = $${idx++}`;   values.push(status); }
    if (category) { query += ` AND j.category = $${idx++}`; values.push(category); }
    if (search)   {
        query += ` AND (c.name ILIKE $${idx} OR w.name ILIKE $${idx} OR j.address ILIKE $${idx})`;
        values.push(`%${search}%`);
        idx++;
    }

    const safeSortField = SORT_SAFE.has(sortField) ? `j.${sortField}` : 'j.created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${safeSortField} ${safeSortOrder} LIMIT $${idx++} OFFSET $${idx++}`;
    values.push(parseInt(limit, 10), offset);

    const [rows] = await pool.query(query, values);
    return { jobs: rows, page: parseInt(page, 10) };
}));


/**
 * GET /api/admin/jobs/:id
 * Full job detail for side-panel / drill-down views.
 */
router.get('/:id', handle(async (adminId, pool, req) => {
    const jobId = req.params.id;
    const [rows] = await pool.query(`
        SELECT j.*,
               c.name AS customer_name, c.user_id AS customer_id,
               w.name AS worker_name
        FROM jobs j
        LEFT JOIN customer_profiles c ON j.customer_id = c.user_id
        LEFT JOIN worker_profiles   w ON j.worker_id   = w.user_id
        WHERE j.id = $1
    `, [jobId]);

    if (!rows[0]) throw Object.assign(new Error('Job not found'), { status: 404 });
    return { job: rows[0] };
}));


/**
 * PATCH /api/admin/jobs/:id
 * God-Mode edit: adjust rate, force-complete stuck jobs, reassign workers.
 * Syncs changes to Firebase and writes an audit record.
 */
router.patch('/:id', handle(async (adminId, pool, req) => {
    const jobId  = req.params.id;
    const body   = req.body;

    const updates = [];
    const values  = [];
    const fbUpdates = {};
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
        if (ALLOWED_JOB_FIELDS.has(key)) {
            updates.push(`${key} = $${idx++}`);
            values.push(value);
            fbUpdates[key] = value;
        }
    }

    if (updates.length === 0) return { success: true, message: 'No changes' };

    updates.push(`updated_at = NOW()`);
    values.push(jobId);
    await pool.query(`UPDATE jobs SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    // Real-time sync to Firebase
    try {
        const { updateJobNode } = await import('../../services/firebase.service.js');
        await updateJobNode(jobId, fbUpdates);
    } catch (e) {
        console.warn('[Admin Jobs] Firebase sync skipped:', e.message);
    }

    // Audit trail
    await pool.query(`
        INSERT INTO admin_audit_logs (admin_id, action, target_table, target_id, details)
        VALUES ($1, 'UPDATE_JOB', 'jobs', $2, $3)
    `, [adminId, jobId, JSON.stringify(body)]);

    return { success: true };
}));

export default router;
