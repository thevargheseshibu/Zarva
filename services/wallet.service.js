/**
 * services/wallet.service.js
 * ZARVA Server-Side Wallet & Ledger System
 * Double-entry bookkeeping. All amounts in PAISE (integer). No floats.
 */

import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database.js';

// Limits (paise)
const MAX_SINGLE_JOB_PAISE = 2_000_000;   // ₹20,000
const MAX_SINGLE_WITHDRAWAL_PAISE = 2_000_000;  // ₹20,000
const MAX_DAILY_WITHDRAWAL_PAISE = 5_000_000;   // ₹50,000
const MIN_SINGLE_WITHDRAWAL_PAISE = 100_000;  // ₹1,000 minimum redeem

/** Ensure user has user_account for given account_code, return id */
async function getOrCreateUserAccount(pool, userId, accountCode) {
    const [existing] = await pool.query(
        `SELECT id FROM user_accounts WHERE user_id = $1 AND account_code = $2`,
        [userId, accountCode]
    );
    if (existing[0]) return existing[0].id;
    const [inserted] = await pool.query(
        `INSERT INTO user_accounts (user_id, account_code) VALUES ($1, $2) RETURNING id`,
        [userId, accountCode]
    );
    return inserted[0].id;
}

/** Get system account id by code */
async function getAccountId(pool, accountCode) {
    const [rows] = await pool.query(
        `SELECT id FROM ledger_accounts WHERE account_code = $1`,
        [accountCode]
    );
    if (!rows[0]) throw new Error(`Ledger account not found: ${accountCode}`);
    return rows[0].id;
}

/** Insert single ledger entry */
async function insertEntry(pool, entry) {
    await pool.query(
        `INSERT INTO ledger_entries (
          transaction_id, entry_sequence, account_id, user_account_id,
          entry_type, amount_paise, event_type, job_id, payment_id,
          idempotency_key, description, triggered_by_user_id, triggered_by_system
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (idempotency_key) DO NOTHING`,
        [
            entry.transaction_id, entry.entry_sequence, entry.account_id, entry.user_account_id ?? null,
            entry.entry_type, entry.amount_paise, entry.event_type, entry.job_id ?? null, entry.payment_id ?? null,
            entry.idempotency_key, entry.description, entry.triggered_by_user_id ?? null, entry.triggered_by_system ?? false
        ]
    );
}

/** Check idempotency by exact key */
async function checkIdempotency(pool, idempotencyKey) {
    const [rows] = await pool.query(
        `SELECT transaction_id FROM ledger_entries WHERE idempotency_key = $1 LIMIT 1`,
        [idempotencyKey]
    );
    return rows[0]?.transaction_id ?? null;
}

/** Check if any entry with a given prefix exists (e.g. for job completion retries) */
async function checkIdempotencyPrefix(pool, prefix) {
    const [rows] = await pool.query(
        `SELECT transaction_id FROM ledger_entries WHERE idempotency_key LIKE $1 LIMIT 1`,
        [`${prefix}_%`]
    );
    return rows[0]?.transaction_id ?? null;
}

