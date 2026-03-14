/**
 * src/routes/worker.js
 * 
 * Worker-facing job endpoints
 */

import express from 'express';
import { getPool, handle } from '../lib/db.js';
import { getRedisClient } from '../lib/redis.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

const router = express.Router();

/**
 * Worker dashboard statistics
 * GET /api/worker/stats
 */
router.get('/stats', handle(async (userId, pool) => {
    // Note: We use the server's timezone (Asia/Kolkata) as configured in Postgres
    const statsQuery = `
        SELECT 
            COALESCE(SUM(final_amount), 0)::NUMERIC AS earnings_today,
            COUNT(*) FILTER (WHERE job_ended_at >= CURRENT_DATE) AS today,
            COUNT(*) FILTER (WHERE job_ended_at >= NOW() - INTERVAL '7 days') AS week
        FROM jobs 
        WHERE worker_id = $1 AND status = 'completed'
    `;
    const [rows] = await pool.query(statsQuery, [userId]);
    const row = rows[0];

    return { 
        stats: {
            earnings_today: parseFloat(row?.earnings_today || 0),
            today: parseInt(row?.today || 0, 10),
            week: parseInt(row?.week || 0, 10)
        }
    };
}));

/**
 * Worker fetches active job details
 * Includes the END OTP if status is pending_completion, so the worker can show it to the customer.
 */
router.get('/jobs/:id', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;
        const [jobs] = await pool.query(`SELECT j.id, j.status, j.category, j.address, j.description, j.total_amount as amount,
                    j.arrived_at, j.worker_id, j.customer_id, j.inspection_expires_at,
                    j.inspection_started_at, j.job_started_at, j.job_ended_at,
                    j.work_started_at, j.work_ended_at,
                    -- Include inspection extension fields so worker UI can lock/unlock request button correctly after refresh.
                    j.inspection_extension_otp_hash, j.inspection_extension_count, j.inspection_extended_until,
                    c.name as customer_name, 
                    CASE WHEN j.worker_id = $2 THEN u.phone ELSE NULL END as customer_phone
             FROM jobs j
             LEFT JOIN customer_profiles c ON j.customer_id = c.user_id
             LEFT JOIN users u ON j.customer_id = u.id
             WHERE j.id = $1 AND (j.worker_id = $2 OR j.status IN ('open', 'searching'))`, [jobId, userId]
        );
        const job = jobs[0];
        if (!job) throw Object.assign(new Error('Job not found or not accessible at this time'), { status: 404 });

        // If job is in pending_completion, fetch the END OTP from Redis to show to the customer
        if (job.status === 'pending_completion') {
            const redisClient = getRedisClient();
            let endOtp = await redisClient.get(`zarva:otp:end:${jobId}`);
            
            console.log(`[Worker] Redis lookup for job ${jobId}: ${endOtp ? 'found OTP' : 'OTP not found'}`);
            
            // Check if materials were added after OTP generation - regenerate if needed
            const [materialsCheck] = await pool.query(`
                SELECT COALESCE(SUM(ROUND(amount * 100)), 0)::BIGINT as total_paise
                FROM job_materials 
                WHERE job_id = $1 AND status != 'flagged'
            `, [jobId]);
            
            const currentMaterialsPaise = Number(materialsCheck[0]?.total_paise || 0);
            const declaredMaterialsPaise = Math.round((job.materials_cost || 0) * 100);
            
            // If materials changed or OTP expired, regenerate OTP
            if (!endOtp || currentMaterialsPaise !== declaredMaterialsPaise) {
                if (currentMaterialsPaise !== declaredMaterialsPaise) {
                    console.log(`[Worker] Materials amount changed for job ${jobId}: was ${declaredMaterialsPaise}, now ${currentMaterialsPaise}. Regenerating OTP...`);
                }
                
                endOtp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
                
                // Store in Redis with extended TTL (30 minutes from now)
                await redisClient.set(`zarva:otp:end:${jobId}`, endOtp, 'EX', 1800);
                console.log(`[Worker] Regenerated OTP for job ${jobId}: ${endOtp}`);
            }
            
            job.end_otp = endOtp;
        }

        return { job };
    })
);

/**
 * Worker marks job as completed and generates END OTP for customer verification
 * POST /api/worker/jobs/:id/complete
 */
