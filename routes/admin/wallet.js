/**
 * routes/admin/wallet.js
 * Admin wallet: platform balance, reconciliation, audit.
 */

import { Router } from 'express';
import { getPool } from '../../config/database.js';
import * as reconciliationService from '../../services/reconciliation.service.js';

const router = Router();

const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400) => res.status(status).json({ status: 'error', message });

function paiseToINR(paise) {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** GET /api/admin/wallet/platform-balance */
router.get('/platform-balance', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount_paise ELSE -le.amount_paise END) AS balance
             FROM ledger_entries le
             JOIN ledger_accounts la ON le.account_id = la.id
             WHERE la.account_code = 'PLATFORM_REVENUE'`
        );
        const balance = Number(rows[0]?.balance ?? 0);
        return ok(res, { platform_balance_paise: balance, platform_balance_inr: paiseToINR(balance) });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

/** GET /api/admin/wallet/reconciliation */
router.get('/reconciliation', async (req, res) => {
    try {
        const { report, hasError } = await reconciliationService.runDailyReconciliation();
        return ok(res, { report, hasError });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

/** GET /api/admin/wallet/audit-log */
router.get('/audit-log', async (req, res) => {
    try {
        const { user_id, job_id, limit = 50 } = req.query;
        const pool = getPool();
        const limitVal = Math.min(100, Math.max(1, Number(limit)));
        let rows;
        if (user_id && job_id) {
            const [r] = await pool.query(
                'SELECT * FROM wallet_audit_log WHERE (actor_user_id = $1 OR affected_user_id = $1) AND job_id = $2 ORDER BY created_at DESC LIMIT $3',
                [user_id, job_id, limitVal]
            );
            rows = r;
        } else if (user_id) {
            const [r] = await pool.query(
                'SELECT * FROM wallet_audit_log WHERE actor_user_id = $1 OR affected_user_id = $1 ORDER BY created_at DESC LIMIT $2',
                [user_id, limitVal]
            );
            rows = r;
        } else if (job_id) {
            const [r] = await pool.query(
                'SELECT * FROM wallet_audit_log WHERE job_id = $1 ORDER BY created_at DESC LIMIT $2',
                [job_id, limitVal]
            );
            rows = r;
        } else {
            const [r] = await pool.query(
                'SELECT * FROM wallet_audit_log ORDER BY created_at DESC LIMIT $1',
                [limitVal]
            );
            rows = r;
        }
        return ok(res, { audit_log: rows });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

export default router;
