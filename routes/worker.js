/**
 * routes/worker.js — Worker Onboarding API
 *
 * Mounted at /api/worker/onboard
 * ALL routes require active JWT (via the authenticateJWT global middleware).
 */

import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getPool } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import configLoader from '../config/loader.js';
import * as WorkerService from '../services/worker.service.js';
import * as MatchingEngine from '../services/matchingEngine.js';
import {
    updateWorkerPresence,
    updateJobNode,
    createJobNode
} from '../services/firebase.service.js';

const router = Router();

// Helper to quickly bail out or succeed
const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') =>
    res.status(status).json({ status: 'error', code, message });

async function handle(req, res, action) {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    }

    try {
        const pool = getPool();
        const result = await action(userId, pool);
        return ok(res, result);
    } catch (err) {
        const status = err.status ?? 500;
        if (status >= 500) {
            console.error(`[Worker] 500 for U:${userId} — ${err.message}`);
            console.error(err.stack || err);
        }
        const msg = status < 500 ? err.message : 'Internal Server Error.';
        return fail(res, msg, status, 'WORKER_ERROR');
    }
}

/**
 * 1. POST /onboard/start
 */
router.post('/onboard/start', (req, res) =>
    handle(req, res, (userId, pool) => WorkerService.startOnboarding(userId, pool))
);

/**
 * 2. PUT /onboard/profile
 */
router.put('/onboard/profile', (req, res) =>
    handle(req, res, (userId, pool) => WorkerService.updateProfile(userId, req.body, pool))
);

/**
 * 3. PUT /onboard/payment
 */
router.put('/onboard/payment', (req, res) =>
    handle(req, res, (userId, pool) => WorkerService.updatePayment(userId, req.body, pool))
);

/**
 * 4. POST /onboard/documents
 */
router.post('/onboard/documents', (req, res) =>
    handle(req, res, (userId, pool) => WorkerService.submitDocuments(userId, req.body, pool))
);

/**
 * 5. POST /onboard/agree
 */
router.post('/onboard/agree', (req, res) => {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return handle(req, res, (userId, pool) => WorkerService.agreeToTerms(userId, req.body?.name_typed, ipAddress, pool));
});

/**
 * 6. GET /onboard/status
 */
router.get('/onboard/status', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const statusRes = await WorkerService.getOnboardingStatus(userId, pool);
        return { data: statusRes }; // handle() will wrap this in { status: 'ok', ... }
    })
);

/**
 * 7. POST /onboard (Unified submission from monolithic mobile frontend)
 */
router.post('/onboard', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const { name, dob, gender, location, categories, experience, payment, documents, agreement_signature } = req.body;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';

        // Boot role if needed safely
        try {
            await WorkerService.startOnboarding(userId, pool);
        } catch (e) { /* ignore if already worker */ }

        // Mappings
        await WorkerService.updateProfile(userId, {
            full_name: name,
            dob,
            gender,
            skills: categories || [],
            experience_years: experience,
            service_pincodes: location?.pincode ? [location.pincode] : ['682001']
        }, pool);

        // Location Injection
        if (location && location.isValid) {
            await pool.query(
                `UPDATE worker_profiles 
                 SET home_address=?, home_lat=?, home_lng=?, home_pincode=?, city=? 
                 WHERE user_id=?`,
                [JSON.stringify(location), location.lat, location.lng, location.pincode, location.city, userId]
            );
        }

        if (payment && payment.method) {
            await WorkerService.updatePayment(userId, { payment_method: payment.method, payment_details: payment.details }, pool);
        }

        if (documents && documents.aadhaar_front) {
            await WorkerService.submitDocuments(userId, {
                aadhar_front_key: documents.aadhaar_front,
                aadhar_back_key: documents.aadhaar_back,
                photo_key: documents.selfie
            }, pool);
        }

        await WorkerService.agreeToTerms(userId, agreement_signature, ipAddress, pool);

        return { success: true, message: "Onboarding successfully completed" };
    })
);

/**
 * Worker fetches active job details
 * Includes the END OTP if status is pending_completion, so the worker can show it to the customer.
 */
