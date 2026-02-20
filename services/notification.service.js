/**
 * services/notification.service.js
 *
 * FCM Push Notification system for ZARVA.
 * - sendFCM(): core sender with stale-token handling + notification_log write
 * - resolveTemplate(): bilingual {{variable}} substitution
 * - 10 named event helpers that compose the above
 */

import { getFirebaseApp } from '../config/firebase.js';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';

// ── Test injection (dev only) ─────────────────────────────────────────────────
let _testMessaging = null;
/** Inject a mock messaging object to force the real FCM code path in tests. */
export function __setMessagingMock(mock) { _testMessaging = mock; }

// ── Internal helpers ─────────────────────────────────────────────────────────

function isEnabled(flag) {
    const [section, key] = flag.split('.');
    return configLoader.get('features')?.[section]?.[key] ?? false;
}

/**
 * Resolve a bilingual template and substitute {{variable}} tokens.
 * @param {string} event   - template key in notifications.config.json
 * @param {string} lang    - 'en' | 'ml'
 * @param {object} vars    - { variable: value } substitution map
 * @returns {{ title: string, body: string }}
 */
function resolveTemplate(event, lang = 'en', vars = {}) {
    const tpl = configLoader.get('notifications')?.templates?.[event];
    if (!tpl) return { title: event, body: '' };

    const sub = (str) =>
        Object.entries(vars).reduce(
            (s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? ''),
            tpl[str]?.[lang] || tpl[str]?.en || ''
        );

    return { title: sub('title'), body: sub('body') };
}

/**
 * Write a row to notification_log.
 */
async function logNotification(pool, userId, status, title, body, data = {}, channel = 'push') {
    try {
        await pool.query(
            `INSERT INTO notification_log
               (user_id, actor_role, type, channel, title, body, data, status, sent_at)
             VALUES (?, 'admin', 'push', ?, ?, ?, ?, ?,
               ${status === 'sent' ? 'NOW()' : 'NULL'})`,
            [userId, channel, title, body, JSON.stringify(data), status]
        );
    } catch (e) {
        console.error('[Notification] Failed to log:', e.message);
    }
}

// ── Core sendFCM ─────────────────────────────────────────────────────────────

/**
 * Send a push notification to a user.
 * Handles feature flag check, missing token, stale token clearing, and DB logging.
 *
 * @param {number}  userId
 * @param {string}  title
 * @param {string}  body
 * @param {object}  data    - extra payload (will be stringified for RN)
 */
export async function sendFCM(userId, title, body, data = {}) {
    const pool = getPool();
    const [users] = await pool.query(
        'SELECT fcm_token, language FROM users WHERE id=?', [userId]
    );
    const user = users[0];
    if (!user) return;

    // Feature flag check
    if (!isEnabled('notifications.push_enabled')) {
        await logNotification(pool, userId, 'skipped', title, body, data);
        return;
    }

    // No token — skip silently
    if (!user.fcm_token) return;

    const app = getFirebaseApp();

    // Stub mode — no Firebase credentials
    if (!app && !_testMessaging) {
        console.log(`[FCM Mock] → userId=${userId} | "${title}" | "${body}"`);
        await logNotification(pool, userId, 'sent', title, body, data);
        return;
    }

    try {
        const messaging = _testMessaging ||
            (() => { const admin = globalThis.__firebaseAdmin; return admin.messaging(app); })();
        await messaging.send({
            token: user.fcm_token,
            notification: { title, body },
            data: { payload: JSON.stringify(data) }   // stringify for React Native
        });
        await logNotification(pool, userId, 'sent', title, body, data);
    } catch (err) {
        console.error(`[FCM] Send failed for userId=${userId}:`, err.code || err.message);
        await logNotification(pool, userId, 'failed', title, body, { fcm_error: err.code });

        // Stale token — clear it so we don't retry indefinitely
        if (err.code === 'messaging/registration-token-not-registered') {
            await pool.query('UPDATE users SET fcm_token=NULL WHERE id=?', [userId]);
            console.warn(`[FCM] Stale token cleared for userId=${userId}`);
        }
    }
}

// ── Template-aware send ───────────────────────────────────────────────────────

async function sendTemplated(userId, event, vars = {}, extraData = {}) {
    const pool = getPool();
    const [rows] = await pool.query('SELECT language FROM users WHERE id=?', [userId]);
    const lang = rows[0]?.language || 'en';
    const { title, body } = resolveTemplate(event, lang, vars);
    await sendFCM(userId, title, body, { event, ...extraData });
}

// ── 10 Named event helpers ────────────────────────────────────────────────────

/**
 * Notify a list of workers about a new job.
 */
