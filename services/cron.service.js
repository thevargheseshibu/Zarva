/**
 * services/cron.service.js
 * 
 * Background daemons executing async jobs:
 * 1. Dispute Escalation Auto-sweeps (48-hour timeouts)
 * 2. Razorpay Refund Retries (Exponential Backoffs)
 */

import cron from 'node-cron';
import { getPool } from '../config/database.js';
import { startLiveBillingSync } from './liveBilling.js';
import * as reconciliationService from './reconciliation.service.js';

export function initCronJobs() {
    console.log('[Cron] Initializing scheduled sweeps...');

    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        const pool = getPool();
        if (!pool) return;

        console.log(`[Cron] Executing background sweeps at ${new Date().toISOString()}`);

        try {
            await handleDisputeEscalations(pool);
            await handleRefundRetries(pool);
        } catch (err) {
            console.error('[Cron] Sweep Error:', err);
        }
    });

    // Daily reconciliation (2:00 AM)
    cron.schedule('0 2 * * *', async () => {
        try {
            const report = await reconciliationService.runDailyReconciliation();
            if (report.status !== 'ok') {
                console.error('[Cron] Reconciliation FAILED:', JSON.stringify(report.errors, null, 2));
                // TODO: Send alert to engineering + finance
            } else {
                console.log('[Cron] Daily reconciliation passed.');
            }
        } catch (err) {
            console.error('[Cron] Reconciliation error:', err);
        }
    });


    // Start Live Billing Background Tracker 
    startLiveBillingSync();
}

/**
 * 1. Dispute Auto-Escalation
 * Sweeps 'disputed' jobs where auto_escalate_at < NOW() AND escalated=0
 */
async function handleDisputeEscalations(pool) {
    const [jobs] = await pool.query(
        `SELECT id, customer_id, worker_id, dispute_reason 
         FROM jobs 
         WHERE status = 'disputed' AND auto_escalate_at <= NOW() AND escalated = false`
    );

    if (jobs.length === 0) return;

    console.log(`[Cron] Found ${jobs.length} stagnant disputes to escalate...`);

    const escalatedIds = [];
    for (const job of jobs) {
        // Pseudo-logic to alert Admins natively via SendGrid / Email
        console.log(`[Admin Alert Email] Job ${job.id} Dispute Auto-Escalated. Reason: ${job.dispute_reason}`);
        escalatedIds.push(job.id);
    }

    if (escalatedIds.length > 0) {
        await pool.query(
            `UPDATE jobs SET escalated = true WHERE id = ANY($1)`,
            [escalatedIds]
        );
        console.log(`[Cron] Successfully marked ${escalatedIds.length} disputes as escalated.`);
    }
}

/**
 * 2. Razorpay Refund Retries
 * Sweeps 'pending' records where next_attempt_at < NOW() limits 
 */
async function handleRefundRetries(pool) {
    const [refunds] = await pool.query(
        `SELECT id, payment_id, amount, attempts, max_attempts 
         FROM refund_queue 
         WHERE status = 'pending' AND next_attempt_at <= NOW() AND attempts < max_attempts`
    );

    if (refunds.length === 0) return;

    console.log(`[Cron] Found ${refunds.length} pending refunds to process...`);

    for (const refund of refunds) {
        try {
            // Mock API call to Razorpay Refund Endpoint
            await simulateRazorpayAPICall(refund);

            // Success Transition
            await pool.query(
                `UPDATE refund_queue SET status='completed', razorpay_refund_id=$1, updated_at=NOW() WHERE id=$2`,
                [`rfnd_mock_${Date.now()}`, refund.id]
            );
            console.log(`[Cron] Refund ${refund.id} processed successfully via Razorpay.`);
        } catch (err) {
            // Failure Transition with Exponential Backoff + attempts
            const newAttempts = refund.attempts + 1;
            const backoffMinutes = newAttempts * 5; // 5m -> 10m -> 15m ...

            if (newAttempts >= refund.max_attempts) {
                await pool.query(
                    `UPDATE refund_queue SET status='failed', attempts=$1, last_error=$2, updated_at=NOW() WHERE id=$3`,
                    [newAttempts, err.message, refund.id]
                );
                console.log(`[Cron] Refund ${refund.id} FAILED permanently after ${newAttempts} attempts.`);
            } else {
                await pool.query(
                    `UPDATE refund_queue SET attempts=$1, last_error=$2, next_attempt_at=NOW() + INTERVAL '1 minute' * $3, updated_at=NOW() WHERE id=$4`,
                    [newAttempts, err.message, backoffMinutes, refund.id]
                );
                console.log(`[Cron] Refund ${refund.id} failed natively. Backing off for ${backoffMinutes} minutes.`);
            }
        }
    }
}

// Pseudo-helper function mocking HTTP calls
async function simulateRazorpayAPICall(refund) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // 80% success rate mock simulation logic
            if (Math.random() < 0.8) {
                resolve({ success: true });
            } else {
                reject(new Error('Gateway timeout from Razorpay Bank Bridge'));
            }
        }, 100);
    });
}
