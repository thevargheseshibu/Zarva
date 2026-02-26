/**
 * services/matchingEngine.js
 * 
 * High Concurrency Matching Engine (Wave System).
 * Evaluates Haversine bounds, manages Redis isolation locks, and handles FCM push dispatch.
 */

import { getPool } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import configLoader from '../config/loader.js';
import * as fcmService from './fcmService.js';
import { updateJobNode, updateJobLastMessage } from '../services/firebase.service.js';
import supportService from './supportService.js';

// Helper: Sleep for wave delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function findEligibleWorkers(job, radiusKm, limit, excludeIds, pool) {
    const { category, latitude, longitude, id: jobId } = job;

    const pointWkt = `POINT(${longitude} ${latitude})`;
    const params = [pointWkt, category, category, pointWkt, radiusKm];

    let excludeClause = '';
    let paramIndex = 6;

    if (excludeIds.length > 0) {
        const placeholders = excludeIds.map(() => `$${paramIndex++}`).join(',');
        excludeClause = `AND wp.user_id NOT IN (${placeholders})`;
        params.push(...excludeIds);
    }

    params.push(limit); // The final LIMIT parameter

    // Refined SQL with PostGIS ST_Distance and ST_DWithin
    const query = `
        SELECT
            wp.user_id,
            u.fcm_token,
            wp.name,
            wp.average_rating,
            wp.last_location_lat,
            wp.last_location_lng,
            ST_Distance(wp.current_location, ST_GeogFromText($1)) / 1000.0 AS distance_km
        FROM worker_profiles wp
        JOIN users u ON u.id = wp.user_id
        WHERE
            wp.kyc_status = 'approved'
            AND wp.is_online = true
            AND wp.is_available = true
            AND wp.current_job_id IS NULL
            AND u.fcm_token IS NOT NULL
            AND u.is_blocked = false
            AND (wp.category = $2 OR (wp.skills IS NOT NULL AND wp.skills::jsonb @> jsonb_build_array($3::text)))
            AND ST_DWithin(wp.current_location, ST_GeogFromText($4), $5 * 1000)
            ${excludeClause}
        ORDER BY distance_km ASC
        LIMIT $${paramIndex}
    `;

    const [workers] = await pool.query(query, params);
    return workers;
}

/**
 * Helper to bulk save notification states into mysql
 */
async function bulkInsertNotifications(jobId, workers, waveNum, pool) {
    if (!workers || workers.length === 0) return;

    const values = workers.map(w => [jobId, w.user_id, 'sent', w.distance_km || 0]);
    // Postgres insert param building: ($1, $2, $3, $4), ($5, $6, $7, $8)
    const placeholders = values.map((_, i) => {
        const offset = i * 4;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    }).join(', ');
    const flatParams = values.flat();

    await pool.query(
        `INSERT INTO job_worker_notifications (job_id, worker_id, status, distance_km) VALUES ${placeholders}`,
        flatParams
    );
    console.log(`[MatchingEngine] Wave ${waveNum} - Dispatching to ${workers.length} workers.`);
}

/**
 * FCM Push trigger
 */
async function sendJobAlertFCM(jobId, workers, job, waveNum) {
    await fcmService.sendJobAlertToWorkers(jobId, workers, job, waveNum);
}

/**
 * Handles automatic queuing for refunds if the job had advance attached.
 */
async function triggerAutoRefund(jobId, pool) {
    console.log(`[MatchingEngine] Job ${jobId} exhausted all waves. Triggering Auto Refund logic...`);

    // Check if advance payment exists captured.
    const [payments] = await pool.query(
        `SELECT id, amount FROM payments WHERE job_id = $1 AND type = 'advance' AND status = 'captured'`,
        [jobId]
    );

    if (payments.length > 0) {
        const payment = payments[0];
        await pool.query(
            `INSERT INTO refund_queue (payment_id, job_id, amount, status) VALUES ($1, $2, $3, 'pending')`,
            [payment.id, jobId, payment.amount]
        );
        console.log(`[MatchingEngine] Advance payment found. Refund queued for Payment ${payment.id}.`);
    } else {
        console.log(`[MatchingEngine] No captured advance payment bound to Job ${jobId}. No refund required.`);
    }
}

