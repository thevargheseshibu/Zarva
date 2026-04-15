import { Router } from 'express';
import { getPool } from '../../config/database.js';
import * as walletService from '../../services/wallet.service.js';
import { decrypt } from '../../utils/encryption.js';
import { sendFCM } from '../../services/notification.service.js'; // ⭐ NEW: Import Notification Service

const router = Router();

const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400) => res.status(status).json({ status: 'error', message });

// ─── 1. FINANCE OVERVIEW STATS ──────────────────────────────────────────
router.get('/overview', async (req, res) => {
    try {
        const pool = getPool();
        
        // Get Live Ledger Balances
        const [ledgerRows] = await pool.query(`
            SELECT la.account_code, SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount_paise ELSE -le.amount_paise END) as balance
            FROM ledger_accounts la
            LEFT JOIN ledger_entries le ON la.id = le.account_id
            WHERE la.account_code IN ('PLATFORM_REVENUE', 'ESCROW')
            GROUP BY la.account_code
        `);
        
        const balances = { PLATFORM_REVENUE: 0, ESCROW: 0 };
        ledgerRows.forEach(r => balances[r.account_code] = Number(r.balance || 0));

        // ⭐ FIX: Include BOTH 'pending' and 'processing' statuses so stats aren't zero
        const [pendingPayouts] = await pool.query(`
            SELECT COALESCE(SUM(amount_paise), 0) as total, COUNT(*) as count 
            FROM withdrawal_requests WHERE status IN ('pending', 'processing')
        `);

        return ok(res, {
            platform_revenue_paise: balances.PLATFORM_REVENUE,
            escrow_held_paise: balances.ESCROW,
            pending_payouts_paise: Number(pendingPayouts[0].total),
            pending_payouts_count: Number(pendingPayouts[0].count)
        });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

// ─── 2. CUSTOMER PAYMENTS (MONEY IN) ────────────────────────────────────
router.get('/payments', async (req, res) => {
    try {
        const pool = getPool();
        const { status, limit = 50 } = req.query;
        
        let query = `
            SELECT p.*, j.category as job_category, 
                   COALESCE(cp.name, u.phone) as customer_name
            FROM payments p
            JOIN jobs j ON p.job_id = j.id
            JOIN users u ON p.customer_id = u.id
            LEFT JOIN customer_profiles cp ON u.id = cp.user_id
        `;
        const params = [];
        
        if (status && status !== 'all') {
            query += ` WHERE p.status = $1`;
            params.push(status);
        }
        
        query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const [rows] = await pool.query(query, params);
        return ok(res, { payments: rows });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

// ─── 3. WORKER PAYOUTS (MONEY OUT) ──────────────────────────────────────
router.get('/payouts', async (req, res) => {
    try {
        const pool = getPool();
        // ⭐ FIX: Default to 'processing' since worker withdrawals jump to processing immediately to lock funds
        const { status = 'processing' } = req.query;

        const [requests] = await pool.query(`
            SELECT w.*, wp.name as worker_name, wp.category,
                   b.account_holder_name, b.ifsc_code, b.bank_name, b.upi_id
            FROM withdrawal_requests w
            JOIN worker_profiles wp ON w.worker_id = wp.user_id
            LEFT JOIN worker_bank_accounts b ON w.bank_account_id = b.id
            WHERE w.status = $1
            ORDER BY w.initiated_at ASC
        `, [status]);

        // Attach real-time available balance to flag risks
        for (let req of requests) {
            req.current_available_paise = await walletService.getAvailableBalance(req.worker_id);
        }

        return ok(res, { payouts: requests });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

// Decrypt Bank Details
router.get('/payouts/:id/bank-details', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.query(`
            SELECT b.account_number_encrypted 
            FROM withdrawal_requests w
            JOIN worker_bank_accounts b ON w.bank_account_id = b.id
            WHERE w.id = $1
        `, [req.params.id]);

        if (!rows[0]) return fail(res, 'Bank account not found', 404);
        const decryptedAccount = decrypt(rows[0].account_number_encrypted);
        return ok(res, { account_number: decryptedAccount });
    } catch (err) {
        return fail(res, 'Decryption failed. Ensure ENCRYPTION_KEY is set.', 500);
    }
});

// Process Manual Payout
router.post('/payouts/:id/process', async (req, res) => {
    const { action, transaction_ref, failure_reason } = req.body; 
    const requestId = req.params.id;
    const pool = getPool();
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const [rows] = await conn.query(`SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE`, [requestId]);
        const request = rows[0];

        // ⭐ FIX: Check for both 'pending' AND 'processing' to allow admin to settle it
        if (!request || !['pending', 'processing'].includes(request.status)) {
            throw new Error('Request is not in a valid active state to be processed.');
        }

        const amountINR = (request.amount_paise / 100).toFixed(2);

        if (action === 'complete') {
            await conn.query(`
                UPDATE withdrawal_requests SET status = 'completed', transaction_ref = $1, processed_at = NOW() WHERE id = $2
            `, [transaction_ref || 'MANUAL_TRANSFER', requestId]);
            
            // ⭐ NEW: Notify Worker of Success
            try {
                await sendFCM(
                    request.worker_id, 
                    'Payout Completed 💰', 
                    `Your withdrawal of ₹${amountINR} has been successfully transferred to your bank account.`, 
                    { type: 'payout_completed', request_id: requestId }
                );
            } catch (e) { console.warn('Failed to send success FCM', e.message); }

        } else if (action === 'fail') {
            await conn.query(`
                UPDATE withdrawal_requests SET status = 'failed', failure_reason = $1, processed_at = NOW() WHERE id = $2
            `, [failure_reason || 'Rejected by Admin', requestId]);

            // Reverse funds to worker wallet
            await walletService.postWithdrawalReversalEntries(request.worker_id, request.amount_paise, requestId, conn);
            
            // ⭐ NEW: Notify Worker of Failure
            try {
                await sendFCM(
                    request.worker_id, 
                    'Payout Failed ⚠️', 
                    `Your withdrawal of ₹${amountINR} failed. Reason: ${failure_reason || 'Admin Rejection'}. Funds have been returned to your wallet.`, 
                    { type: 'payout_failed', request_id: requestId }
                );
            } catch (e) { console.warn('Failed to send failure FCM', e.message); }
        }
        
        await conn.commit();
        return ok(res, { success: true });
    } catch (err) {
        await conn.rollback();
        return fail(res, err.message, 500);
    } finally {
        conn.release();
    }
});

// ─── 4. EMERGENCY RESYNC (Fix Missing Ledger Entries) ────────────────────
router.post('/resync-ledgers', async (req, res) => {
    const pool = getPool();
    try {
        const [missingJobs] = await pool.query(`
            SELECT j.id, j.customer_id, j.worker_id, j.final_amount, j.materials_cost
            FROM jobs j
            LEFT JOIN ledger_entries le ON j.id = le.job_id AND le.event_type = 'job_complete'
            WHERE j.status = 'completed' AND j.payment_status = 'paid' AND le.id IS NULL
        `);

        let synced = 0;
        for (let job of missingJobs) {
            const laborPaise = Math.round((Number(job.final_amount || 0) - Number(job.materials_cost || 0)) * 100);
            const materialsPaise = Math.round(Number(job.materials_cost || 0) * 100);
            
            await walletService.postJobCompleteEntries(
                job.id, laborPaise, materialsPaise, job.customer_id, job.worker_id, pool
            );
            synced++;
        }
        return ok(res, { message: `Successfully resynced ${synced} missing job ledgers.` });
    } catch (err) {
        return fail(res, err.message, 500);
    }
});

export default router;