export async function notifyWorkersNewJob(jobId, workerIds) {
    const pool = getPool();
    const [jobs] = await pool.query('SELECT category, latitude, longitude FROM jobs WHERE id=?', [jobId]);
    const job = jobs[0];
    if (!job) return;

    await Promise.allSettled(workerIds.map(wId =>
        sendTemplated(wId, 'job_new', {
            category: job.category,
            distance: '~5'      // placeholder — real ETA computed by matching engine
        }, { job_id: String(jobId) })
    ));
}

/**
 * Notify customer that a worker was found.
 */
export async function notifyCustomerWorkerFound(jobId) {
    const pool = getPool();
    const [jobs] = await pool.query(
        `SELECT j.customer_id, wp.name AS worker_name
         FROM jobs j
         JOIN worker_profiles wp ON wp.user_id = j.worker_id
         WHERE j.id=?`, [jobId]
    );
    const job = jobs[0];
    if (!job) return;
    await sendTemplated(job.customer_id, 'worker_found', {
        worker_name: job.worker_name,
        eta: '10'
    }, { job_id: String(jobId) });
}

/**
 * Notify customer that the worker has arrived (includes start OTP).
 */
export async function notifyCustomerWorkerArrived(jobId, startOtp) {
    const pool = getPool();
    const [jobs] = await pool.query(
        `SELECT j.customer_id, wp.name AS worker_name
         FROM jobs j
         JOIN worker_profiles wp ON wp.user_id = j.worker_id
         WHERE j.id=?`, [jobId]
    );
    const job = jobs[0];
    if (!job) return;
    await sendTemplated(job.customer_id, 'worker_arrived', {
        worker_name: job.worker_name,
        otp: startOtp
    }, { job_id: String(jobId), start_otp: startOtp });
}

/**
 * Notify all workers (except the one who accepted) that the job is taken.
 */
export async function notifyWorkersJobTaken(jobId, acceptedWorkerId) {
    const pool = getPool();
    const [notified] = await pool.query(
        `SELECT worker_id FROM job_worker_notifications WHERE job_id=? AND worker_id != ?`,
        [jobId, acceptedWorkerId]
    );
    await Promise.allSettled(notified.map(r =>
        sendTemplated(r.worker_id, 'job_taken', {}, { job_id: String(jobId) })
    ));
}

/**
 * Notify both customer and worker that the job is complete.
 */
export async function notifyJobCompleted(jobId) {
    const pool = getPool();
    const [jobs] = await pool.query('SELECT customer_id, worker_id FROM jobs WHERE id=?', [jobId]);
    const job = jobs[0];
    if (!job) return;
    await Promise.allSettled([
        sendTemplated(job.customer_id, 'job_completed', { job_id: jobId }, { job_id: String(jobId) }),
        sendTemplated(job.worker_id, 'job_completed', { job_id: jobId }, { job_id: String(jobId) })
    ]);
}

/**
 * Notify worker that a payment was received.
 */
export async function notifyPaymentReceived(workerId, amount, jobId) {
    await sendTemplated(workerId, 'payment_received', {
        amount: amount.toString(),
        job_id: jobId
    }, { job_id: String(jobId) });
}

/**
 * Notify the other party (not the canceller) that the job was cancelled.
 */
export async function notifyJobCancelled(jobId, cancelledBy) {
    const pool = getPool();
    const [jobs] = await pool.query('SELECT customer_id, worker_id FROM jobs WHERE id=?', [jobId]);
    const job = jobs[0];
    if (!job) return;

    // Notify the OTHER party
    const targetId = cancelledBy === 'customer' ? job.worker_id : job.customer_id;
    if (!targetId) return;

    await sendTemplated(targetId, 'job_cancelled', {
        job_id: jobId,
        cancelled_by: cancelledBy
    }, { job_id: String(jobId) });
}

/**
 * Notify customer that no worker was found after all waves.
 */
export async function notifyNoWorkerFound(customerId) {
    await sendTemplated(customerId, 'no_worker_found', {}, {});
}

/**
 * Notify a worker that their account has been approved by admin.
 */
export async function notifyWorkerApproved(workerId) {
    await sendTemplated(workerId, 'worker_approved', {}, {});
}

/**
 * Notify both parties that a dispute has been raised.
 */
export async function notifyDisputeRaised(jobId) {
    const pool = getPool();
    const [jobs] = await pool.query('SELECT customer_id, worker_id FROM jobs WHERE id=?', [jobId]);
    const job = jobs[0];
    if (!job) return;
    await Promise.allSettled([
        sendTemplated(job.customer_id, 'dispute_raised', { job_id: jobId }, { job_id: String(jobId) }),
        sendTemplated(job.worker_id, 'dispute_raised', { job_id: jobId }, { job_id: String(jobId) })
    ]);
}

export { resolveTemplate };