/**
 * Wave Dispatcher System
 */
export async function startMatching(jobId) {
    const pool = getPool();
    const waves = [
        { radius_km: 3, count: 5, wait_seconds: 90 },   // 1.5 min — local workers
        { radius_km: 7, count: 10, wait_seconds: 90 },   // 1.5 min — nearby workers
        { radius_km: 15, count: 20, wait_seconds: 120 }    // 2 min   — farther workers
    ];

    try {
        console.log(`[MatchingEngine] 🚀 Starting matching flow for Job ${jobId}`);
        for (let waveNum = 0; waveNum < waves.length; waveNum++) {
            try {
                const wave = waves[waveNum];

                // Alert mobile frontend of expanding search radius for transparency sync
                await updateJobNode(jobId, { wave_number: waveNum + 1 }).catch(() => { });

                // 1. Refresh Job state
                const [jobs] = await pool.query('SELECT status, category, latitude, longitude FROM jobs WHERE id = $1', [jobId]);
                const job = jobs[0];
                if (!job) {
                    console.warn(`[MatchingEngine] Job ${jobId} not found. Aborting.`);
                    return;
                }
                if (job.status !== 'searching') {
                    console.log(`[MatchingEngine] Job ${jobId} status is ${job.status}. Stopping search.`);
                    return;
                }

                console.log(`[MatchingEngine] Wave ${waveNum + 1} for Job ${jobId} (${job.category}) at ${job.latitude}, ${job.longitude} (Radius: ${wave.radius_km}km)`);

                // 2. Extrapolate Exclusion lists
                const [notified] = await pool.query('SELECT worker_id FROM job_worker_notifications WHERE job_id = $1', [jobId]);
                const excludeIds = notified.map(r => r.worker_id);

                // 3. Find Proximate Workers
                const workers = await findEligibleWorkers(job, wave.radius_km, wave.count, excludeIds, pool);

                // 4. Alert Workers
                if (workers.length > 0) {
                    await bulkInsertNotifications(jobId, workers, waveNum + 1, pool);
                    await sendJobAlertFCM(jobId, workers, job, waveNum + 1);
                    // Push live status update so Searching screen shows progress
                    await updateJobNode(jobId, {
                        wave_number: waveNum + 1,
                        workers_notified: workers.length,
                        wave_status: `Wave ${waveNum + 1}: Sent to ${workers.length} worker${workers.length > 1 ? 's' : ''} nearby`
                    }).catch(() => { });
                    console.log(`[MatchingEngine] Wave ${waveNum + 1}: Notifications sent to ${workers.length} workers.`);
                } else {
                    await updateJobNode(jobId, {
                        wave_number: waveNum + 1,
                        workers_notified: 0,
                        wave_status: `Wave ${waveNum + 1}: Expanding search radius...`
                    }).catch(() => { });
                    console.log(`[MatchingEngine] Wave ${waveNum + 1}: No eligible workers found within ${wave.radius_km}km.`);
                }

                // 5. Native Sleep Engine Thread
                await sleep(wave.wait_seconds * 1000);

                // 6. Check Post-Sleep Status
                const [updated] = await pool.query('SELECT status FROM jobs WHERE id = $1', [jobId]);
                if (updated[0].status === 'assigned') return; // Accepted by worker in meantime
            } catch (waveErr) {
                console.error(`[MatchingEngine] Error in Wave ${waveNum + 1} for Job ${jobId}:`, waveErr);
                // Continue to next wave if possible
            }
        }

        // Exhausted fully
        await pool.query("UPDATE jobs SET status='no_worker_found' WHERE id=$1", [jobId]);
        await triggerAutoRefund(jobId, pool);

    } catch (err) {
        console.error(`[MatchingEngine] Fatal error during wave engine for Job ${jobId}:`, err);
    }
}

/**
 * ATOMIC Job Acceptance
 * Exact Redis + MySQL Translation of requirement.
 */
