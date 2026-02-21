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

// Helper: Sleep for wave delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes Haversine formula strictly as defined by spec.
 */
async function findEligibleWorkers(job, radiusKm, limit, excludeIds, pool) {
    const { category, latitude, longitude } = job;

    // Construct dynamic exclusion clause. Avoid syntax error if array is empty
    let excludeClause = '';
    let queryParams = [latitude, longitude, latitude, radiusKm];

    if (excludeIds.length > 0) {
        const placeholders = excludeIds.map(() => '?').join(',');
        excludeClause = `AND user_id NOT IN (${placeholders})`;
        queryParams.push(...excludeIds);
    }

    queryParams.push(category, limit);

    // EXACT requirement translation for formula:
    // (6371 * acos(cos(radians(?)) * cos(radians(current_lat)) * cos(radians(current_lng) - radians(?)) + sin(radians(?)) * sin(radians(current_lat))))
    // Current lat/long columns on worker_profiles are current_lat & current_lng
    const query = `
        SELECT 
            wp.user_id, wp.fcm_token
        FROM worker_profiles wp
        JOIN users u ON wp.user_id = u.id
        CROSS JOIN (
            SELECT 
                (6371 * acos(
                    cos(radians(?)) * cos(radians(wp.current_lat)) * 
                    cos(radians(wp.current_lng) - radians(?)) + 
                    sin(radians(?)) * sin(radians(wp.current_lat))
                )) AS distance_km
        ) d
        WHERE 
            wp.is_verified = 1 AND 
            wp.is_online = 1 AND 
            wp.is_available = 1 AND 
            wp.current_job_id IS NULL AND 
            u.fcm_token IS NOT NULL AND
            d.distance_km <= ?
            ${excludeClause} AND
            wp.category = ?
        ORDER BY d.distance_km ASC, wp.average_rating DESC
        LIMIT ?
    `;

    // Because CROSS JOIN with dynamic calculated alias distance_km causes issues in MySQL strict modes without wrapping, we use direct calculation in SELECT & HAVING.
    // Rewriting Haversine directly safely for MySQL 8 strict:
    const safeQuery = `
        SELECT 
            wp.user_id, u.fcm_token,
            (6371 * acos(
                cos(radians(?)) * cos(radians(wp.current_lat)) * 
                cos(radians(wp.current_lng) - radians(?)) + 
                sin(radians(?)) * sin(radians(wp.current_lat))
            )) AS distance_km
        FROM worker_profiles wp
        JOIN users u ON wp.user_id = u.id
        WHERE 
            wp.is_verified = 1 AND 
            wp.is_online = 1 AND 
            wp.is_available = 1 AND 
            wp.current_job_id IS NULL AND 
            u.fcm_token IS NOT NULL AND
            wp.category = ?
            ${excludeClause}
        HAVING distance_km <= ?
        ORDER BY distance_km ASC, wp.average_rating DESC
        LIMIT ?
    `;

    // Realign params for HAVING approach
    const safeParams = [
        latitude, longitude, latitude, // Haversine args
        category, // WHERE arg
        ...excludeIds, // Exclusion list
        radiusKm, // HAVING arg
        limit // LIMIT arg
    ];

    const [workers] = await pool.query(safeQuery, safeParams);
    return workers;
}

/**
 * Helper to bulk save notification states into mysql
 */
async function bulkInsertNotifications(jobId, workers, waveNum, pool) {
    if (!workers || workers.length === 0) return;

    const values = workers.map(w => [jobId, w.user_id, 'sent']);
    const placeholders = values.map(() => '(?, ?, ?)').join(', ');
    const flatParams = values.flat();

    await pool.query(
        `INSERT INTO job_worker_notifications (job_id, worker_id, status) VALUES ${placeholders}`,
        flatParams
    );
    console.log(`[MatchingEngine] Wave ${waveNum} - Dispatching to ${workers.length} workers.`);
}