router.get('/jobs/:id', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;
        const [jobs] = await pool.query(
            `SELECT j.id, j.status, j.category, j.address, j.description, j.total_amount as amount,
                    j.start_otp_generated_at,
                    c.name as customer_name, u.phone as customer_phone
             FROM jobs j
             LEFT JOIN customer_profiles c ON j.customer_id = c.user_id
             LEFT JOIN users u ON j.customer_id = u.id
             WHERE j.id = ? AND j.worker_id = ?`,
            [jobId, userId]
        );
        const job = jobs[0];
        if (!job) throw Object.assign(new Error('Job not found or not assigned to you'), { status: 404 });

        // If job is in pending_completion, fetch the END OTP from Redis to show to the customer
        if (job.status === 'pending_completion') {
            const redisClient = getRedisClient();
            job.end_otp = await redisClient.get(`zarva:otp:end:${jobId}`);
        }

        return { job };
    })
);

/**
 * ATOMIC Job Acceptance
 * Uses Redis SET NX locks explicitly under the hood. Returns 409 if stolen.
 */
router.post('/jobs/:id/accept', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;
        await MatchingEngine.acceptJob(jobId, userId, pool);

        // Fetch worker profile with fallback
        const [workerProfiles] = await pool.query(
            `SELECT COALESCE(name, 'Worker') as name, 
                    average_rating, 
                    profile_s3_key 
             FROM worker_profiles
             WHERE user_id = ?`,
            [userId]
        );
        const wp = workerProfiles[0];
        const workerData = wp ? {
            name: wp.name,
            rating: wp.average_rating,
            photo: wp.profile_s3_key
        } : null;

        // Hook: create Firebase active_jobs node with the full structure
        const [jobs] = await pool.query(
            'SELECT customer_id, latitude, longitude FROM jobs WHERE id=?', [jobId]
        );
        if (jobs[0]) {
            await createJobNode(jobId, userId, jobs[0].latitude, jobs[0].longitude, workerData);
        }

        return { message: 'Job accepted successfully' };
    })
);

/**
 * Job Rejection
 */
router.post('/jobs/:id/decline', (req, res) =>
    handle(req, res, async (userId, pool) => {
        await MatchingEngine.declineJob(req.params.id, userId, pool);
        return { message: 'Job declined successfully' };
    })
);

/**
 * 4.3 OTP FLOWS - Start/End Work Lifecycles 
 */

/**
 * Worker Arrived at Location
 * Guards: worker_en_route
 */
router.post('/jobs/:id/arrived', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;

        // 1. Guard State
        const [jobs] = await pool.query('SELECT id, status, worker_id FROM jobs WHERE id = ? FOR UPDATE', [jobId]);
        const job = jobs[0];

        if (!job || job.worker_id !== userId) throw Object.assign(new Error('Job not associated with you'), { status: 403 });
        if (job.status !== 'worker_en_route' && job.status !== 'assigned') throw Object.assign(new Error(`Invalid job state: ${job.status}`), { status: 400 });

        // 2. Generate Physical Start OTP
        const otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
        const hash = await bcrypt.hash(otp, 10);

        // 3. MySQL Storage (Hash)
        await pool.query(
            `UPDATE jobs SET start_otp_hash=?, start_otp_generated_at=NOW(), status='worker_arrived', arrived_at=NOW() WHERE id=?`,
            [hash, jobId]
        );

        // 4. Redis Storage (Plaintext Relayed to Customer) -> 60 min TTL (3600s)
        const redisClient = getRedisClient();
        await redisClient.set(`zarva:otp:start:${jobId}`, otp, 'EX', 3600);

        // Real Firebase Update
        await updateJobNode(jobId, { status: 'worker_arrived' });

        // Phase 12: Trigger Phone Push to Customer (Issue #1, #2)
        const { notifyCustomerWorkerArrived } = await import('../services/notification.service.js');
        await notifyCustomerWorkerArrived(jobId, otp);

        return { arrived: true }; // NEVER return OTP to worker
    })
);

/**
 * Worker RE-TRIGGERS Start OTP Notification
 * Guards: worker_arrived
 */
