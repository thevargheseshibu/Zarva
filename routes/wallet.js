/**
 * routes/wallet.js
 * ZARVA Wallet API endpoints.
 */

import { Router } from 'express';
import { getPool } from '../config/database.js';
import * as walletService from '../services/wallet.service.js';
import * as withdrawalService from '../services/withdrawal.service.js';
import { roleGuard } from '../middleware/index.js';
import reAuthRequired from '../middleware/reAuthRequired.js';

const router = Router();

const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

/** paise → INR display string */
function paiseToINR(paise) {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Worker wallet ───

/** GET /api/wallet/worker/balance */
router.get('/worker/balance', roleGuard('worker'), async (req, res) => {
    try {
        const workerId = req.user.id;
        const pool = getPool();
        
        // 1. Available is exactly the current net ledger balance
        const available = await walletService.getAvailableBalance(workerId);
        
        // 2. Pending is the sum of processing withdrawals
        const [pendingRows] = await pool.query(
            `SELECT COALESCE(SUM(amount_paise), 0)::BIGINT AS pending 
             FROM withdrawal_requests WHERE worker_id = $1 AND status IN ('pending', 'processing')`,
            [workerId]
        );
        const pending = Number(pendingRows[0].pending);
        
        // 3. Lifetime Earnings (Total Credits to WORKER_EARNINGS, ignoring withdrawals)
        const [lifetimeRows] = await pool.query(
            `SELECT COALESCE(SUM(amount_paise), 0)::BIGINT AS total
             FROM ledger_entries le
             JOIN user_accounts ua ON le.user_account_id = ua.id
             WHERE ua.user_id = $1 AND ua.account_code = 'WORKER_EARNINGS' AND le.entry_type = 'credit'`,
            [workerId]
        );
        const total = Number(lifetimeRows[0].total);

        return ok(res, {
            available_paise: available,
            pending_paise: pending,
            total_paise: total,
            available_inr: paiseToINR(available),
            pending_inr: paiseToINR(pending),
            total_inr: paiseToINR(total)
        });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/** GET /api/wallet/worker/transactions */
router.get('/worker/transactions', roleGuard('worker'), async (req, res) => {
    try {
        const workerId = req.user.id;
        const { page = 1, limit = 20, filter } = req.query;
        const pool = getPool();
        const [ua] = await pool.query(
            `SELECT id FROM user_accounts WHERE user_id = $1 AND account_code = 'WORKER_EARNINGS'`,
            [workerId]
        );
        if (!ua[0]) {
            return ok(res, { transactions: [], total: 0, page: 1, limit: Number(limit) });
        }
        const userAccountId = ua[0].id;
        const eventFilter = filter === 'earnings' ? 'job_complete' : filter === 'withdrawals' ? 'worker_withdrawal' : null;
        const offset = (Math.max(1, Number(page)) - 1) * Math.min(50, Math.max(1, Number(limit)));
        const limitVal = Math.min(50, Math.max(1, Number(limit)));

        let rows, total;
        if (eventFilter) {
            const [r] = await pool.query(
                `SELECT le.id, le.transaction_id, le.entry_type, le.amount_paise, le.event_type, le.job_id, le.posted_at, le.description
                 FROM ledger_entries le WHERE le.user_account_id = $1 AND le.event_type = $2
                 ORDER BY le.posted_at DESC LIMIT $3 OFFSET $4`,
                [userAccountId, eventFilter, limitVal, offset]
            );
            const [c] = await pool.query(
                `SELECT COUNT(*)::INT AS total FROM ledger_entries le WHERE le.user_account_id = $1 AND le.event_type = $2`,
                [userAccountId, eventFilter]
            );
            rows = r;
            total = c[0]?.total ?? 0;
        } else {
            const [r] = await pool.query(
                `SELECT le.id, le.transaction_id, le.entry_type, le.amount_paise, le.event_type, le.job_id, le.posted_at, le.description
                 FROM ledger_entries le WHERE le.user_account_id = $1
                 ORDER BY le.posted_at DESC LIMIT $2 OFFSET $3`,
                [userAccountId, limitVal, offset]
            );
            const [c] = await pool.query(
                `SELECT COUNT(*)::INT AS total FROM ledger_entries le WHERE le.user_account_id = $1`,
                [userAccountId]
            );
            rows = r;
            total = c[0]?.total ?? 0;
        }
        const transactions = rows.map(r => ({
            id: r.id,
            transaction_id: r.transaction_id,
            type: r.entry_type,
            amount_paise: r.amount_paise,
            amount_inr: paiseToINR(r.amount_paise),
            event_type: r.event_type,
            job_id: r.job_id,
            posted_at: r.posted_at,
            description: r.description
        }));
        return ok(res, {
            transactions,
            total,
            page: Math.max(1, Number(page)),
            limit: limitVal
        });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/** GET /api/wallet/worker/earnings/:jobId */
router.get('/worker/earnings/:jobId', roleGuard('worker'), async (req, res) => {
    try {
        const workerId = req.user.id;
        const jobId = req.params.jobId;
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT le.entry_type, le.amount_paise, le.event_type, le.posted_at
             FROM ledger_entries le
             JOIN user_accounts ua ON le.user_account_id = ua.id
             WHERE ua.user_id = $1 AND ua.account_code = 'WORKER_EARNINGS' AND le.job_id = $2
             ORDER BY le.posted_at ASC`,
            [workerId, jobId]
        );
        const total = rows.reduce((sum, r) => sum + (r.entry_type === 'credit' ? r.amount_paise : -r.amount_paise), 0);
        return ok(res, {
            job_id: jobId,
            entries: rows.map(r => ({ ...r, amount_inr: paiseToINR(r.amount_paise) })),
            total_paise: total,
            total_inr: paiseToINR(total)
        });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/** POST /api/wallet/worker/withdraw */
router.post('/worker/withdraw', roleGuard('worker'), async (req, res) => {
    try {
        const workerId = req.user.id;
        // ⭐ Fetch payout_method from the request
        const { amount_paise, bank_account_id, payout_method } = req.body;
        const idempotencyKey = req.headers['x-idempotency-key'] || `withdraw_${workerId}_${Date.now()}`;

        if (!amount_paise || !bank_account_id) {
            return fail(res, 'amount_paise and bank_account_id required', 400);
        }
        const amount = parseInt(String(amount_paise), 10);
        if (isNaN(amount)) return fail(res, 'Invalid amount', 400);

        // ⭐ Pass payout_method to the service
        const result = await withdrawalService.initiateWithdrawal(workerId, amount, bank_account_id, payout_method, idempotencyKey);
        return ok(res, result);
    } catch (err) {
        return fail(res, err.message, err.status || 400, err.code);
    }
});

/** GET /api/wallet/worker/withdrawals */
router.get('/worker/withdrawals', roleGuard('worker'), async (req, res) => {
    try {
        const workerId = req.user.id;
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT id, amount_paise, status, initiated_at, processed_at
             FROM withdrawal_requests WHERE worker_id = $1 ORDER BY initiated_at DESC`,
            [workerId]
        );
        return ok(res, {
            withdrawals: rows.map(r => ({
                ...r,
                amount_inr: paiseToINR(r.amount_paise)
            }))
        });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

// ─── Customer wallet ───

/** GET /api/wallet/customer/outstanding */
router.get('/customer/outstanding', roleGuard('customer'), async (req, res) => {
    try {
        const customerId = req.user.id;
        const outstanding = await walletService.getCustomerOutstanding(customerId);
        return ok(res, {
            outstanding_paise: outstanding,
            outstanding_inr: paiseToINR(outstanding)
        });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/** GET /api/wallet/customer/transactions */
router.get('/customer/transactions', roleGuard('customer'), async (req, res) => {
    try {
        const customerId = req.user.id;
        const pool = getPool();
        const [ua] = await pool.query(
            `SELECT id FROM user_accounts WHERE user_id = $1 AND account_code = 'CUSTOMER_PAYABLE'`,
            [customerId]
        );
        if (!ua[0]) {
            return ok(res, { transactions: [] });
        }
        const [rows] = await pool.query(
            `SELECT le.id, le.transaction_id, le.entry_type, le.amount_paise, le.event_type, le.job_id, le.posted_at
             FROM ledger_entries le
             WHERE le.user_account_id = $1
             ORDER BY le.posted_at DESC
             LIMIT 50`,
            [ua[0].id]
        );
        return ok(res, {
            transactions: rows.map(r => ({
                ...r,
                amount_inr: paiseToINR(r.amount_paise)
            }))
        });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/** GET /api/wallet/customer/job/:jobId */
router.get('/customer/job/:jobId', roleGuard('customer'), async (req, res) => {
    try {
        const customerId = req.user.id;
        const jobId = req.params.jobId;
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT le.entry_type, le.amount_paise, le.event_type, le.posted_at
             FROM ledger_entries le
             JOIN user_accounts ua ON le.user_account_id = ua.id
             WHERE ua.user_id = $1 AND ua.account_code = 'CUSTOMER_PAYABLE' AND le.job_id = $2
             ORDER BY le.posted_at ASC`,
            [customerId, jobId]
        );
        return ok(res, {
            job_id: jobId,
            entries: rows.map(r => ({ ...r, amount_inr: paiseToINR(r.amount_paise) }))
        });
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

// ─── Bank accounts (worker) ───

/** POST /api/wallet/bank-accounts */
router.post('/bank-accounts', roleGuard('worker'), async (req, res) => {
    try {
        const workerId = req.user.id;
        const result = await withdrawalService.addBankAccount(workerId, req.body);
        return ok(res, result);
    } catch (err) {
        return fail(res, err.message, err.status || 400);
    }
});

/** GET /api/wallet/bank-accounts */
router.get('/bank-accounts', roleGuard('worker'), async (req, res) => {
    try {
        const workerId = req.user.id;
        const result = await withdrawalService.listBankAccounts(workerId);
        return ok(res, result);
    } catch (err) {
        return fail(res, err.message, err.status || 500);
    }
});

/** DELETE /api/wallet/bank-accounts/:id */
router.delete('/bank-accounts/:id', roleGuard('worker'), async (req, res) => {
    try {
        const workerId = req.user.id;
        await withdrawalService.removeBankAccount(workerId, req.params.id);
        return ok(res, { removed: true });
    } catch (err) {
        return fail(res, err.message, err.status || 404);
    }
});

export default router;