/**
 * FCM Push trigger
 */
async function sendJobAlertFCM(jobId, workers) {
    await fcmService.sendJobAlertToWorkers(jobId, workers);
}

/**
 * Handles automatic queuing for refunds if the job had advance attached.
 */
async function triggerAutoRefund(jobId, pool) {
    console.log(`[MatchingEngine] Job ${jobId} exhausted all waves. Triggering Auto Refund logic...`);

    // Check if advance payment exists captured.
    const [payments] = await pool.query(
        `SELECT id, amount FROM payments WHERE job_id = ? AND type = 'advance' AND status = 'captured'`,
        [jobId]
    );

    if (payments.length > 0) {
        const payment = payments[0];
        await pool.query(
            `INSERT INTO refund_queue (payment_id, job_id, amount, status) VALUES (?, ?, ?, 'pending')`,
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
        { radius_km: 3, count: 5, wait_seconds: 30 },
        { radius_km: 7, count: 10, wait_seconds: 30 },
        { radius_km: 15, count: 20, wait_seconds: 60 }
    ];

    try {
        for (let waveNum = 0; waveNum < waves.length; waveNum++) {
            const wave = waves[waveNum];

            // 1. Refresh Job state
            const [jobs] = await pool.query('SELECT status, category, latitude, longitude FROM jobs WHERE id = ?', [jobId]);
            const job = jobs[0];
            if (!job || job.status !== 'searching') return; // Job cancelled or accepted

            // 2. Extrapolate Exclusion lists
            const [notified] = await pool.query('SELECT worker_id FROM job_worker_notifications WHERE job_id = ?', [jobId]);
            const excludeIds = notified.map(r => r.worker_id);

            // 3. Find Proximate Workers
            const workers = await findEligibleWorkers(job, wave.radius_km, wave.count, excludeIds, pool);

            // 4. Alert Workers
            if (workers.length > 0) {
                await bulkInsertNotifications(jobId, workers, waveNum + 1, pool);
                await sendJobAlertFCM(jobId, workers);
            }

            // 5. Native Sleep Engine Thread
            await sleep(wave.wait_seconds * 1000);

            // 6. Check Post-Sleep Status
            const [updated] = await pool.query('SELECT status FROM jobs WHERE id = ?', [jobId]);
            if (updated[0].status === 'assigned') return; // Accepted by worker in meantime
        }

        // Exhausted fully
        await pool.query("UPDATE jobs SET status='no_worker_found' WHERE id=?", [jobId]);
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
    if (!locked) {
        throw Object.assign(new Error('Job already being claimed'), { code: 'RACE_CONDITION', status: 409 });
    }

    try {
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            // FOR UPDATE physical lock on MySQL record
            const [rows] = await conn.query('SELECT id, status FROM jobs WHERE id = ? FOR UPDATE', [jobId]);

            if (!rows.length || rows[0].status !== 'searching') {
                await conn.rollback();
                throw Object.assign(new Error('Job is no longer available'), { code: 'JOB_UNAVAILABLE', status: 409 });
            }

            const matchingConfig = configLoader.get('zarva')?.matching || { cancellation_lock_minutes: 15 };

            await conn.query(
                'UPDATE jobs SET status="assigned", worker_id=?, accepted_at=NOW(), cancellation_locked_at=DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id=?',
                [workerId, matchingConfig.cancellation_lock_minutes, jobId]
            );

            await conn.query(
                'UPDATE worker_profiles SET current_job_id=? WHERE user_id=?',
                [jobId, workerId]
            );

            await conn.query(
                'UPDATE job_worker_notifications SET status="accepted", responded_at=NOW() WHERE job_id=? AND worker_id=?',
                [jobId, workerId]
            );

            await conn.commit();
        } catch (txnErr) {
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
        'UPDATE job_worker_notifications SET status="rejected", responded_at=NOW() WHERE job_id=? AND worker_id=?',
        [jobId, workerId]
    );
}