router.post('/jobs/:id/resend-start-otp', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;

        const [jobs] = await pool.query('SELECT status, worker_id FROM jobs WHERE id = ?', [jobId]);
        const job = jobs[0];

        if (!job || job.worker_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
        if (job.status !== 'worker_arrived') throw Object.assign(new Error('Invalid job state'), { status: 400 });

        const redisClient = getRedisClient();
        let otp = await redisClient.get(`zarva:otp:start:${jobId}`);

        // If OTP missing/expired, regenerate it (Issue: Refresh Support)
        if (!otp) {
            console.log(`[Worker] OTP for job ${jobId} expired/missing in Redis. Regenerating...`);
            otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
            const hash = await bcrypt.hash(otp, 10);

            await pool.query(
                `UPDATE jobs SET start_otp_hash=?, start_otp_generated_at=NOW() WHERE id=?`,
                [hash, jobId]
            );
            await redisClient.set(`zarva:otp:start:${jobId}`, otp, 'EX', 3600);
        }

        const { notifyCustomerWorkerArrived } = await import('../services/notification.service.js');
        await notifyCustomerWorkerArrived(jobId, otp);

        console.log(`[Worker] Start OTP (Resend/Refresh) triggered for job ${jobId}`);
        return { resent: true, regenerated: !otp };
    })
);

/**
 * Worker Verifies Start OTP internally
 * Guards: worker_arrived
 */
router.post('/jobs/:id/verify-start-otp', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;
        const { otp, code } = req.body;
        const inputOtp = otp || code; // Support both for mobile compatibility

        const [jobs] = await pool.query('SELECT id, status, worker_id, start_otp_hash, start_otp_generated_at, start_otp_attempts FROM jobs WHERE id = ? FOR UPDATE', [jobId]);
        const job = jobs[0];

        if (!job || job.worker_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
        if (job.status !== 'worker_arrived') throw Object.assign(new Error('Invalid job state'), { status: 400 });

        const features = configLoader.get('features');
        if (!features?.otp?.start_otp_enabled) {
            // Bypass logic
            await pool.query(
                `UPDATE jobs SET status='in_progress', work_started_at=NOW(), otp_bypass_reason='Feature Flag Disabled' WHERE id=?`,
                [jobId]
            );
            return { verified: true, bypassed: true };
        }

        // Validity Checks
        if (!job.start_otp_hash) throw new Error('OTP was never generated');
        const generatedAt = new Date(job.start_otp_generated_at);
        if ((Date.now() - generatedAt.getTime()) > 3600000) throw Object.assign(new Error('OTP Expired. Please tap "Ask for code" to refresh.'), { status: 400 });

        // Evaluate Bcrypt Hash
        const match = await bcrypt.compare(String(inputOtp), job.start_otp_hash);

        if (match) {
            await pool.query(`UPDATE jobs SET status='in_progress', work_started_at=NOW() WHERE id=?`, [jobId]);
            await updateJobNode(jobId, { status: 'in_progress' });

            const redisClient = getRedisClient();
            await redisClient.del(`zarva:otp:start:${jobId}`); // Clean cache natively
            return { verified: true };
        } else {
            const attempts = job.start_otp_attempts + 1;
            if (attempts >= 5) {
                // Dispute cascade
                await pool.query(
                    `UPDATE jobs SET status='disputed', start_otp_attempts=?, dispute_raised_at=NOW(), auto_escalate_at=DATE_ADD(NOW(), INTERVAL 48 HOUR) WHERE id=?`,
                    [attempts, jobId]
                );
                await updateJobNode(jobId, { status: 'disputed' });
                throw Object.assign(new Error('Too many failed attempts. Job disputed.'), { status: 403 });
            } else {
                await pool.query(`UPDATE jobs SET start_otp_attempts=? WHERE id=?`, [attempts, jobId]);
                throw Object.assign(new Error('Incorrect OTP'), { status: 400 });
            }
        }
    })
);

/**
 * Worker Triggers Completion (Produces End OTP)
 * Guards: in_progress
 */
router.post('/jobs/:id/complete', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;

        const [jobs] = await pool.query('SELECT id, status, worker_id FROM jobs WHERE id = ? FOR UPDATE', [jobId]);
        const job = jobs[0];

        if (!job || job.worker_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
        if (job.status !== 'in_progress') throw Object.assign(new Error('Invalid job state'), { status: 400 });

        const otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
        const hash = await bcrypt.hash(otp, 10);

        await pool.query(
            `UPDATE jobs SET end_otp_hash=?, end_otp_generated_at=NOW(), status='pending_completion', work_ended_at=NOW() WHERE id=?`,
            [hash, jobId]
        );

        // Redis Storage (Relayed to Worker to SHOW Customer) 180m TTL (10800s)
        const redisClient = getRedisClient();
        await redisClient.set(`zarva:otp:end:${jobId}`, otp, 'EX', 10800);

        await updateJobNode(jobId, { status: 'pending_completion' });
        // console.log(`[Push Notification Mock] -> Customer: "Worker is done - enter completion code"`);

        return { end_otp: otp }; // Worker SEES this in their app to show customer
    })
);

