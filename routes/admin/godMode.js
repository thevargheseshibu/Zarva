/**
 * routes/admin/godMode.js
 *
 * Admin Command Center — God-Mode Backend
 * All routes are guarded by requireAdmin (applied via router.use below).
 *
 * Endpoints:
 *   PATCH /api/admin/tables/:table/:id      — Inline Data Grid cell editor + audit log
 *   POST  /api/admin/workers/:id/approve    — KYC approval pipeline
 *   GET   /api/admin/analytics/density      — Geospatial heatmap data (supply vs demand)
 */

import express from 'express';
import { getPool, fail } from '../../lib/db.js';
import { requireAdmin } from '../../middleware/roleGuard.js';

const router = express.Router();

// ─── GATE: every route in this file requires admin ──────────────────────────
router.use(requireAdmin);

// ─── Whitelist: only these tables may be patched via the Data Grid ───────────
const ALLOWED_TABLES = new Set([
    'users',
    'customer_profiles',
    'worker_profiles',
    'jobs',
    'job_materials',
    'tickets',
]);

// ─── Helper: safely quote column names (allow only word chars) ───────────────
const safeCol = (col) => /^[a-zA-Z0-9_]+$/.test(col);

/**
 * ─── DYNAMIC DATA GRID UPDATER (INLINE EDITING) ──────────────────────────
 * PATCH /api/admin/tables/:table/:id
 *
 * Body: { fieldName: newValue, ... }
 * Updates any column in a whitelisted table, records a full audit trail.
 */
router.patch('/tables/:table/:id', async (req, res) => {
    const adminId = req.user.id;
    const { table, id } = req.params;
    const updates = req.body;

    if (!ALLOWED_TABLES.has(table)) {
        return fail(res, `Table '${table}' is not permitted for dynamic editing`, 400, 'TABLE_FORBIDDEN');
    }
    if (!id || !/^\d+$/.test(id)) {
        return fail(res, 'Invalid record ID', 400, 'INVALID_ID');
    }
    const updateEntries = Object.entries(updates).filter(([key]) => safeCol(key));
    if (updateEntries.length === 0) {
        return res.status(200).json({ status: 'ok', message: 'No changes' });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        // 1. Snapshot previous data for the audit log
        const [prevRows] = await conn.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        if (!prevRows[0]) throw Object.assign(new Error('Record not found'), { status: 404 });

        // 2. Build parameterised UPDATE
        const setClauses = [];
        const values = [];
        let idx = 1;

        for (const [key, value] of updateEntries) {
            setClauses.push(`${key} = $${idx++}`);
            values.push(value);
        }
        setClauses.push(`updated_at = NOW()`);
        values.push(id);

        await conn.query(
            `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = $${idx}`,
            values
        );

        // 3. Write immutable audit record
        await conn.query(`
            INSERT INTO admin_audit_logs
                (admin_id, action, target_table, target_id, previous_data, new_data, ip_address)
            VALUES ($1, 'UPDATE_TABLE', $2, $3, $4, $5, $6)
        `, [
            adminId,
            table,
            id,
            JSON.stringify(prevRows[0]),
            JSON.stringify(Object.fromEntries(updateEntries)),
            req.ip,
        ]);

        await conn.commit();

        // 4. If editing a live job, sync the diff to Firebase in the background
        if (table === 'jobs') {
            import('../../services/firebase.service.js')
                .then(({ updateJobNode }) => updateJobNode(id, Object.fromEntries(updateEntries)))
                .catch((e) => console.warn('[Admin GodMode] Firebase sync skipped:', e.message));
        }

        return res.status(200).json({ status: 'ok', success: true });
    } catch (err) {
        await conn.rollback();
        console.error(`[Admin GodMode] PATCH ${table}/${id} error:`, err);
        return fail(res, err.message || 'Internal error', err.status || 500);
    } finally {
        conn.release();
    }
});


/**
 * ─── WORKER KYC APPROVAL PIPELINE ─────────────────────────────────────────
 * POST /api/admin/workers/:id/approve
 *
 * Flips kyc_status → 'approved', is_verified → true,
 * writes an audit record, and fires a push notification.
 */
