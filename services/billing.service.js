import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import bcrypt from 'bcrypt';
import { updateJobNode } from './firebase.service.js';
import * as PricingService from './pricing.service.js';

class BillingService {

    // Compare OTP using DB hash when available; fallback to Redis plaintext (legacy/migration-safe path).
    async _compareOtpWithFallback(jobId, otpInput, dbHash, redisKey) {
        if (dbHash) {
            return bcrypt.compare(String(otpInput), dbHash);
        }
        const redis = (await import('../config/redis.js')).getRedisClient();
        const redisOtp = await redis.get(redisKey);
        if (!redisOtp || !otpInput) return false;
        return String(redisOtp) === String(otpInput);
    }

    _getConfig() {
        return configLoader.get('pricing');
    }

    /**
     * Calculates Inspection Fee based on config rules.
     * @param {number} hourlyRate 
     * @param {number} distanceKm 
     */
    calculateInspectionFee(hourlyRate, distanceKm) {
        return PricingService.calculateInspectionFee(hourlyRate, distanceKm);
    }

    /**
     * Recomputes actual exact elapsed time for a job scanning all events.
     * @param {number} jobId 
     * @param {any} poolInstance - pass transacted connection if inside transaction
     * @returns {Promise<{ billedMinutes: number, total: number, actualElapsedMinutes: number }>}
     */
    async calculateJobBill(jobId, poolInstance = null) {
        const db = poolInstance || getPool();

        // 1. Fetch Job
        const [jobs] = await db.query(
            `SELECT hourly_rate, inspection_fee, travel_charge, billing_cap_minutes 
             FROM jobs WHERE id = $1`,
            [jobId]
        );
        const job = jobs[0];
        if (!job) throw new Error('Job not found');

        // 2. Fetch all events ordered by time
        const [events] = await db.query(
            `SELECT event_type, server_timestamp FROM job_timer_events 
             WHERE job_id = $1 ORDER BY server_timestamp ASC`,
            [jobId]
        );

        const bill = PricingService.calculateJobBill(events, job.hourly_rate, job.billing_cap_minutes);

        if (!job.hourly_rate || parseFloat(job.hourly_rate) === 0) {
            console.warn(`[BillingService] ⚠️  Job ${jobId} has NULL/zero hourly_rate — labor will be charged at minimum. Check job creation flow.`);
        }

        return {
            actualElapsedMinutes: bill.actual_minutes || 0,
            billedMinutes: bill.billed_minutes || 0,
            exceededEstimate: bill.cap_applied,
            jobAmount: bill.billed_amount || 0,
            inspectionFee: parseFloat(job.inspection_fee || 0),
            travelCharge: parseFloat(job.travel_charge || 0),
            totalAmount: (bill.billed_amount || 0) + parseFloat(job.inspection_fee || 0) + parseFloat(job.travel_charge || 0)
        };
    }

    /**
     * Audit Event Writer
     */
    async _recordTimerEvent(conn, jobId, eventType, triggeredBy, notes = null, metadata = null) {
        await conn.query(
            `INSERT INTO job_timer_events (job_id, event_type, triggered_by, notes, metadata) 
             VALUES ($1, $2, $3, $4, $5)`,
            [jobId, eventType, triggeredBy, notes, metadata ? JSON.stringify(metadata) : null]
        );
    }

    // --- State Transitions ---