/**
 * 4.4 CANCELLATION ENGINE
 */

/**
 * Worker Cancels Job
 */
router.post('/jobs/:id/cancel', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [jobs] = await conn.query('SELECT status, customer_id, worker_id, cancellation_locked_at FROM jobs WHERE id = ? FOR UPDATE', [jobId]);
            const job = jobs[0];

            if (!job || job.worker_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

            if (['in_progress', 'pending_completion', 'completed', 'disputed', 'cancelled', 'searching', 'open'].includes(job.status)) {
                throw Object.assign(new Error('Cannot cancel at this stage. Raise a dispute.'), { status: 403, code: 'CANNOT_CANCEL' });
            }

            let applyPenalty = false;

            if (job.status === 'assigned' || job.status === 'worker_en_route') {
                if (job.cancellation_locked_at && new Date() > new Date(job.cancellation_locked_at)) {
                    throw Object.assign(new Error('Too late to cancel without dispute.'), { status: 403, code: 'CANCELLATION_LOCKED' });
                }
            } else if (job.status === 'worker_arrived') {
                // Allowed but with a strict penalty metric applied to their profile for abandoning customer at location
                applyPenalty = true;
            }

            // Valid Cancellation Process
            await conn.query(`UPDATE jobs SET status='cancelled', cancelled_by='worker', cancel_reason='Worker requested cancellation' WHERE id=?`, [jobId]);
            await conn.query(`UPDATE worker_profiles SET current_job_id = NULL ${applyPenalty ? ', worker_cancel_penalty = 1' : ''} WHERE user_id=?`, [userId]);

            await updateJobNode(jobId, { status: 'cancelled' });

            // Trigger full refund sweep for Customer
            const [payments] = await conn.query(`SELECT id, amount FROM payments WHERE job_id=? AND status='captured'`, [jobId]);
            for (let payment of payments) {
                await conn.query(`INSERT INTO refund_queue (payment_id, job_id, amount, status) VALUES (?, ?, ?, 'pending')`, [payment.id, jobId, payment.amount]);
            }

            await conn.commit();
            return { cancelled: true, message: applyPenalty ? 'Cancelled with penalty' : 'Cancelled successfully' };
        } catch (txnErr) {
            await conn.rollback();
            throw txnErr;
        } finally {
            conn.release();
        }
    })
);

/**
 * Worker Disputes Job
 */
router.post('/jobs/:id/dispute', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;
        const { reason } = req.body;

        if (!reason) throw Object.assign(new Error('reason field is required for dispute'), { status: 400 });

        const [jobs] = await pool.query('SELECT status, worker_id FROM jobs WHERE id = ?', [jobId]);
        const job = jobs[0];

        if (!job || job.worker_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

        if (job.status === 'completed' || job.status === 'cancelled') {
            throw Object.assign(new Error('Job is finalized.'), { status: 400 });
        }

        await pool.query(
            `UPDATE jobs SET status='disputed', dispute_reason=?, dispute_raised_at=NOW(), auto_escalate_at=DATE_ADD(NOW(), INTERVAL 48 HOUR) WHERE id=?`,
            [reason, jobId]
        );

        await updateJobNode(jobId, { status: 'disputed' });
        return { disputed: true, message: 'Dispute submitted. Admin will review within 48h.' };
    })
);

