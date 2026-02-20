/**
 * services/cron.service.js
 * 
 * Background daemons executing async jobs:
 * 1. Dispute Escalation Auto-sweeps (48-hour timeouts)
 * 2. Razorpay Refund Retries (Exponential Backoffs)
 */

import cron from 'node-cron';
import { getPool } from '../config/database.js';

export function initCronJobs() {
    console.log('[Cron] Initializing 15-minute scheduled sweeps...');

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
}

/**
 * 1. Dispute Auto-Escalation
 * Sweeps 'disputed' jobs where auto_escalate_at < NOW() AND escalated=0
 */
async function handleDisputeEscalations(pool) {
    const [jobs] = await pool.query(
        `SELECT id, customer_id, worker_id, dispute_reason 
         FROM jobs 
         WHERE status = 'disputed' AND auto_escalate_at <= NOW() AND escalated = 0`
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
            `UPDATE jobs SET escalated = 1 WHERE id IN (?)`,
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
                `UPDATE refund_queue SET status='completed', razorpay_refund_id=?, updated_at=NOW() WHERE id=?`,
                [`rfnd_mock_${Date.now()}`, refund.id]
            );
            console.log(`[Cron] Refund ${refund.id} processed successfully via Razorpay.`);
        } catch (err) {
            // Failure Transition with Exponential Backoff + attempts
            const newAttempts = refund.attempts + 1;
            const backoffMinutes = newAttempts * 5; // 5m -> 10m -> 15m ...

            if (newAttempts >= refund.max_attempts) {
                await pool.query(
                    `UPDATE refund_queue SET status='failed', attempts=?, last_error=?, updated_at=NOW() WHERE id=?`,
                    [newAttempts, err.message, refund.id]
                );
                console.log(`[Cron] Refund ${refund.id} FAILED permanently after ${newAttempts} attempts.`);
            } else {
                await pool.query(
                    `UPDATE refund_queue SET attempts=?, last_error=?, next_attempt_at=DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at=NOW() WHERE id=?`,
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