    async startInspection(jobId, otpInput, customerId) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [jobs] = await conn.query('SELECT status, customer_id, inspection_otp_hash, worker_id, hourly_rate, distance_km FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
            const job = jobs[0];

            if (!job) throw Object.assign(new Error('Job not found'), { status: 404 });
            if (job.status !== 'worker_arrived') throw Object.assign(new Error('Job is not ready for inspection'), { status: 400 });

            const match = await this._compareOtpWithFallback(jobId, otpInput, job.inspection_otp_hash, `zarva:otp:inspection:${jobId}`);
            if (!match) throw Object.assign(new Error('Invalid Inspection Code'), { status: 400 });

            // Re-calculate fee just to be safe, or pull from existing field if set
            const feeData = this.calculateInspectionFee(job.hourly_rate, job.distance_km || 0);

            await conn.query(
                `UPDATE jobs 
                 SET status = 'inspection_active', 
                     inspection_started_at = NOW(), 
                     inspection_expires_at = NOW() + INTERVAL '15 minutes',
                     inspection_fee = $1,
                     travel_charge = $2
                 WHERE id = $3`,
                [feeData.inspection_base, feeData.travel_charge, jobId]
            );

            await this._recordTimerEvent(conn, jobId, 'inspection_start', 'worker', 'Customer verified OTP');

            await conn.commit();
            await updateJobNode(jobId, { status: 'inspection_active' });
            return true;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async submitEstimate(jobId, workerId, expectedMinutes, notes, photoUrl = null) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [jobs] = await conn.query('SELECT status, worker_id FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
            const job = jobs[0];

            if (!job || job.worker_id !== workerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'inspection_active') throw Object.assign(new Error('Cannot submit estimate now'), { status: 400 });

            await conn.query(
                `UPDATE jobs 
                 SET status = 'estimate_submitted',
                     estimated_duration_minutes = $1,
                     billing_cap_minutes = $1,
                     issue_notes = $2,
                     inspection_ended_at = NOW()
                 WHERE id = $3`,
                [expectedMinutes, notes, jobId]
            );

            await this._recordTimerEvent(conn, jobId, 'inspection_end', 'worker', 'Estimate submitted', { expectedMinutes, photoUrl });

            await conn.commit();
            await updateJobNode(jobId, { status: 'estimate_submitted', estimate_minutes: expectedMinutes });
            return true;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async startJob(jobId, otpInput, customerId) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [jobs] = await conn.query(
                'SELECT status, customer_id, start_otp_hash, worker_id, hourly_rate, billing_cap_minutes, inspection_fee, travel_charge FROM jobs WHERE id = $1 FOR UPDATE',
                [jobId]
            );
            const job = jobs[0];

            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'estimate_submitted') throw Object.assign(new Error('Estimate must be submitted first'), { status: 400 });

            const match = await this._compareOtpWithFallback(jobId, otpInput, job.start_otp_hash, `zarva:otp:start:${jobId}`);
            if (!match) throw Object.assign(new Error('Invalid Start Code'), { status: 400 });

            await conn.query(
                `UPDATE jobs 
                 SET status = 'in_progress', 
                     job_started_at = NOW() 
                 WHERE id = $1`,
                [jobId]
            );

            await this._recordTimerEvent(conn, jobId, 'job_start', 'worker', 'Customer approved estimate & started job');

            const hourlyRate = parseFloat(job.hourly_rate || 0);
            const capMins = parseInt(job.billing_cap_minutes || 60, 10);
            const inspectionFee = parseFloat(job.inspection_fee || 0);
            const travelCharge = parseFloat(job.travel_charge || 0);
            const estimatedAmount = (capMins / 60) * hourlyRate + inspectionFee + travelCharge;
            const estimatedPaise = Math.ceil(estimatedAmount * 100);
            if (estimatedPaise > 0) {
                const walletService = await import('./wallet.service.js');
                await walletService.postJobStartEntries(jobId, estimatedPaise, job.customer_id, conn);
            }

            await conn.commit();

            // Push active status to Firebase Timer Node
            await updateJobNode(jobId, { status: 'in_progress' });

            return true;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async stopJobAndBill(jobId, triggeredByRole, connProvided = null, targetStatus = 'pending_completion') {
        const _conn = connProvided || await getPool().getConnection();
        const doTransaction = !connProvided;

        if (doTransaction) await _conn.beginTransaction();

        try {
            // Check for existing job_end to avoid duplicate triggers (sudden completion bug)
            const [existingEnd] = await _conn.query(
                `SELECT id FROM job_timer_events WHERE job_id = $1 AND event_type = 'job_end' LIMIT 1`,
                [jobId]
            );
            if (!existingEnd || existingEnd.length === 0) {
                await this._recordTimerEvent(_conn, jobId, 'job_end', triggeredByRole);
            }

            const bill = await this.calculateJobBill(jobId, _conn);

            await _conn.query(
                `UPDATE jobs 
                 SET status = $1,
                     job_ended_at = NOW(),
                     final_billed_minutes = $2,
                     final_amount = $3,
                     exceeded_estimate = $4
                 WHERE id = $5`,
                [targetStatus, bill.billedMinutes, bill.totalAmount, bill.exceededEstimate, jobId]
            );

            if (doTransaction) await _conn.commit();

            await updateJobNode(jobId, { status: targetStatus, final_cost: bill.totalAmount });

            return bill;
        } catch (err) {
            if (doTransaction) await _conn.rollback();
            throw err;
        } finally {
            if (doTransaction) _conn.release();
        }
    }

    async requestExtension(jobId, workerId, reason, additionalMinutes, photoUrl, photoCapturedAt) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [jobs] = await conn.query('SELECT status, worker_id FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
            const job = jobs[0];

            if (!job || job.worker_id !== workerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'in_progress') throw Object.assign(new Error('Extension only allowed during active job'), { status: 400 });

            // Pause the timer 
            await this._recordTimerEvent(conn, jobId, 'job_pause', 'worker', 'Extension requested');
            await this._recordTimerEvent(conn, jobId, 'extension_requested', 'worker', reason);

            await conn.query(
                `INSERT INTO job_extensions (job_id, reason, additional_minutes, photo_url, photo_captured_at, status)
                 VALUES ($1, $2, $3, $4, $5, 'pending')`,
                [jobId, reason, additionalMinutes, photoUrl, photoCapturedAt]
            );

            // Temporarily set job status if needed, but 'in_progress' + paused timer in Firebase 
            await conn.commit();

            // Firebase update to reflect paused/extension pending state
            const { updateExtensionNode } = await import('./firebase.service.js');
            await updateExtensionNode(jobId, {
                status: 'pending',
                additional_minutes: additionalMinutes,
                reason: reason
            });
            await updateJobNode(jobId, { timer_status: 'paused' });

            return true;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async approveExtension(jobId, otpInput, customerId) {
        // Implementation for customer approving extension via OTP
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [jobs] = await conn.query('SELECT status, customer_id, billing_cap_minutes FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
            const job = jobs[0];

            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });

            // Find pending extension
            const [extensions] = await conn.query('SELECT id, additional_minutes, otp_hash FROM job_extensions WHERE job_id = $1 AND status = $2', [jobId, 'pending']);
            const ext = extensions[0];
            if (!ext) throw Object.assign(new Error('No pending extension request'), { status: 400 });

            const match = await this._compareOtpWithFallback(jobId, otpInput, ext.otp_hash, `zarva:otp:extension:${jobId}`);
            if (!match) throw Object.assign(new Error('Invalid Extension Code'), { status: 400 });

            // Approve it
            await conn.query('UPDATE job_extensions SET status = $1, resolved_at = NOW() WHERE id = $2', ['approved', ext.id]);

            // Update billing cap
            const newCap = (job.billing_cap_minutes || 0) + ext.additional_minutes;
            await conn.query('UPDATE jobs SET billing_cap_minutes = $1, approved_extension_minutes = approved_extension_minutes + $2 WHERE id = $3', [newCap, ext.additional_minutes, jobId]);

            // Resume timer
            await this._recordTimerEvent(conn, jobId, 'extension_approved', 'customer');
            await this._recordTimerEvent(conn, jobId, 'job_resume', 'system', 'Timer resumed after extension');

            await conn.commit();

            const { updateExtensionNode } = await import('./firebase.service.js');
            await updateExtensionNode(jobId, { status: 'approved' });
            await updateJobNode(jobId, { timer_status: 'active', billing_cap_minutes: newCap });

            return true;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async rejectExtension(jobId, customerId) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [jobs] = await conn.query('SELECT customer_id FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
            const job = jobs[0];

            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });

            const [extensions] = await conn.query('SELECT id FROM job_extensions WHERE job_id = $1 AND status = $2', [jobId, 'pending']);
            const ext = extensions[0];
            if (!ext) throw Object.assign(new Error('No pending extension request'), { status: 400 });

            // Reject
            await conn.query('UPDATE job_extensions SET status = $1, resolved_at = NOW() WHERE id = $2', ['rejected', ext.id]);
            await this._recordTimerEvent(conn, jobId, 'extension_rejected', 'customer');

            // Hard end the job to protect the customer
            await this.stopJobAndBill(jobId, 'customer', conn);

            await conn.commit();

            const { updateExtensionNode } = await import('./firebase.service.js');
            await updateExtensionNode(jobId, { status: 'rejected' });
            return true;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    // ═══════════════════════════════════════════════════════
    // INSPECTION EXTENSION METHODS
    // ═══════════════════════════════════════════════════════

    async requestInspectionExtension(jobId, workerId) {
        const pool = getPool();
        const [jobs] = await pool.query(
            'SELECT status, worker_id, inspection_extension_count, inspection_expires_at, inspection_extended_until FROM jobs WHERE id = $1',
            [jobId]
        );
        const job = jobs[0];
        if (!job || job.worker_id !== workerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
        if (job.status !== 'inspection_active') throw Object.assign(new Error('Not in inspection phase'), { status: 400 });
        const count = parseInt(job.inspection_extension_count || 0, 10);
        if (count >= 2) throw Object.assign(new Error('Maximum 2 inspection extensions allowed'), { status: 400 });

        const crypto = (await import('crypto')).default;
        const bcryptLib = (await import('bcrypt')).default;
        const otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
        const hash = await bcryptLib.hash(otp, 10);

        await pool.query('UPDATE jobs SET inspection_extension_otp_hash=$1 WHERE id=$2', [hash, jobId]);

        const redis = (await import('../config/redis.js')).getRedisClient();
        await redis.set(`zarva:otp:inspection_ext:${jobId}`, otp, 'EX', 1800);

        const { updateJobNode } = await import('./firebase.service.js');
        await updateJobNode(jobId, { inspection_ext_pending: true, inspection_ext_count: count });

        return { requested: true, extension_number: count + 1, otp };
    }

    async approveInspectionExtension(jobId, otpInput, customerId) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            const [jobs] = await conn.query(
                'SELECT status, customer_id, inspection_extension_otp_hash, inspection_extension_count, inspection_extended_until, inspection_expires_at FROM jobs WHERE id = $1 FOR UPDATE',
                [jobId]
            );
            const job = jobs[0];
            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'inspection_active') throw Object.assign(new Error('Not in inspection'), { status: 400 });

            const bcryptLib = (await import('bcrypt')).default;
            const match = await this._compareOtpWithFallback(jobId, otpInput, job.inspection_extension_otp_hash, `zarva:otp:inspection_ext:${jobId}`);
            if (!match) throw Object.assign(new Error('Invalid extension code'), { status: 400 });

            const base = job.inspection_extended_until || job.inspection_expires_at;
            const newExpiry = new Date(new Date(base).getTime() + 10 * 60 * 1000);
            const newCount = parseInt(job.inspection_extension_count || 0, 10) + 1;

            await conn.query(
                'UPDATE jobs SET inspection_extended_until=$1, inspection_extension_count=$2, inspection_extension_otp_hash=NULL WHERE id=$3',
                [newExpiry.toISOString(), newCount, jobId]
            );
            await this._recordTimerEvent(conn, jobId, 'inspection_extended', 'customer', `Extension ${newCount} approved`);
            await conn.commit();

            const redis = (await import('../config/redis.js')).getRedisClient();
            await redis.del(`zarva:otp:inspection_ext:${jobId}`);

            const { updateJobNode } = await import('./firebase.service.js');
            await updateJobNode(jobId, {
                inspection_ext_pending: false,
                inspection_extended_until: newExpiry.getTime(),
                inspection_extension_count: newCount,
            });
            return { approved: true, extended_until: newExpiry };
        } catch (err) {
            await conn.rollback(); throw err;
        } finally { conn.release(); }
    }

    async rejectEstimate(jobId, customerId) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            const [jobs] = await conn.query(
                'SELECT status, customer_id, inspection_fee, travel_charge FROM jobs WHERE id=$1 FOR UPDATE', [jobId]
            );
            const job = jobs[0];
            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'estimate_submitted') throw Object.assign(new Error('No estimate to reject'), { status: 400 });

            const partialAmount = parseFloat(job.inspection_fee || 0) + parseFloat(job.travel_charge || 0);
            await conn.query(
                `UPDATE jobs SET status='cancelled', estimate_rejected_at=NOW(), final_amount=$1 WHERE id=$2`,
                [partialAmount, jobId]
            );
            await this._recordTimerEvent(conn, jobId, 'estimate_rejected', 'customer', 'Customer rejected estimate');
            await conn.commit();

            const { updateJobNode } = await import('./firebase.service.js');
            await updateJobNode(jobId, { status: 'cancelled', cancellation_reason: 'estimate_rejected' });
            return { cancelled: true, partial_charge: partialAmount };
        } catch (err) {
            await conn.rollback(); throw err;
        } finally { conn.release(); }
    }

    // ═══════════════════════════════════════════════════════
    // WORK PAUSE / RESUME METHODS
    // ═══════════════════════════════════════════════════════

    async requestPause(jobId, workerId, reason) {
        const pool = getPool();
        const [jobs] = await pool.query(
            'SELECT status, worker_id, pause_count, total_paused_seconds FROM jobs WHERE id=$1', [jobId]
        );
        const job = jobs[0];
        if (!job || job.worker_id !== workerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
        if (job.status !== 'in_progress') throw Object.assign(new Error('Can only pause during active work'), { status: 400 });
        if (parseInt(job.pause_count || 0, 10) >= 2) throw Object.assign(new Error('Max 2 pauses allowed per job'), { status: 400 });
        if (parseInt(job.total_paused_seconds || 0, 10) >= 1800) throw Object.assign(new Error('Max 30 minutes total paused time reached'), { status: 400 });

        const crypto = (await import('crypto')).default;
        const bcryptLib = (await import('bcrypt')).default;
        const otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
        const hash = await bcryptLib.hash(otp, 10);

        try {
            await pool.query(
                `UPDATE jobs SET status='pause_requested', pause_reason=$1, pause_otp_hash=$2 WHERE id=$3`,
                [reason, hash, jobId]
            );
        } catch (err) {
            // Graceful compatibility path when pause_otp_hash column is missing in older DBs.
            if (err?.code === '42703') {
                await pool.query(
                    `UPDATE jobs SET status='pause_requested', pause_reason=$1 WHERE id=$2`,
                    [reason, jobId]
                );
            } else {
                throw err;
            }
        }

        const redis = (await import('../config/redis.js')).getRedisClient();
        await redis.set(`zarva:otp:pause:${jobId}`, otp, 'EX', 900); // 15-min window

        const { updateJobNode } = await import('./firebase.service.js');
        await updateJobNode(jobId, { status: 'pause_requested', pause_reason: reason });
        return { requested: true };
    }

    async approvePause(jobId, otpInput, customerId) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            const [jobs] = await conn.query(
                'SELECT status, customer_id, pause_otp_hash, pause_count FROM jobs WHERE id=$1 FOR UPDATE', [jobId]
            );
            const job = jobs[0];
            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'pause_requested') throw Object.assign(new Error('No pause pending'), { status: 400 });

            const match = await this._compareOtpWithFallback(jobId, otpInput, job.pause_otp_hash, `zarva:otp:pause:${jobId}`);
            if (!match) throw Object.assign(new Error('Invalid pause code'), { status: 400 });

            const newCount = parseInt(job.pause_count || 0, 10) + 1;
            await conn.query(
                `UPDATE jobs SET status='work_paused', paused_at=NOW(), pause_count=$1, pause_otp_hash=NULL WHERE id=$2`,
                [newCount, jobId]
            );
            await this._recordTimerEvent(conn, jobId, 'job_pause', 'customer', `Pause ${newCount} approved`);
            await conn.commit();

            const redis = (await import('../config/redis.js')).getRedisClient();
            await redis.del(`zarva:otp:pause:${jobId}`);

            const { updateJobNode } = await import('./firebase.service.js');
            await updateJobNode(jobId, { status: 'work_paused', timer_status: 'paused' });
            return { approved: true };
        } catch (err) {
            await conn.rollback(); throw err;
        } finally { conn.release(); }
    }

    async requestResume(jobId, workerId) {
        const pool = getPool();
        const [jobs] = await pool.query(
            'SELECT status, worker_id FROM jobs WHERE id=$1', [jobId]
        );
        const job = jobs[0];
        if (!job || job.worker_id !== workerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
        if (job.status !== 'work_paused') throw Object.assign(new Error('Job is not paused'), { status: 400 });

        const crypto = (await import('crypto')).default;
        const bcryptLib = (await import('bcrypt')).default;
        const otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
        const hash = await bcryptLib.hash(otp, 10);

        await pool.query(
            `UPDATE jobs SET status='resume_requested', resume_otp_hash=$1 WHERE id=$2`,
            [hash, jobId]
        );

        const redis = (await import('../config/redis.js')).getRedisClient();
        await redis.set(`zarva:otp:resume:${jobId}`, otp, 'EX', 900);

        const { updateJobNode } = await import('./firebase.service.js');
        await updateJobNode(jobId, { status: 'resume_requested' });
        return { requested: true };
    }

    async approveResume(jobId, otpInput, customerId) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            const [jobs] = await conn.query(
                'SELECT status, customer_id, resume_otp_hash, paused_at, total_paused_seconds FROM jobs WHERE id=$1 FOR UPDATE', [jobId]
            );
            const job = jobs[0];
            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'resume_requested') throw Object.assign(new Error('No resume pending'), { status: 400 });

            const bcryptLib = (await import('bcrypt')).default;
            const match = await bcryptLib.compare(String(otpInput), job.resume_otp_hash || '');
            if (!match) throw Object.assign(new Error('Invalid resume code'), { status: 400 });

            const pauseStart = new Date(job.paused_at).getTime();
            const pausedSecs = Math.floor((Date.now() - pauseStart) / 1000);
            const totalPaused = parseInt(job.total_paused_seconds || 0, 10) + pausedSecs;

            await conn.query(
                `UPDATE jobs SET status='in_progress', paused_at=NULL, total_paused_seconds=$1, resume_otp_hash=NULL WHERE id=$2`,
                [totalPaused, jobId]
            );
            await this._recordTimerEvent(conn, jobId, 'job_resume', 'customer', `Resumed after ${pausedSecs}s`);
            await conn.commit();

            const redis = (await import('../config/redis.js')).getRedisClient();
            await redis.del(`zarva:otp:resume:${jobId}`);

            const { updateJobNode } = await import('./firebase.service.js');
            await updateJobNode(jobId, { status: 'in_progress', timer_status: 'running', total_paused_seconds: totalPaused });
            return { resumed: true, paused_seconds_added: pausedSecs };
        } catch (err) {
            await conn.rollback(); throw err;
        } finally { conn.release(); }
    }

    // ═══════════════════════════════════════════════════════
    // SUSPENSION / RESCHEDULE (requires customer OTP)
    // ═══════════════════════════════════════════════════════

    async requestSuspend(jobId, workerId, reason, rescheduleAt) {
        const pool = getPool();
        const [jobs] = await pool.query(
            'SELECT status, worker_id FROM jobs WHERE id=$1', [jobId]
        );
        const job = jobs[0];
        if (!job || job.worker_id !== workerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
        if (!['in_progress', 'work_paused'].includes(job.status)) throw Object.assign(new Error('Can only suspend during active/paused work'), { status: 400 });

        const crypto = (await import('crypto')).default;
        const bcryptLib = (await import('bcrypt')).default;
        const otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
        const hash = await bcryptLib.hash(otp, 10);

        try {
            await pool.query(
                `UPDATE jobs SET status='suspend_requested', suspend_reason=$1, suspend_reschedule_at=$2, suspend_otp_hash=$3 WHERE id=$4`,
                [reason, rescheduleAt, hash, jobId]
            );
        } catch (err) {
            // Graceful compatibility path when suspend_otp_hash column is missing in older DBs.
            if (err?.code === '42703') {
                await pool.query(
                    `UPDATE jobs SET status='suspend_requested', suspend_reason=$1, suspend_reschedule_at=$2 WHERE id=$3`,
                    [reason, rescheduleAt, jobId]
                );
            } else {
                throw err;
            }
        }

        const redis = (await import('../config/redis.js')).getRedisClient();
        await redis.set(`zarva:otp:suspend:${jobId}`, otp, 'EX', 900);

        const { updateJobNode } = await import('./firebase.service.js');
        await updateJobNode(jobId, {
            status: 'suspend_requested',
            suspend_reason: reason,
            suspend_reschedule_at: new Date(rescheduleAt).getTime(),
        });
        return { requested: true };
    }

    async approveSuspend(jobId, otpInput, customerId) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            const [jobs] = await conn.query(
                'SELECT *, customer_id FROM jobs WHERE id=$1 FOR UPDATE', [jobId]
            );
            const job = jobs[0];
            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'suspend_requested') throw Object.assign(new Error('No suspension pending'), { status: 400 });

            const match = await this._compareOtpWithFallback(jobId, otpInput, job.suspend_otp_hash, `zarva:otp:suspend:${jobId}`);
            if (!match) throw Object.assign(new Error('Invalid reschedule code'), { status: 400 });

            // Bill today's work then suspend
            const bill = await this.stopJobAndBill(jobId, 'worker', conn, 'suspended');
            await conn.query('UPDATE jobs SET suspended_at=NOW() WHERE id=$1', [jobId]);
            await this._recordTimerEvent(conn, jobId, 'job_suspended', 'customer', 'Reschedule approved');

            // Create follow-up linked job
            const crypto = (await import('crypto')).default;
            const [newJobs] = await conn.query(
                `INSERT INTO jobs (customer_id, worker_id, category, address, description,
                    latitude, longitude, hourly_rate, status, scheduled_for)
                 SELECT customer_id, worker_id, category, address, description,
                    latitude, longitude, hourly_rate, 'assigned', $1
                 FROM jobs WHERE id=$2
                 RETURNING id`,
                [job.suspend_reschedule_at, jobId]
            );
            const followupId = newJobs[0]?.id;
            if (followupId) {
                await conn.query('UPDATE jobs SET followup_job_id=$1 WHERE id=$2', [followupId, jobId]);
            }

            await conn.commit();

            const redis = (await import('../config/redis.js')).getRedisClient();
            await redis.del(`zarva:otp:suspend:${jobId}`);

            const { updateJobNode } = await import('./firebase.service.js');
            await updateJobNode(jobId, { status: 'suspended', followup_job_id: followupId });
            return { suspended: true, followup_job_id: followupId, bill };
        } catch (err) {
            await conn.rollback(); throw err;
        } finally { conn.release(); }
    }

    // ═══════════════════════════════════════════════════════
    // CUSTOMER STOP EARLY
    // ═══════════════════════════════════════════════════════

    async customerStopWork(jobId, customerId) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            const [jobs] = await conn.query(
                'SELECT status, customer_id FROM jobs WHERE id=$1 FOR UPDATE', [jobId]
            );
            const job = jobs[0];
            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (!['in_progress', 'work_paused'].includes(job.status)) throw Object.assign(new Error('Job is not in progress'), { status: 400 });

            const safeStopEnds = new Date(Date.now() + 5 * 60 * 1000);
            await conn.query(
                `UPDATE jobs SET status='customer_stopping', customer_stopped_at=NOW(), safe_stop_window_ends_at=$1 WHERE id=$2`,
                [safeStopEnds.toISOString(), jobId]
            );
            await this._recordTimerEvent(conn, jobId, 'customer_stop_requested', 'customer', 'Customer initiated stop');
            await conn.commit();

            const { updateJobNode } = await import('./firebase.service.js');
            await updateJobNode(jobId, {
                status: 'customer_stopping',
                safe_stop_window_ends_at: safeStopEnds.getTime(),
                timer_status: 'frozen',
            });
            return { stopping: true, safe_stop_window_ends_at: safeStopEnds };
        } catch (err) {
            await conn.rollback(); throw err;
        } finally { conn.release(); }
    }

    // ═══════════════════════════════════════════════════════
    // MATERIALS DECLARATION
    // ═══════════════════════════════════════════════════════

    async declareMaterials(jobId, workerId, items) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();
        try {
            const [jobs] = await conn.query(
                'SELECT status, worker_id, category FROM jobs WHERE id=$1 FOR UPDATE', [jobId]
            );
            const job = jobs[0];
            if (!job || job.worker_id !== workerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'pending_completion') throw Object.assign(new Error('Materials must be declared during completion phase'), { status: 400 });

            // ─── Config-driven validation ────────────────────────────
            const pricingCfg = configLoader.get('pricing');
            const catLimits = pricingCfg?.materials?.category_limits || {};
            const limits = catLimits[job.category] || catLimits['_default'] || {};
            const maxClaimPaise = limits.max_material_claim_paise ?? 500000;
            const photoThresholdPaise = limits.photo_required_above_paise ?? 50000;

            let totalPaise = 0;
            for (const item of (items || [])) {
                const amtPaise = Math.round(parseFloat(item.amount || 0) * 100);
                if (amtPaise <= 0) throw Object.assign(new Error(`Item "${item.name}" has zero or invalid amount`), { status: 400 });
                if (amtPaise > photoThresholdPaise && !item.receipt_s3_key)
                    throw Object.assign(new Error(`Receipt photo required for item "${item.name}" above ₹${photoThresholdPaise / 100}`), { status: 400 });
                totalPaise += amtPaise;
            }
            if (totalPaise > maxClaimPaise)
                throw Object.assign(new Error(`Total material claim ₹${totalPaise / 100} exceeds allowed ₹${maxClaimPaise / 100} for ${job.category}`), { status: 400 });

            // Remove any previous materials and reinsert
            await conn.query('DELETE FROM job_materials WHERE job_id=$1', [jobId]);

            let totalRupees = 0;
            for (const item of (items || [])) {
                const amt = parseFloat(item.amount || 0);
                totalRupees += amt;
                await conn.query(
                    `INSERT INTO job_materials (job_id, name, amount, receipt_url, receipt_s3_key, status)
                     VALUES ($1, $2, $3, $4, $5, 'accepted')`,
                    [jobId, item.name, amt, item.receipt_url || null, item.receipt_s3_key || null]
                );
            }

            await conn.query(
                `UPDATE jobs SET materials_declared=TRUE, materials_cost=$1,
                 final_material_paise=$2 WHERE id=$3`,
                [totalRupees, totalPaise, jobId]
            );
            await conn.commit();
            console.log(`[BillingService] Materials declared for Job ${jobId}: ₹${totalRupees} (${totalPaise} paise)`);
            return { declared: true, materials_cost: totalRupees, materials_paise: totalPaise };
        } catch (err) {
            console.error(`[BillingService] declareMaterials error for Job ${jobId}:`, err.message);
            await conn.rollback(); throw err;
        } finally { conn.release(); }
    }

    // ═══════════════════════════════════════════════════════
    // BILL PREVIEW (10-min customer inspection window)
    // ═══════════════════════════════════════════════════════

    async generateBillPreview(jobId) {
        const pool = getPool();
        const [jobs] = await pool.query(
            `SELECT j.*,
             COALESCE(json_agg(
               json_build_object(
                 'id', jm.id, 'name', jm.name, 'amount', jm.amount,
                 'receipt_url', jm.receipt_url, 'receipt_s3_key', jm.receipt_s3_key,
                 'status', jm.status
               )
             ) FILTER (WHERE jm.id IS NOT NULL), '[]') AS materials_list
             FROM jobs j
             LEFT JOIN job_materials jm ON jm.job_id = j.id
             WHERE j.id=$1
             GROUP BY j.id`,
            [jobId]
        );
        const job = jobs[0];
        if (!job) throw Object.assign(new Error('Job not found'), { status: 404 });

        const bill = await this.calculateJobBill(jobId);
        const previewExpiry = new Date(Date.now() + 10 * 60 * 1000);
        const materialsList = job.materials_list || [];
        const materialsCostRupees = parseFloat(job.materials_cost || 0);
        const materialsPaise = Math.round(materialsCostRupees * 100);
        const laborPaise = Math.round(bill.totalAmount * 100);
        const grandTotalPaise = laborPaise + materialsPaise;
        const settlement = this.computeSettlement(laborPaise, materialsPaise);

        await pool.query(
            'UPDATE jobs SET bill_preview_expires_at=$1, final_labor_paise=$2, grand_total_paise=$3 WHERE id=$4',
            [previewExpiry.toISOString(), laborPaise, grandTotalPaise, jobId]
        );

        return {
            job_id: jobId,
            billed_minutes: bill.billedMinutes,
            hourly_rate: parseFloat(job.hourly_rate || 0),
            inspection_fee: parseFloat(job.inspection_fee || 0),
            inspection_fee_paise: Math.round(parseFloat(job.inspection_fee || 0) * 100),
            travel_charge: parseFloat(job.travel_charge || 0),
            travel_charge_paise: Math.round(parseFloat(job.travel_charge || 0) * 100),
            labor_paise: laborPaise,
            materials_paise: materialsPaise,
            materials: materialsList,
            grand_total_paise: grandTotalPaise,
            settlement,
            preview_expires_at: previewExpiry,
        };
    }

    /**
     * Pure settlement formula — no DB side effects.
     * Returns all four figures plus a verification boolean.
     * Materials are 100% pass-through — no fees apply to them.
     */
    computeSettlement(laborPaise, materialPaise) {
        const grandTotalPaise = laborPaise + materialPaise;
        const workerLaborShare = Math.floor(laborPaise * 0.70);
        const platformShare = Math.floor(laborPaise * 0.25);
        const gatewayFee = Math.floor(grandTotalPaise * 0.02);
        // GST = remainder — eliminates any rounding error
        const gst = grandTotalPaise - (workerLaborShare + materialPaise) - platformShare - gatewayFee;
        const workerTotal = workerLaborShare + materialPaise;
        const checkSum = workerTotal + platformShare + gatewayFee + gst;
        const balanced = checkSum === grandTotalPaise;
        return { workerTotal, platformShare, gatewayFee, gst, grandTotalPaise, laborPaise, materialPaise, balanced, checkSum };
    }

    /**
     * Compute labor from timer event log in paise.
     */
    async computeLaborFromEvents(jobId) {
        const bill = await this.calculateJobBill(jobId);
        return {
            billedMinutes: bill.billedMinutes,
            actualMinutes: bill.actualElapsedMinutes,
            laborPaise: Math.round(bill.totalAmount * 100),
        };
    }

    /**
     * Sum accepted material line items in paise.
     */
    async computeMaterialTotal(jobId) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT COALESCE(SUM(ROUND(amount * 100)), 0)::BIGINT AS total_paise,
                    COUNT(*) AS item_count
             FROM job_materials WHERE job_id=$1 AND status != 'flagged'`,
            [jobId]
        );
        return {
            materialPaise: Number(rows[0]?.total_paise ?? 0),
            itemCount: Number(rows[0]?.item_count ?? 0),
        };
    }

}

export default new BillingService();
