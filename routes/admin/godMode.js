/**
 * routes/admin/godMode.js
 *
 * Admin Command Center — God-Mode CRUD Backend
 * Allows super admins to read and edit ANY field in ANY whitelisted table.
 * Every mutation is recorded in admin_audit_logs for full traceability.
 */

import express from 'express';
import { getPool, fail } from '../../lib/db.js';

const router = express.Router();

// ⭐ FIX 1: Updated to correct table names (support_tickets, ticket_messages)
const ALLOWED_TABLES = new Set([
    'users',
    'customer_profiles',
    'worker_profiles',
    'jobs',
    'job_materials',
    'support_tickets',
    'ticket_messages',
    'payments',
]);

// ─── Helper: validate column name to prevent injection ──────────────────────
const safeCol = (col) => /^[a-zA-Z0-9_]+$/.test(col);

// ─── Columns that must NEVER be exposed or editable ─────────────────────────
const BLOCKED_COLUMNS = new Set([
    'password_hash', 'start_otp_hash', 'end_otp_hash',
    'inspection_otp_hash', 'pause_otp_hash', 'resume_otp_hash',
    'suspend_otp_hash', 'extension_otp_hash',
    'token_hash', 'jwt_secret',
]);


/**
 * ─── ENTITY READER ────────────────────────────────────────────────────────
 * GET /api/admin/tables/:table/:id
 */
router.get('/tables/:table/:id', async (req, res) => {
    const { table, id } = req.params;

    if (!ALLOWED_TABLES.has(table)) {
        return fail(res, `Table '${table}' is not permitted`, 400, 'TABLE_FORBIDDEN');
    }
    
    // ⭐ FIX 2: Allow UUIDs (alphanumeric and dashes) instead of just digits
    if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) {
        return fail(res, 'Invalid record ID format', 400, 'INVALID_ID');
    }

    const pool = getPool();
    try {
        const idCol = table === 'worker_profiles' || table === 'customer_profiles' ? 'user_id' : 'id';
        const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idCol} = $1`, [id]);

        if (!rows[0]) {
            return fail(res, 'Record not found', 404, 'NOT_FOUND');
        }

        // Strip sensitive hash columns
        const entity = { ...rows[0] };
        for (const col of BLOCKED_COLUMNS) {
            delete entity[col];
        }

        return res.status(200).json({ status: 'ok', entity, table });
    } catch (err) {
        console.error(`[GodMode] GET ${table}/${id} error:`, err);
        return fail(res, 'Failed to fetch entity', 500);
    }
});


/**
 * ─── DYNAMIC FIELD UPDATER ────────────────────────────────────────────────
 * PATCH /api/admin/tables/:table/:id
 */
router.patch('/tables/:table/:id', async (req, res) => {
    const adminId = req.user.id;
    const { table, id } = req.params;
    const updates = req.body;

    if (!ALLOWED_TABLES.has(table)) {
        return fail(res, `Table '${table}' is not permitted for editing`, 400, 'TABLE_FORBIDDEN');
    }
    
    // ⭐ FIX 2: Allow UUIDs (alphanumeric and dashes) instead of just digits
    if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) {
        return fail(res, 'Invalid record ID format', 400, 'INVALID_ID');
    }

    const updateEntries = Object.entries(updates)
        .filter(([key]) => safeCol(key) && !BLOCKED_COLUMNS.has(key));

    if (updateEntries.length === 0) {
        return res.status(200).json({ status: 'ok', message: 'No changes' });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const idCol = table === 'worker_profiles' || table === 'customer_profiles' ? 'user_id' : 'id';

        const [prevRows] = await conn.query(`SELECT * FROM ${table} WHERE ${idCol} = $1`, [id]);
        if (!prevRows[0]) throw Object.assign(new Error('Record not found'), { status: 404 });

        const setClauses = [];
        const values = [];
        let idx = 1;

        for (const [key, value] of updateEntries) {
            setClauses.push(`${key} = $${idx++}`);
            values.push(value);
        }

        const prevKeys = Object.keys(prevRows[0]);
        if (prevKeys.includes('updated_at')) {
            setClauses.push(`updated_at = NOW()`);
        }

        values.push(id);

        await conn.query(
            `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${idCol} = $${idx}`,
            values
        );

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

        if (table === 'jobs') {
            import('../../services/firebase.service.js')
                .then(({ updateJobNode }) => updateJobNode(id, Object.fromEntries(updateEntries)))
                .catch((e) => console.warn('[GodMode] Firebase sync skipped:', e.message));
        }

        return res.status(200).json({ status: 'ok', success: true, modified: updateEntries.length });
    } catch (err) {
        await conn.rollback();
        console.error(`[GodMode] PATCH ${table}/${id} error:`, err);
        return fail(res, err.message || 'Internal error', err.status || 500);
    } finally {
        conn.release();
    }
});


/**
 * ─── WORKER KYC APPROVAL ─────────────────────────────────────────────────
 * POST /api/admin/workers/:id/approve
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

        try {
            const { sendPushNotification } = await import('../../services/fcmService.js');
            await sendPushNotification(
                workerId,
                'Account Approved! 🎉',
                'You can now go online and start accepting jobs on Zarva.'
            );
        } catch (notifyErr) {
            console.warn('[GodMode] Push notification failed (non-fatal):', notifyErr.message);
        }

        return res.status(200).json({ status: 'ok', message: 'Worker approved and notified.' });
    } catch (err) {
        console.error('[GodMode] Approve worker error:', err);
        return fail(res, 'Failed to approve worker', 500);
    }
});


/**
 * ─── AUDIT LOG VIEWER ─────────────────────────────────────────────────────
 * GET /api/admin/audit-logs?table=jobs&limit=50
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
                u.name AS admin_name, u.phone AS admin_phone
            FROM admin_audit_logs a
            LEFT JOIN users u ON a.admin_id = u.id
            ${where}
            ORDER BY a.created_at DESC
            LIMIT $${params.length}
        `, params);

        return res.status(200).json({ status: 'ok', logs: rows });
    } catch (err) {
        console.error('[GodMode] Audit log fetch error:', err);
        return fail(res, 'Failed to fetch audit logs', 500);
    }
});

export default router;
