import { getPool } from '../config/database.js';
import billingService from './billing.service.js';
import { updateJobNode } from './firebase.service.js';

let intervalId = null;

export function startLiveBillingSync() {
    if (intervalId) return;

    const runSync = async () => {
        const startTime = Date.now();
        try {
            const pool = getPool();
            if (!pool) return;

            // Get all currently active hourly jobs tracking time
            const [jobs] = await pool.query(
                `SELECT id FROM jobs WHERE status IN ('inspection_active', 'in_progress')`
            );

            if (jobs.length > 0) {
                console.log(`[Billing Sync] Starting sweep for ${jobs.length} jobs...`);
            }

            for (const job of jobs) {
                try {
                    // This calls the actual exact calculation from DB events, up to the current second
                    const bill = await billingService.calculateJobBill(job.id, pool);

                    // Push to Firebase for live React Native listener 
                    await updateJobNode(job.id, {
                        timer_status: 'active',
                        elapsed_minutes: bill.actualElapsedMinutes,
                        billed_minutes: bill.billedMinutes,
                        current_cost: bill.jobAmount,
                        exceeded_estimate: bill.exceededEstimate
                    });
                } catch (calcError) {
                    console.error(`[Billing Sync] Error calculating for job ${job.id}:`, calcError.message);
                }
            }
        } catch (err) {
            console.error('[Billing Sync] Error doing sync sweep:', err);
        } finally {
            const duration = Date.now() - startTime;
            if (duration > 5000) {
                console.warn(`[Billing Sync] Slow sweep detected: ${duration}ms`);
            }
            // Schedule next run only AFTER this one is done
            intervalId = setTimeout(runSync, 60000);
        }
    };

    runSync();
    console.log('[Billing Sync] Started background tracker for live cost tracking');
}

export function stopLiveBillingSync() {
    if (intervalId) {
        clearTimeout(intervalId);
        intervalId = null;
    }
}