// ─── PUT /api/worker/location ────────────────────────────────────────────────
// Authenticated worker updates their GPS position
router.put('/location', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const { lat, lng } = req.body;
        if (lat == null || lng == null) throw Object.assign(new Error('lat and lng required'), { status: 400 });

        // Guard: must be verified and online
        const [profiles] = await pool.query(
            'SELECT kyc_status, is_online, current_job_id FROM worker_profiles WHERE user_id=?',
            [userId]
        );
        const profile = profiles[0] || {};

        if (profile.kyc_status !== 'approved') throw Object.assign(new Error('Worker not verified'), { status: 403 });
        if (!profile.is_online) throw Object.assign(new Error('Worker must be online to update location'), { status: 403 });

        // 1. Update DB
        await pool.query(
            'UPDATE worker_profiles SET last_location_lat=?, last_location_lng=?, last_location_at=NOW() WHERE user_id=?',
            [lat, lng, userId]
        );

        // 2. Sync Firebase worker_presence
        await updateWorkerPresence(userId, {
            is_online: true,
            lat,
            lng,
            current_job_id: profile.current_job_id || null
        });

        // 3. If on an active job — update active_jobs node + log to history
        if (profile.current_job_id) {
            await updateJobNode(profile.current_job_id, { worker_lat: lat, worker_lng: lng });

            await pool.query(
                'INSERT INTO worker_location_history (worker_id, job_id, latitude, longitude) VALUES (?, ?, ?, ?)',
                [userId, profile.current_job_id, lat, lng]
            );
        } else {
            // Idle ping — still log to history (job_id = NULL)
            await pool.query(
                'INSERT INTO worker_location_history (worker_id, job_id, latitude, longitude) VALUES (?, NULL, ?, ?)',
                [userId, lat, lng]
            );
        }

        return { updated: true, lat, lng };
    })
);

// ─── PUT /api/worker/availability ───────────────────────────────────────────
// Toggle worker online / offline
router.put('/availability', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const { is_online, is_available } = req.body;

        let updateQuery = [];
        let params = [];
        let firebaseSync = {};

        if (is_online !== undefined) {
            updateQuery.push('is_online=?');
            params.push(is_online ? 1 : 0);
            firebaseSync.is_online = Boolean(is_online);
        }
        if (is_available !== undefined) {
            updateQuery.push('is_available=?');
            params.push(is_available ? 1 : 0);
            firebaseSync.is_available = Boolean(is_available);
        }

        if (updateQuery.length === 0) {
            throw Object.assign(new Error('is_online or is_available required'), { status: 400 });
        }

        const [wp] = await pool.query(
            'SELECT current_job_id FROM worker_profiles WHERE user_id=?',
            [userId]
        );
        const profile = wp[0];
        if (!profile) throw Object.assign(new Error('Worker profile not found'), { status: 404 });

        // Update DB
        params.push(userId);
        await pool.query(
            `UPDATE worker_profiles SET ${updateQuery.join(', ')} WHERE user_id=?`,
            params
        );

        // Sync Firebase
        await updateWorkerPresence(userId, firebaseSync);

        const response = { ...firebaseSync };

        // Warn — don't clear the active job, just notify
        if (is_online === false && profile.current_job_id) {
            response.warning = `You went offline with an active job (${profile.current_job_id}). Please complete or cancel it.`;
        }

        return response;
    })
);

// ─── GET /api/worker/available-jobs ───────────────────────────────────────────
// Get nearby open jobs for worker
router.get('/available-jobs', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const [profiles] = await pool.query(
            'SELECT kyc_status, is_online, category, last_location_lat, last_location_lng FROM worker_profiles WHERE user_id=?',
            [userId]
        );
        const profile = profiles[0] || {};

        if (profile.kyc_status !== 'approved') throw Object.assign(new Error('Worker not verified'), { status: 403 });

        if (!profile.is_online) {
            return { jobs: [], is_online: false };
        }

        const hasLocation = profile.last_location_lat && profile.last_location_lng;

        let jobs;
        if (hasLocation) {
            // Geo-sorted with Haversine
            [jobs] = await pool.query(
                `SELECT j.id, j.category, j.status, j.created_at, j.address,
                        j.description, j.rate_per_hour, j.advance_amount, j.total_amount,
                        j.travel_charge, j.scheduled_at,
                        j.latitude, j.longitude,
                        c.name as customer_name,
                        ROUND(
                            6371 * acos(
                                cos(radians(?)) * cos(radians(j.latitude)) 
                                * cos(radians(j.longitude) - radians(?)) 
                                + sin(radians(?)) * sin(radians(j.latitude))
                            ), 1
                        ) AS distance_km
                 FROM jobs j
                 LEFT JOIN customer_profiles c ON j.customer_id = c.user_id
                 WHERE j.status IN ('open', 'searching', 'no_worker_found')
                 HAVING distance_km IS NULL OR distance_km <= 50
                 ORDER BY distance_km ASC, j.created_at DESC LIMIT 50`,
                [profile.last_location_lat, profile.last_location_lng, profile.last_location_lat]
            );
        } else {
            // No location set — return all open jobs by date
            [jobs] = await pool.query(
                `SELECT j.id, j.category, j.status, j.created_at, j.address,
                        j.description, j.rate_per_hour, j.advance_amount, j.total_amount,
                        j.latitude, j.longitude,
                        c.name as customer_name, NULL as distance_km
                 FROM jobs j
                 LEFT JOIN customer_profiles c ON j.customer_id = c.user_id
                 WHERE j.status IN ('open', 'searching', 'no_worker_found')
                 ORDER BY j.created_at DESC LIMIT 50`
            );
        }

        const mappedJobs = jobs.map(j => {
            const desc = j.description || j.address || 'Service Request';
            const rph = j.rate_per_hour || 0;
            const est = rph > 0 ? `₹${rph}/hr` : 'Price on completion';

            return {
                id: j.id,
                category: j.category,
                icon: '⚡',
                dist: j.distance_km !== null ? parseFloat(j.distance_km) : null, // Always in KM
                latitude: j.latitude || null,
                longitude: j.longitude || null,
                est,
                address: j.address || '',
                scheduled_at: j.scheduled_at || null,
                advance_amount: j.advance_amount || 0,
                travel_charge: j.travel_charge || 0,
                total_amount: j.total_amount || null,
                rate_per_hour: j.rate_per_hour || 0,
                is_emergency: Boolean(j.is_emergency),
                time: j.created_at,
                customer_name: j.customer_name || 'Customer',
                wave_number: 1 // Default fallback for wave tracker
            };
        });

        return { jobs: mappedJobs, is_online: true };
    })
);

