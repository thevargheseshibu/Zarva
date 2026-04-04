/**
 * routes/admin/users.js
 *
 * Admin Users & KYC Pipeline — data-grid-ready endpoints.
 *
 * GET  /api/admin/users              — Paginated, sorted, filtered list
 * PATCH /api/admin/users/:id         — Inline god-mode edit (suspend/unsuspend)
 * POST /api/admin/users/:id/approve-kyc — Approve worker KYC + Firebase unlock
 */

import express from 'express';
import { getPool, handle, fail } from '../../lib/db.js';

const router = express.Router();

// Columns allowed for ORDER BY (SQL injection prevention)
const ALLOWED_SORT_FIELDS = new Set(['id', 'created_at', 'name', 'average_rating', 'total_jobs', 'phone']);

/**
 * GET /api/admin/users
 * Feeds AG Grid with pagination, sorting, and full-text search.
 */
router.get('/', handle(async (adminId, pool, req) => {
    const {
        page = 1,
        limit = 50,
        role,
        sortField = 'created_at',
        sortOrder = 'DESC',
        search = '',
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let query = `
        SELECT
            u.id, u.phone, u.role, u.is_suspended, u.created_at,
            COALESCE(wp.name, cp.name) AS name,
            wp.kyc_status, wp.category, wp.average_rating, wp.total_jobs,
            wp.is_verified, wp.is_online
        FROM users u
        LEFT JOIN worker_profiles  wp ON u.id = wp.user_id
        LEFT JOIN customer_profiles cp ON u.id = cp.user_id
        WHERE 1=1
    `;
    const values = [];
    let idx = 1;

    if (role) {
        query += ` AND u.role = $${idx++}`;
        values.push(role);
    }

    if (search) {
        query += ` AND (u.phone ILIKE $${idx} OR wp.name ILIKE $${idx} OR cp.name ILIKE $${idx})`;
        values.push(`%${search}%`);
        idx++;
    }

    const safeSortField = ALLOWED_SORT_FIELDS.has(sortField) ? sortField : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Build count query BEFORE appending LIMIT/OFFSET
    const countQuery = `
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN worker_profiles  wp ON u.id = wp.user_id
        LEFT JOIN customer_profiles cp ON u.id = cp.user_id
        WHERE 1=1
        ${role   ? `AND u.role = $1` : ''}
        ${search ? `AND (u.phone ILIKE $${role ? 2 : 1} OR wp.name ILIKE $${role ? 2 : 1} OR cp.name ILIKE $${role ? 2 : 1})` : ''}
    `;
    const countValues = values.slice(); // snapshot before pushing LIMIT/OFFSET

    query += ` ORDER BY ${safeSortField} ${safeSortOrder} LIMIT $${idx++} OFFSET $${idx++}`;
    values.push(parseInt(limit, 10), offset);

    const [rows]      = await pool.query(query, values);
    const [countRows] = await pool.query(countQuery, countValues);
    const total       = parseInt(countRows[0]?.total ?? 0, 10);

    return {
        users: rows,
        total,
        page:  parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
    };
}));


/**
 * PATCH /api/admin/users/:id
 * God-Mode inline editing (is_suspended, role).
 */
router.patch('/:id', handle(async (adminId, pool, req) => {
    const targetId = req.params.id;
    const { is_suspended, role } = req.body;

    const updates = [];
    const values  = [];
    let idx = 1;

    if (is_suspended !== undefined) { updates.push(`is_suspended = $${idx++}`); values.push(is_suspended); }
    if (role          !== undefined) { updates.push(`role = $${idx++}`);         values.push(role); }

    if (updates.length === 0) throw Object.assign(new Error('No valid fields to update'), { status: 400 });

    updates.push(`updated_at = NOW()`);
    values.push(targetId);

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    await pool.query(`
        INSERT INTO admin_audit_logs (admin_id, action, target_table, target_id, details)
        VALUES ($1, 'UPDATE_USER', 'users', $2, $3)
    `, [adminId, targetId, JSON.stringify(req.body)]);

    return { success: true };
}));


/**
 * POST /api/admin/users/:id/approve-kyc
 * Instantly approve a worker's KYC and unlock their app via Firebase.
 */
router.post('/:id/approve-kyc', handle(async (adminId, pool, req) => {
    const targetId = req.params.id;

    const [rows] = await pool.query(
        'SELECT kyc_status FROM worker_profiles WHERE user_id = $1',
        [targetId]
    );
    if (!rows[0]) throw Object.assign(new Error('Worker profile not found'), { status: 404 });

    await pool.query(`
        UPDATE worker_profiles
        SET kyc_status = 'approved', is_verified = true, updated_at = NOW()
        WHERE user_id = $1
    `, [targetId]);

    // Real-time unlock: push to Firebase so the worker app reflects immediately
    try {
        const { updateWorkerNode } = await import('../../services/firebase.service.js');
        await updateWorkerNode(targetId, { is_verified: true, kyc_status: 'approved' });
    } catch (e) {
        console.warn('[Admin Users] Firebase sync skipped:', e.message);
    }

    await pool.query(`
        INSERT INTO admin_audit_logs (admin_id, action, target_table, target_id)
        VALUES ($1, 'APPROVE_KYC', 'worker_profiles', $2)
    `, [adminId, targetId]);

    // Best-effort push notification
    try {
        const { sendPushNotification } = await import('../../services/fcmService.js');
        await sendPushNotification(
            targetId,
            'Account Approved! 🎉',
            'You can now go online and start accepting jobs on Zarva.'
        );
    } catch (e) {
        console.warn('[Admin Users] Push notification skipped:', e.message);
    }

    return { success: true, message: 'Worker approved and unlocked.' };
}));

export default router;