router.post('/jobs/:id/complete', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;

        // Fetch job and verify ownership with materials and final amounts
        const [jobs] = await pool.query(`
            SELECT j.id, j.status, j.worker_id, j.final_labor_paise, j.final_material_paise, j.grand_total_paise,
                   j.materials_declared, j.materials_cost, j.final_amount
            FROM jobs j 
            WHERE j.id = $1 AND j.worker_id = $2
        `, [jobId, userId]);
        const job = jobs[0];
        if (!job) throw Object.assign(new Error('Job not found or not accessible'), { status: 404 });

        // Check if materials were declared after job completion - this indicates double ledger risk
        if (job.status === 'pending_completion') {
            const redisClient = getRedisClient();
            const existingOtp = await redisClient.get(`zarva:otp:end:${jobId}`);
            
            // Check if materials were added after initial completion
            const [materialsCheck] = await pool.query(`
                SELECT COUNT(*) as count, COALESCE(SUM(ROUND(amount * 100)), 0)::BIGINT as total_paise
                FROM job_materials 
                WHERE job_id = $1 AND status != 'flagged'
            `, [jobId]);
            
            const currentMaterialsPaise = Number(materialsCheck[0]?.total_paise || 0);
            const declaredMaterialsPaise = Math.round((job.materials_cost || 0) * 100);
            
            // If materials amount changed after completion, regenerate OTP with new amounts
            if (currentMaterialsPaise !== declaredMaterialsPaise) {
                console.log(`[Worker] Materials amount changed for job ${jobId}: was ${declaredMaterialsPaise}, now ${currentMaterialsPaise}. Regenerating OTP...`);
                
                // Generate new OTP with updated amounts
                const otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
                const hash = await bcrypt.hash(otp, 10);
                
                // Update job with new final amounts
                const newFinalAmount = (job.final_labor_paise || 0) + currentMaterialsPaise;
                await pool.query(`
                    UPDATE jobs 
                    SET end_otp_hash = $1, 
                        final_material_paise = $2,
                        grand_total_paise = $3,
                        final_amount = $4,
                        materials_cost = $5,
                        materials_declared = true,
                        work_ended_at = COALESCE(work_ended_at, NOW())
                    WHERE id = $6
                `, [hash, currentMaterialsPaise, newFinalAmount, newFinalAmount / 100, currentMaterialsPaise / 100, jobId]);
                
                // Store new OTP in Redis
                await redisClient.set(`zarva:otp:end:${jobId}`, otp, 'EX', 10800);
                console.log(`[Worker] Regenerated OTP for job ${jobId} with updated amounts: ${otp}`);
                
                const { updateJobNode } = await import('../services/firebaseSync.js');
                await updateJobNode(jobId, { status: 'pending_completion', timer_status: 'stopped' });
                
                return { end_otp: otp, amount_updated: true, new_final_amount: newFinalAmount / 100 };
            }
            
            if (existingOtp) {
                console.log(`[Worker] Found existing OTP for job ${jobId}: ${existingOtp}`);
                return { end_otp: existingOtp };
            }
            console.log(`[Worker] No existing OTP found for job ${jobId}, regenerating...`);
        } else if (job.status !== 'in_progress') {
            throw Object.assign(new Error('Invalid job state'), { status: 400 });
        }

        // Generate OTP and lock in final amounts to prevent double ledger issues
        const otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
        const hash = await bcrypt.hash(otp, 10);

        // Get current material totals to lock in final amounts
        const [materialsFinal] = await pool.query(`
            SELECT COALESCE(SUM(ROUND(amount * 100)), 0)::BIGINT as total_paise,
                   COALESCE(SUM(amount), 0) as total_rupees
            FROM job_materials 
            WHERE job_id = $1 AND status != 'flagged'
        `, [jobId]);
        
        const materialsPaise = Number(materialsFinal[0]?.total_paise || 0);
        const materialsRupees = parseFloat(materialsFinal[0]?.total_rupees || 0);

        // Lock in final amounts to prevent double ledger issues
        await pool.query(`
            UPDATE jobs 
            SET end_otp_hash = $1, 
                status = 'pending_completion', 
                final_material_paise = $2,
                grand_total_paise = COALESCE(final_labor_paise, 0) + $2,
                final_amount = (COALESCE(final_labor_paise, 0) + $2) / 100,
                materials_cost = $3,
                materials_declared = true,
                work_ended_at = COALESCE(work_ended_at, NOW())
            WHERE id = $4
        `, [hash, materialsPaise, materialsRupees, jobId]);

        // Redis Storage (Relayed to Worker to SHOW Customer) 180m TTL (10800s)
        const redisClient = getRedisClient();
        await redisClient.set(`zarva:otp:end:${jobId}`, otp, 'EX', 10800);
        console.log(`[Worker] Generated new OTP for job ${jobId}: ${otp}, Final amounts: labor=${job.final_labor_paise}, materials=${materialsPaise}, total=${(job.final_labor_paise || 0) + materialsPaise}`);

        const { updateJobNode } = await import('../services/firebaseSync.js');
        await updateJobNode(jobId, { status: 'pending_completion', timer_status: 'stopped' });

        return { end_otp: otp, final_materials: materialsRupees, final_total: ((job.final_labor_paise || 0) + materialsPaise) / 100 };
    })
);