// ─── GET /api/worker/history ───────────────────────────────────────────
// Get worker work history
router.get('/history', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const [jobs] = await pool.query(
            `SELECT j.id, j.category, j.status, j.created_at, j.address,
                    (SELECT total FROM job_invoices WHERE job_id = j.id LIMIT 1) as amount
             FROM jobs j
             WHERE j.worker_id = ? AND j.status IN ('assigned', 'worker_en_route', 'worker_arrived', 'in_progress', 'pending_completion', 'completed', 'cancelled', 'disputed')
             ORDER BY j.created_at DESC LIMIT 50`,
            [userId]
        );

        const mappedHistory = jobs.map(j => {
            // j.address is VARCHAR(500) — a plain string, not JSON
            const addr = j.address || 'Address unavailable';

            return {
                id: String(j.id),
                category: j.category,
                address: addr,
                amount: j.amount ? '₹' + j.amount : '₹0',
                date: j.created_at,
                status: j.status
            };
        });

        return { history: mappedHistory };
    })
);

// ─── GET /api/worker/earnings ──────────────────────────────────────────────
// Get worker earnings overview and transaction list
router.get('/earnings', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const [overviewRows] = await pool.query(
            `SELECT 
                SUM(CASE WHEN DATE(ji.created_at) = CURDATE() THEN ji.subtotal ELSE 0 END) as today,
                SUM(CASE WHEN YEARWEEK(ji.created_at, 1) = YEARWEEK(CURDATE(), 1) THEN ji.subtotal ELSE 0 END) as week,
                SUM(CASE WHEN MONTH(ji.created_at) = MONTH(CURDATE()) AND YEAR(ji.created_at) = YEAR(CURDATE()) THEN ji.subtotal ELSE 0 END) as month
             FROM job_invoices ji
             JOIN jobs j ON j.id = ji.job_id
             WHERE j.worker_id = ? AND j.status = 'completed'`,
            [userId]
        );

        const overview = {
            Today: parseFloat(overviewRows[0]?.today || 0),
            'This Week': parseFloat(overviewRows[0]?.week || 0),
            'This Month': parseFloat(overviewRows[0]?.month || 0)
        };

        const [txRows] = await pool.query(
            `SELECT ji.id, j.category as title, ji.subtotal as amt, ji.created_at as time
             FROM job_invoices ji
             JOIN jobs j ON j.id = ji.job_id
             WHERE j.worker_id = ? AND j.status = 'completed'
             ORDER BY ji.created_at DESC LIMIT 50`,
            [userId]
        );

        const transactions = txRows.map(tx => ({
            id: String(tx.id),
            title: tx.title,
            amt: '+₹' + parseFloat(tx.amt),
            type: 'credit',
            time: new Date(tx.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        return { overview, transactions };
    })
);

export default router;
