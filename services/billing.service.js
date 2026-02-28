import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import bcrypt from 'bcrypt';
import { updateJobNode } from './firebase.service.js';
import * as PricingService from './pricing.service.js';

class BillingService {

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

        return {
            actualElapsedMinutes: bill.actual_minutes,
            billedMinutes: bill.billed_minutes,
            exceededEstimate: bill.cap_applied,
            jobAmount: bill.billed_amount,
            inspectionFee: parseFloat(job.inspection_fee || 0),
            travelCharge: parseFloat(job.travel_charge || 0),
            totalAmount: bill.billed_amount + parseFloat(job.inspection_fee || 0) + parseFloat(job.travel_charge || 0)
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

            const match = await bcrypt.compare(String(otpInput), job.inspection_otp_hash);
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
                     issue_notes = $2
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
            const [jobs] = await conn.query('SELECT status, customer_id, start_otp_hash, worker_id FROM jobs WHERE id = $1 FOR UPDATE', [jobId]);
            const job = jobs[0];

            if (!job || job.customer_id !== customerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
            if (job.status !== 'estimate_submitted') throw Object.assign(new Error('Estimate must be submitted first'), { status: 400 });

            const match = await bcrypt.compare(String(otpInput), job.start_otp_hash);
            if (!match) throw Object.assign(new Error('Invalid Start Code'), { status: 400 });

            await conn.query(
                `UPDATE jobs 
                 SET status = 'in_progress', 
                     job_started_at = NOW() 
                 WHERE id = $1`,
                [jobId]
            );

            await this._recordTimerEvent(conn, jobId, 'job_start', 'worker', 'Customer approved estimate & started job');

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

    async stopJobAndBill(jobId, triggeredByRole, connProvided = null) {
        const _conn = connProvided || await getPool().getConnection();
        const doTransaction = !connProvided;

        if (doTransaction) await _conn.beginTransaction();

        try {
            await this._recordTimerEvent(_conn, jobId, 'job_end', triggeredByRole);

            const bill = await this.calculateJobBill(jobId, _conn);

            await _conn.query(
                `UPDATE jobs 
                 SET status = 'pending_completion',
                     job_ended_at = NOW(),
                     final_billed_minutes = $1,
                     final_amount = $2,
                     exceeded_estimate = $3
                 WHERE id = $4`,
                [bill.billedMinutes, bill.totalAmount, bill.exceededEstimate, jobId]
            );

            if (doTransaction) await _conn.commit();

            await updateJobNode(jobId, { status: 'pending_completion', final_cost: bill.totalAmount });

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

            const match = await bcrypt.compare(String(otpInput), ext.otp_hash);
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

}

export default new BillingService();