/** Write audit log */
async function auditLog(pool, data) {
    await pool.query(
        `INSERT INTO wallet_audit_log (action, actor_user_id, actor_type, affected_user_id, job_id, amount_paise, before_balance_paise, after_balance_paise, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
            data.action, data.actor_user_id ?? null, data.actor_type ?? null, data.affected_user_id ?? null,
            data.job_id ?? null, data.amount_paise ?? null, data.before_balance_paise ?? null, data.after_balance_paise ?? null,
            data.metadata ? JSON.stringify(data.metadata) : null
        ]
    );
}

/** Get balance from ledger for user account (source of truth) */
export async function getBalance(userId, accountCode) {
    const pool = getPool();
    const [rows] = await pool.query(
        `SELECT SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount_paise ELSE -le.amount_paise END) AS balance
         FROM ledger_entries le
         JOIN user_accounts ua ON le.user_account_id = ua.id
         WHERE ua.user_id = $1 AND ua.account_code = $2`,
        [userId, accountCode]
    );
    const balance = Number(rows[0]?.balance ?? 0);
    return Math.max(0, balance);
}

/** Get available balance (earnings minus pending withdrawals) */
export async function getAvailableBalance(workerId) {
    const totalEarnings = await getBalance(workerId, 'WORKER_EARNINGS');
    const pool = getPool();
    const [rows] = await pool.query(
        `SELECT COALESCE(SUM(amount_paise), 0)::BIGINT AS pending
         FROM withdrawal_requests WHERE worker_id = $1 AND status IN ('pending', 'processing')`,
        [workerId]
    );
    const pending = Number(rows[0]?.pending ?? 0);
    return Math.max(0, totalEarnings - pending);
}

/** Get customer outstanding (what they owe) */
export async function getCustomerOutstanding(customerId) {
    return getBalance(customerId, 'CUSTOMER_PAYABLE');
}

/** Recompute balance cache for user account */
export async function recomputeBalanceCache(userAccountId) {
    const pool = getPool();
    const [ua] = await pool.query(
        `SELECT user_id, account_code FROM user_accounts WHERE id = $1`,
        [userAccountId]
    );
    if (!ua[0]) return;
    const balance = await getBalance(ua[0].user_id, ua[0].account_code);
    const [last] = await pool.query(
        `SELECT id FROM ledger_entries WHERE user_account_id = $1 ORDER BY posted_at DESC LIMIT 1`,
        [userAccountId]
    );
    await pool.query(
        `INSERT INTO wallet_balance_cache (user_account_id, balance_paise, pending_paise, available_paise, last_computed_at, last_entry_id)
         VALUES ($1, $2, 0, $2, NOW(), $3)
         ON CONFLICT (user_account_id) DO UPDATE SET
           balance_paise = EXCLUDED.balance_paise,
           available_paise = EXCLUDED.available_paise,
           last_computed_at = NOW(),
           last_entry_id = EXCLUDED.last_entry_id`,
        [userAccountId, balance, last[0]?.id ?? null]
    );
}

/**
 * EVENT 1: Job starts (customer gives START OTP)
 * DEBIT ESCROW, CREDIT CUSTOMER_PAYABLE
 */
export async function postJobStartEntries(jobId, estimatedAmountPaise, customerId, pool) {
    if (estimatedAmountPaise <= 0 || estimatedAmountPaise > MAX_SINGLE_JOB_PAISE) {
        throw new Error('Invalid estimated amount');
    }
    const idempotencyKey = `job_start_${jobId}`;
    const existing = await checkIdempotency(pool, idempotencyKey);
    if (existing) return { transaction_id: existing };

    const escrowId = await getAccountId(pool, 'ESCROW');
    const customerPayableId = await getAccountId(pool, 'CUSTOMER_PAYABLE');
    const customerAccountId = await getOrCreateUserAccount(pool, customerId, 'CUSTOMER_PAYABLE');
    const txnId = uuidv4();

    await insertEntry(pool, {
        transaction_id: txnId,
        entry_sequence: 1,
        account_id: escrowId,
        user_account_id: null,
        entry_type: 'debit',
        amount_paise: estimatedAmountPaise,
        event_type: 'job_start',
        job_id: jobId,
        idempotency_key: idempotencyKey,
        description: `Job ${jobId} started – escrow +${estimatedAmountPaise} paise`,
        triggered_by_system: true
    });
    await insertEntry(pool, {
        transaction_id: txnId,
        entry_sequence: 2,
        account_id: customerPayableId,
        user_account_id: customerAccountId,
        entry_type: 'credit',
        amount_paise: estimatedAmountPaise,
        event_type: 'job_start',
        job_id: jobId,
        idempotency_key: `${idempotencyKey}_credit`,
        description: `Job ${jobId} started – customer payable +${estimatedAmountPaise} paise`,
        triggered_by_system: true
    });

    await pool.query(
        `INSERT INTO customer_pending_dues (customer_id, job_id, amount_paise, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (job_id) DO UPDATE SET amount_paise = EXCLUDED.amount_paise, status = 'pending'`,
        [customerId, jobId, estimatedAmountPaise]
    );

    await recomputeBalanceCache(customerAccountId);
    return { transaction_id: txnId };
}

/**
 * EVENT 2: Job completes
 * Release escrow, split to worker/platform/gateway/gst
 */
export async function postJobCompleteEntries(jobId, laborAmountPaise, materialAmountPaise, customerId, workerId, pool) {
    const finalAmountPaise = laborAmountPaise + materialAmountPaise;

    if (finalAmountPaise <= 0 || finalAmountPaise > MAX_SINGLE_JOB_PAISE) {
        throw new Error(`Invalid final amount: ${finalAmountPaise} paise (labor: ${laborAmountPaise}, materials: ${materialAmountPaise})`);
    }
    
    // Validate that the amounts are consistent with job data to prevent double ledger issues
    const [jobCheck] = await pool.query(`
        SELECT final_labor_paise, final_material_paise, grand_total_paise, status
        FROM jobs WHERE id = $1
    `, [jobId]);
    
    if (jobCheck.length > 0) {
        const job = jobCheck[0];
        const expectedTotal = (job.final_labor_paise || 0) + (job.final_material_paise || 0);
        const declaredTotal = job.grand_total_paise || 0;
        
        if (laborAmountPaise !== (job.final_labor_paise || 0) || 
            materialAmountPaise !== (job.final_material_paise || 0) ||
            finalAmountPaise !== declaredTotal) {
            console.warn(`[Wallet] Amount mismatch detected for job ${jobId}: 
                labor expected ${job.final_labor_paise}, got ${laborAmountPaise}
                materials expected ${job.final_material_paise}, got ${materialAmountPaise}
                total expected ${declaredTotal}, got ${finalAmountPaise}`);
            
            // Use the job's declared amounts to prevent ledger imbalance
            laborAmountPaise = job.final_labor_paise || 0;
            materialAmountPaise = job.final_material_paise || 0;
            finalAmountPaise = declaredTotal;
            
            console.log(`[Wallet] Using corrected amounts for job ${jobId}: labor=${laborAmountPaise}, materials=${materialAmountPaise}, total=${finalAmountPaise}`);
        }
    }
    
    const idempotencyKey = `job_complete_${jobId}`;
    // Check if ANY entry for this job's completion already exists (idempotency)
    const existing = await checkIdempotencyPrefix(pool, idempotencyKey);
    if (existing) {
        console.log(`[Wallet] Job completion entries already exist for job ${jobId}, skipping duplicate ledger entries`);
        return { transaction_id: existing };
    }

    // ─── Correct Split Architecture ──────────────────────────────────────────
    // Materials = pure pass-through. No gateway fee or GST charged on them.
    // ALL fees are calculated ONLY on the labor portion:
    //   70% worker labor share + 25% platform + 2% gateway + ~3% GST remainder
    // This guarantees: credits always = finalAmountPaise, regardless of labor ratio.
    const workerLaborSharePaise = Math.floor(laborAmountPaise * 0.70);
    const platformSharePaise = Math.floor(laborAmountPaise * 0.25);
    const gatewayFeePaise = Math.floor(laborAmountPaise * 0.02);
    // GST = remainder of labor (always >= 0 since 70+25+2=97%, remainder=3+ rounding)
    const gstFromLaborPaise = laborAmountPaise - workerLaborSharePaise - platformSharePaise - gatewayFeePaise;
    // Worker total = labor share + 100% of materials
    const workerTotalSharePaise = workerLaborSharePaise + materialAmountPaise;

    console.log(`[Wallet] Job ${jobId} Complete Split:`, {
        labor: laborAmountPaise,
        materials: materialAmountPaise,
        finalTotal: finalAmountPaise,
        workerShare: workerTotalSharePaise,
        platformShare: platformSharePaise,
        gatewayFee: gatewayFeePaise,
        gst: gstFromLaborPaise,
        checkSum: workerTotalSharePaise + platformSharePaise + gatewayFeePaise + gstFromLaborPaise,
    });

    // Sanity guard — must always balance before touching the DB
    if (workerTotalSharePaise + platformSharePaise + gatewayFeePaise + gstFromLaborPaise !== finalAmountPaise) {
        throw new Error(`[Wallet] Ledger would be unbalanced for job ${jobId}. Aborting.`);
    }

    const escrowId = await getAccountId(pool, 'ESCROW');
    const customerPayableId = await getAccountId(pool, 'CUSTOMER_PAYABLE');
    const workerEarningsId = await getAccountId(pool, 'WORKER_EARNINGS');
    const platformRevenueId = await getAccountId(pool, 'PLATFORM_REVENUE');
    const gatewayFeesId = await getAccountId(pool, 'PAYMENT_GATEWAY_FEES');
    const gstId = await getAccountId(pool, 'GST_COLLECTED');

    const customerAccountId = await getOrCreateUserAccount(pool, customerId, 'CUSTOMER_PAYABLE');
    const workerAccountId = await getOrCreateUserAccount(pool, workerId, 'WORKER_EARNINGS');

    const txnId = uuidv4();
    let seq = 1;

    // Only insert if amount > 0 — DB has CHECK (amount_paise > 0)
    const maybeInsert = async (entry) => {
        if (entry.amount_paise <= 0) {
            console.log(`[Wallet] Skipping zero-value entry: ${entry.idempotency_key}`);
            return;
        }
        await insertEntry(pool, entry);
    };

    // DEBIT: Release full amount from escrow
    await insertEntry(pool, {
        transaction_id: txnId, entry_sequence: seq++,
        account_id: escrowId, user_account_id: null,
        entry_type: 'debit', amount_paise: finalAmountPaise,
        event_type: 'job_complete', job_id: jobId,
        idempotency_key: `${idempotencyKey}_escrow_debit`,
        description: `Job ${jobId} – release from escrow`,
        triggered_by_system: true,
    });

    // CREDIT: Worker earnings (labor share + full material reimbursement)
    await insertEntry(pool, {
        transaction_id: txnId, entry_sequence: seq++,
        account_id: workerEarningsId, user_account_id: workerAccountId,
        entry_type: 'credit', amount_paise: workerTotalSharePaise,
        event_type: 'job_complete', job_id: jobId,
        idempotency_key: `${idempotencyKey}_worker`,
        description: `Job ${jobId} – worker (70% labor + 100% materials)`,
        triggered_by_system: true,
    });

    // CREDIT: Platform commission (only on labor, skipped if labor=0)
    await maybeInsert({
        transaction_id: txnId, entry_sequence: seq++,
        account_id: platformRevenueId, user_account_id: null,
        entry_type: 'credit', amount_paise: platformSharePaise,
        event_type: 'job_complete', job_id: jobId,
        idempotency_key: `${idempotencyKey}_platform`,
        description: `Job ${jobId} – platform 25% of labor`,
        triggered_by_system: true,
    });

    // CREDIT: Payment gateway fee (only on labor, skipped if labor=0)
    await maybeInsert({
        transaction_id: txnId, entry_sequence: seq++,
        account_id: gatewayFeesId, user_account_id: null,
        entry_type: 'credit', amount_paise: gatewayFeePaise,
        event_type: 'job_complete', job_id: jobId,
        idempotency_key: `${idempotencyKey}_gateway`,
        description: `Job ${jobId} – gateway 2% of labor`,
        triggered_by_system: true,
    });

    // CREDIT: GST remainder from labor (skipped if labor=0)
    await maybeInsert({
        transaction_id: txnId, entry_sequence: seq++,
        account_id: gstId, user_account_id: null,
        entry_type: 'credit', amount_paise: gstFromLaborPaise,
        event_type: 'job_complete', job_id: jobId,
        idempotency_key: `${idempotencyKey}_gst`,
        description: `Job ${jobId} – GST remainder from labor`,
        triggered_by_system: true,
    });

    await pool.query(
        `UPDATE customer_pending_dues SET status = 'paid', settled_at = NOW() WHERE job_id = $1`,
        [jobId]
    );

    await recomputeBalanceCache(customerAccountId);
    await recomputeBalanceCache(workerAccountId);

    return { transaction_id: txnId };
}

/**
 * EVENT 3: Customer pays (Razorpay callback)
 */
export async function postPaymentReceivedEntries(customerId, amountPaise, gatewayRef, jobId, pool) {
    const idempotencyKey = `payment_received_${gatewayRef}`;
    const existing = await checkIdempotency(pool, idempotencyKey);
    if (existing) return { transaction_id: existing };

    const bankInflowId = await getAccountId(pool, 'BANK_INFLOW');
    const customerPayableId = await getAccountId(pool, 'CUSTOMER_PAYABLE');
    const customerAccountId = await getOrCreateUserAccount(pool, customerId, 'CUSTOMER_PAYABLE');
    const txnId = uuidv4();

    await insertEntry(pool, {
        transaction_id: txnId,
        entry_sequence: 1,
        account_id: bankInflowId,
        user_account_id: null,
        entry_type: 'debit',
        amount_paise: amountPaise,
        event_type: 'payment_received',
        job_id: jobId ?? null,
        idempotency_key: idempotencyKey,
        description: `Payment received ${gatewayRef} – +${amountPaise} paise`,
        triggered_by_system: true
    });
    await insertEntry(pool, {
        transaction_id: txnId,
        entry_sequence: 2,
        account_id: customerPayableId,
        user_account_id: customerAccountId,
        entry_type: 'credit',
        amount_paise: amountPaise,
        event_type: 'payment_received',
        job_id: jobId ?? null,
        idempotency_key: `${idempotencyKey}_credit`,
        description: `Payment received – customer payable -${amountPaise} paise`,
        triggered_by_system: true
    });

    if (jobId) {
        await pool.query(
            `UPDATE customer_pending_dues SET settled_at = NOW() WHERE job_id = $1`,
            [jobId]
        );
    }

    await recomputeBalanceCache(customerAccountId);
    return { transaction_id: txnId };
}

/**
 * EVENT 4: Worker withdraws earnings
 */
export async function postWithdrawalEntries(workerId, amountPaise, withdrawalRequestId, pool) {
    if (amountPaise <= 0 || amountPaise > MAX_SINGLE_WITHDRAWAL_PAISE) {
        throw new Error('Invalid withdrawal amount');
    }
    const available = await getAvailableBalance(workerId);
    if (amountPaise > available) {
        const err = new Error('Insufficient funds');
        err.code = 'INSUFFICIENT_FUNDS';
        err.available_paise = available;
        throw err;
    }

    const idempotencyKey = `withdrawal_${withdrawalRequestId}`;
    const existing = await checkIdempotency(pool, idempotencyKey);
    if (existing) return { transaction_id: existing };

    const workerEarningsId = await getAccountId(pool, 'WORKER_EARNINGS');
    const bankOutflowId = await getAccountId(pool, 'BANK_OUTFLOW');
    const workerAccountId = await getOrCreateUserAccount(pool, workerId, 'WORKER_EARNINGS');
    const txnId = uuidv4();

    await insertEntry(pool, {
        transaction_id: txnId,
        entry_sequence: 1,
        account_id: workerEarningsId,
        user_account_id: workerAccountId,
        entry_type: 'debit',
        amount_paise: amountPaise,
        event_type: 'worker_withdrawal',
        idempotency_key: idempotencyKey,
        description: `Withdrawal ${withdrawalRequestId} – worker earnings -${amountPaise} paise`,
        triggered_by_user_id: workerId,
        triggered_by_system: false
    });
    await insertEntry(pool, {
        transaction_id: txnId,
        entry_sequence: 2,
        account_id: bankOutflowId,
        user_account_id: null,
        entry_type: 'credit',
        amount_paise: amountPaise,
        event_type: 'worker_withdrawal',
        idempotency_key: `${idempotencyKey}_credit`,
        description: `Withdrawal ${withdrawalRequestId} – bank outflow +${amountPaise} paise`,
        triggered_by_user_id: workerId,
        triggered_by_system: false
    });

    await pool.query(
        `UPDATE withdrawal_requests SET status = 'processing' WHERE id = $1`,
        [withdrawalRequestId]
    );

    await recomputeBalanceCache(workerAccountId);
    return { transaction_id: txnId };
}

/**
 * EVENT 5: Job cancelled before completion
 */
export async function postCancellationEntries(jobId, heldAmountPaise, customerId, inspectionFeePaise = 0, pool) {
    const idempotencyKey = `job_cancel_${jobId}`;
    const existing = await checkIdempotency(pool, idempotencyKey);
    if (existing) return { transaction_id: existing };

    const escrowId = await getAccountId(pool, 'ESCROW');
    const customerPayableId = await getAccountId(pool, 'CUSTOMER_PAYABLE');
    const customerAccountId = await getOrCreateUserAccount(pool, customerId, 'CUSTOMER_PAYABLE');
    const txnId = uuidv4();

    const remainingPaise = heldAmountPaise - inspectionFeePaise;
    if (remainingPaise > 0) {
        await insertEntry(pool, {
            transaction_id: txnId,
            entry_sequence: 1,
            account_id: customerPayableId,
            user_account_id: customerAccountId,
            entry_type: 'debit',
            amount_paise: remainingPaise,
            event_type: 'job_cancel',
            job_id: jobId,
            idempotency_key: `${idempotencyKey}_release`,
            description: `Job ${jobId} cancelled – release customer payable`,
            triggered_by_system: true
        });
        await insertEntry(pool, {
            transaction_id: txnId,
            entry_sequence: 2,
            account_id: escrowId,
            user_account_id: null,
            entry_type: 'credit',
            amount_paise: remainingPaise,
            event_type: 'job_cancel',
            job_id: jobId,
            idempotency_key: `${idempotencyKey}_escrow`,
            description: `Job ${jobId} cancelled – release escrow`,
            triggered_by_system: true
        });
    }

    await pool.query(
        `UPDATE customer_pending_dues SET status = 'cancelled' WHERE job_id = $1`,
        [jobId]
    );

    await recomputeBalanceCache(customerAccountId);
    return { transaction_id: txnId };
}

/**
 * EVENT 6: Dispute resolved — full refund
 */
export async function postDisputeRefundEntries(jobId, refundAmountPaise, workerSharePaise, platformSharePaise, customerId, workerId, pool) {
    const idempotencyKey = `dispute_refund_${jobId}`;
    const existing = await checkIdempotency(pool, idempotencyKey);
    if (existing) return { transaction_id: existing };

    const workerEarningsId = await getAccountId(pool, 'WORKER_EARNINGS');
    const platformRevenueId = await getAccountId(pool, 'PLATFORM_REVENUE');
    const customerPayableId = await getAccountId(pool, 'CUSTOMER_PAYABLE');
    const workerAccountId = await getOrCreateUserAccount(pool, workerId, 'WORKER_EARNINGS');
    const customerAccountId = await getOrCreateUserAccount(pool, customerId, 'CUSTOMER_PAYABLE');
    const txnId = uuidv4();

    await insertEntry(pool, {
        transaction_id: txnId,
        entry_sequence: 1,
        account_id: workerEarningsId,
        user_account_id: workerAccountId,
        entry_type: 'debit',
        amount_paise: workerSharePaise,
        event_type: 'dispute_refund',
        job_id: jobId,
        idempotency_key: `${idempotencyKey}_worker_reversal`,
        description: `Dispute refund – reverse worker share`,
        triggered_by_system: true
    });
    await insertEntry(pool, {
        transaction_id: txnId,
        entry_sequence: 2,
        account_id: platformRevenueId,
        user_account_id: null,
        entry_type: 'debit',
        amount_paise: platformSharePaise,
        event_type: 'dispute_refund',
        job_id: jobId,
        idempotency_key: `${idempotencyKey}_platform_reversal`,
        description: `Dispute refund – reverse platform share`,
        triggered_by_system: true
    });
    await insertEntry(pool, {
        transaction_id: txnId,
        entry_sequence: 3,
        account_id: customerPayableId,
        user_account_id: customerAccountId,
        entry_type: 'credit',
        amount_paise: refundAmountPaise,
        event_type: 'dispute_refund',
        job_id: jobId,
        idempotency_key: `${idempotencyKey}_customer_credit`,
        description: `Dispute refund – customer credit`,
        triggered_by_system: true
    });

    await recomputeBalanceCache(workerAccountId);
    await recomputeBalanceCache(customerAccountId);
    return { transaction_id: txnId };
}

/**
 * EVENT 7: Admin resolves a flagged material line item
 * resolution = 'release' (pay worker) | 'refund' (refund customer)
 */
export async function postMaterialDisputeResolution(jobId, materialId, amountPaise, resolution, workerId, customerId, pool) {
    if (!['release', 'refund'].includes(resolution)) throw new Error('Invalid resolution type');
    if (amountPaise <= 0) throw new Error('Invalid amount for dispute resolution');

    const idempotencyKey = `material_dispute_${materialId}_${resolution}`;
    const existing = await checkIdempotency(pool, idempotencyKey);
    if (existing) return { transaction_id: existing };

    const escrowId = await getAccountId(pool, 'ESCROW');
    const workerEarningsId = await getAccountId(pool, 'WORKER_EARNINGS');
    const customerPayableId = await getAccountId(pool, 'CUSTOMER_PAYABLE');
    const txnId = uuidv4();

    if (resolution === 'release') {
        // Worker wins: release escrow → worker earnings
        const workerAccountId = await getOrCreateUserAccount(pool, workerId, 'WORKER_EARNINGS');
        await insertEntry(pool, {
            transaction_id: txnId, entry_sequence: 1,
            account_id: escrowId, user_account_id: null,
            entry_type: 'credit', amount_paise: amountPaise,
            event_type: 'dispute_resolved', job_id: jobId,
            idempotency_key: idempotencyKey,
            description: `Material ${materialId} dispute resolved: release to worker`,
            triggered_by_system: true,
        });
        await insertEntry(pool, {
            transaction_id: txnId, entry_sequence: 2,
            account_id: workerEarningsId, user_account_id: workerAccountId,
            entry_type: 'debit', amount_paise: amountPaise,
            event_type: 'dispute_resolved', job_id: jobId,
            idempotency_key: `${idempotencyKey}_worker`,
            description: `Material ${materialId} released to worker from escrow`,
            triggered_by_system: true,
        });
        await recomputeBalanceCache(workerAccountId);
    } else {
        // Customer wins: release escrow → reduce customer payable (refund)
        const customerAccountId = await getOrCreateUserAccount(pool, customerId, 'CUSTOMER_PAYABLE');
        await insertEntry(pool, {
            transaction_id: txnId, entry_sequence: 1,
            account_id: escrowId, user_account_id: null,
            entry_type: 'credit', amount_paise: amountPaise,
            event_type: 'dispute_resolved', job_id: jobId,
            idempotency_key: idempotencyKey,
            description: `Material ${materialId} dispute resolved: refund to customer`,
            triggered_by_system: true,
        });
        await insertEntry(pool, {
            transaction_id: txnId, entry_sequence: 2,
            account_id: customerPayableId, user_account_id: customerAccountId,
            entry_type: 'debit', amount_paise: amountPaise,
            event_type: 'dispute_resolved', job_id: jobId,
            idempotency_key: `${idempotencyKey}_customer`,
            description: `Material ${materialId} refunded to customer from escrow`,
            triggered_by_system: true,
        });
        await recomputeBalanceCache(customerAccountId);
    }

    // Mark the material as resolved
    await pool.query(
        `UPDATE job_materials SET status=$1, verified_at=NOW() WHERE id=$2`,
        [resolution === 'release' ? 'accepted' : 'refunded', materialId]
    );

    console.log(`[Wallet] Material ${materialId} dispute resolved: ${resolution}, ${amountPaise} paise`);
    return { transaction_id: txnId };
}

export { MAX_SINGLE_JOB_PAISE, MAX_SINGLE_WITHDRAWAL_PAISE, MAX_DAILY_WITHDRAWAL_PAISE, MIN_SINGLE_WITHDRAWAL_PAISE };