router.post('/workers/:id/approve', async (req, res) => {
    const adminId = req.user.id;
    const workerId = req.params.id;

    if (!workerId || !/^\d+$/.test(workerId)) {
        return fail(res, 'Invalid worker ID', 400, 'INVALID_ID');
    }

    const pool = getPool();
    try {
        const [rows] = await pool.query(
            'SELECT kyc_status FROM worker_profiles WHERE user_id = $1',
            [workerId]
        );
        if (!rows[0]) return fail(res, 'Worker profile not found', 404, 'NOT_FOUND');

        await pool.query(`
            UPDATE worker_profiles
            SET kyc_status = 'approved', is_verified = true, updated_at = NOW()
            WHERE user_id = $1
        `, [workerId]);

        await pool.query(`
            INSERT INTO admin_audit_logs (admin_id, action, target_table, target_id, ip_address)
            VALUES ($1, 'APPROVE_WORKER', 'worker_profiles', $2, $3)
        `, [adminId, workerId, req.ip]);

        // Fire push notification — non-blocking, failure is tolerated
        try {
            const { sendPushNotification } = await import('../../services/fcmService.js');
            await sendPushNotification(
                workerId,
                'Account Approved! 🎉',
                'You can now go online and start accepting jobs on Zarva.'
            );
        } catch (notifyErr) {
            console.warn('[Admin GodMode] Push notification failed (non-fatal):', notifyErr.message);
        }

        return res.status(200).json({ status: 'ok', message: 'Worker approved and notified.' });
    } catch (err) {
        console.error('[Admin GodMode] Approve worker error:', err);
        return fail(res, 'Failed to approve worker', 500);
    }
});


/**
 * ─── GEOSPATIAL ANALYTICS (HEATMAP / RADAR DATA) ───────────────────────────
 * GET /api/admin/analytics/density
 *
 * Returns:
 *   supply: online, verified workers with GPS coordinates
 *   demand: jobs currently in 'searching' state
 */
router.get('/analytics/density', async (req, res) => {
    const pool = getPool();
    try {
        const [workers] = await pool.query(`
            SELECT
                user_id,
                name,
                category,
                last_location_lat  AS lat,
                last_location_lng  AS lng
            FROM worker_profiles
            WHERE is_online = true
              AND is_verified = true
              AND last_location_lat IS NOT NULL
              AND last_location_lng IS NOT NULL
        `);

        const [demand] = await pool.query(`
            SELECT
                id,
                category,
                hourly_rate,
                latitude   AS lat,
                longitude  AS lng
            FROM jobs
            WHERE status = 'searching'
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
        `);

        return res.status(200).json({
            status: 'ok',
            supply: workers,
            demand: demand,
        });
    } catch (err) {
        console.error('[Admin GodMode] Analytics density error:', err);
        return fail(res, 'Failed to fetch geospatial data', 500);
    }
});


/**
 * ─── AUDIT LOG VIEWER ──────────────────────────────────────────────────────
 * GET /api/admin/audit-logs?table=jobs&limit=50
 * Returns the last N audit log entries, optionally filtered by target_table.
 */
router.get('/audit-logs', async (req, res) => {
    const pool = getPool();
    const { table, limit = 50 } = req.query;
    try {
        const params = [];
        let where = '';
        if (table && safeCol(table)) {
            where = 'WHERE a.target_table = $1';
            params.push(table);
        }
        params.push(Math.min(parseInt(limit, 10) || 50, 500));

        const [rows] = await pool.query(`
            SELECT
                a.id, a.action, a.target_table, a.target_id,
                a.previous_data, a.new_data, a.ip_address, a.created_at,
                u.email AS admin_email
            FROM admin_audit_logs a
            LEFT JOIN users u ON a.admin_id = u.id
            ${where}
            ORDER BY a.created_at DESC
            LIMIT $${params.length}
        `, params);

        return res.status(200).json({ status: 'ok', logs: rows });
    } catch (err) {
        console.error('[Admin GodMode] Audit log fetch error:', err);
        return fail(res, 'Failed to fetch audit logs', 500);
    }
});

export default router;