export async function acceptJob(jobId, workerId) {
    const pool = getPool();
    const lockKey = 'zarva:job:' + jobId + ':lock';

    const redisClient = getRedisClient();
    // Atomic SET NX - exactly 5 seconds TTL to protect concurrency without deadlocks
    const locked = await redisClient.set(lockKey, workerId, 'NX', 'EX', 5);
    console.log(`[MatchingEngine] Accept attempt by worker ${workerId} for job ${jobId}. Lock: ${locked ? 'ACQUIRED' : 'FAILED'}`);

    if (!locked) {
        throw Object.assign(new Error('Job already being claimed'), { code: 'RACE_CONDITION', status: 409 });
    }

    try {
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            // FOR UPDATE physical lock on postgres record
            const [rows] = await conn.query(`
                SELECT j.id, j.status, wp.is_online, wp.current_job_id 
                FROM jobs j
                JOIN worker_profiles wp ON wp.user_id = $1
                WHERE j.id = $2 
                FOR UPDATE
            `, [workerId, jobId]);

            const jobData = rows[0];
            const currentStatus = jobData?.status;
            const isOnline = jobData?.is_online;
            const currentJobId = jobData?.current_job_id;

            console.log(`[MatchingEngine] Job ${jobId} status: ${currentStatus}, Worker ${workerId} online: ${isOnline}, CurrentJob: ${currentJobId}`);

            if (!jobData || !isOnline) {
                await conn.rollback();
                throw Object.assign(new Error('You are offline (NET: OFF). Please go online to accept jobs.'), { code: 'WORKER_OFFLINE', status: 403 });
            }

            // ENFORCE NEW CONCURRENCY LIMITS (Max 2 if 1 is disputed)
            const concurrencyCheck = await supportService.canUserTakeNewJob(workerId);
            if (!concurrencyCheck.can_take) {
                await conn.rollback();
                throw Object.assign(new Error(concurrencyCheck.reason), { code: 'ACTIVE_JOB_LIMIT_REACHED', status: 403 });
            }

            const ACCEPTABLE_STATUSES = ['open', 'searching', 'no_worker_found'];
            if (!rows.length || !ACCEPTABLE_STATUSES.includes(currentStatus)) {
                console.warn(`[MatchingEngine] Job ${jobId} rejected: Status ${currentStatus} not in ${ACCEPTABLE_STATUSES}`);
                await conn.rollback();
                throw Object.assign(new Error('Job is no longer available'), { code: 'JOB_UNAVAILABLE', status: 409 });
            }

            const matchingConfig = configLoader.get('zarva')?.matching || { cancellation_lock_minutes: 15 };

            await conn.query(
                `UPDATE jobs SET status='assigned', worker_id=$1, accepted_at=NOW(), chat_enabled=true, cancellation_locked_at=NOW() + INTERVAL '${matchingConfig.cancellation_lock_minutes} MINUTE' WHERE id=$2`,
                [workerId, jobId]
            );

            await conn.query(
                'UPDATE worker_profiles SET current_job_id=$1 WHERE user_id=$2',
                [jobId, workerId]
            );

            await conn.query(
                `UPDATE job_worker_notifications SET status='accepted', responded_at=NOW() WHERE job_id=$1 AND worker_id=$2`,
                [jobId, workerId]
            );

            await conn.commit();
            console.log(`[MatchingEngine] Job ${jobId} successfully assigned to worker ${workerId}`);

            // Initialize Firebase chat node for the job
            await updateJobLastMessage(jobId, {
                content: 'Chat started',
                sender_id: 'system',
                sender_name: 'Zarva System',
                sent_at: Date.now(),
                message_type: 'text'
            }).catch(() => { });
        } catch (txnErr) {
            console.error(`[MatchingEngine] Job ${jobId} assignment failed:`, txnErr);
            await conn.rollback();
            throw txnErr;
        } finally {
            conn.release();
        }

    } finally {
        const redisClient = getRedisClient();
        await redisClient.del(lockKey); // release Redis lock
    }
}

/**
 * Job Rejection
 */
export async function declineJob(jobId, workerId) {
    const pool = getPool();
    await pool.query(
        `UPDATE job_worker_notifications SET status='rejected', responded_at=NOW() WHERE job_id=$1 AND worker_id=$2`,
        [jobId, workerId]
    );
}