/**
 * Worker marks as arrived at job location and generates START OTP for customer verification
 * POST /api/worker/jobs/:id/arrived
 */
router.post('/jobs/:id/arrived', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;

        // Fetch job and verify ownership
        const [jobs] = await pool.query('SELECT id, status, worker_id FROM jobs WHERE id = $1 AND worker_id = $2', [jobId, userId]);
        const job = jobs[0];
        if (!job) throw Object.assign(new Error('Job not found or not accessible'), { status: 404 });

        if (job.status !== 'worker_en_route') {
            throw Object.assign(new Error('Invalid job state for arrival'), { status: 400 });
        }

        const otp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
        const hash = await bcrypt.hash(otp, 10);

        await pool.query(`
            UPDATE jobs 
            SET start_otp_hash = $1, 
                status = 'worker_arrived',
                arrived_at = NOW()
            WHERE id = $2
        `, [hash, jobId]);

        // Store OTP in Redis for customer verification (3 hours TTL)
        const redisClient = getRedisClient();
        await redisClient.set(`zarva:otp:start:${jobId}`, otp, 'EX', 10800);
        console.log(`[Worker] Generated start OTP for job ${jobId}: ${otp}`);

        const { updateJobNode } = await import('../services/firebaseSync.js');
        await updateJobNode(jobId, { status: 'worker_arrived', arrived_at: new Date().toISOString() });

        return { arrived: true };
    })
);

/**
 * Worker verifies customer's start OTP to begin work
 * POST /api/worker/jobs/:id/verify-start-otp
 */
router.post('/jobs/:id/verify-start-otp', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;
        const { otp } = req.body;

        if (!otp || !/^[0-9]{4}$/.test(otp)) {
            throw Object.assign(new Error('Invalid OTP format'), { status: 400 });
        }

        // Fetch job and verify ownership
        const [jobs] = await pool.query('SELECT id, status, worker_id, start_otp_hash, start_otp_attempts FROM jobs WHERE id = $1 AND worker_id = $2', [jobId, userId]);
        const job = jobs[0];
        if (!job) throw Object.assign(new Error('Job not found or not accessible'), { status: 404 });

        if (job.status !== 'worker_arrived') {
            throw Object.assign(new Error('Invalid job state for start verification'), { status: 400 });
        }

        // Verify OTP
        const isValid = await bcrypt.compare(otp, job.start_otp_hash);
        if (!isValid) {
            // Increment attempt counter
            const newAttempts = (job.start_otp_attempts || 0) + 1;
            await pool.query('UPDATE jobs SET start_otp_attempts = $1 WHERE id = $2', [newAttempts, jobId]);
            
            // After 5 failed attempts, escalate to disputed
            if (newAttempts >= 5) {
                await pool.query('UPDATE jobs SET status = $1 WHERE id = $2', ['disputed', jobId]);
                const { updateJobNode } = await import('../services/firebaseSync.js');
                await updateJobNode(jobId, { status: 'disputed' });
                throw Object.assign(new Error('Maximum OTP attempts exceeded - job disputed'), { status: 403 });
            }
            
            throw Object.assign(new Error('Invalid OTP'), { status: 400 });
        }

        // OTP verified successfully - start the job
        await pool.query(`
            UPDATE jobs 
            SET status = 'in_progress',
                work_started_at = NOW(),
                start_otp_attempts = 0
            WHERE id = $1
        `, [jobId]);

        // Clean up Redis OTP
        const redisClient = getRedisClient();
        await redisClient.del(`zarva:otp:start:${jobId}`);

        const { updateJobNode } = await import('../services/firebaseSync.js');
        await updateJobNode(jobId, { 
            status: 'in_progress',
            timer_status: 'running',
            work_started_at: new Date().toISOString()
        });

        return { success: true };
    })
);

export default router;