/**
 * src/routes/jobs.js
 * 
 * Customer-facing job endpoints
 */

import express from 'express';
import { getPool, handle, fail } from '../lib/db.js';
import { getRedisClient } from '../lib/redis.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import configLoader from '../config/loader.js';

const router = express.Router();

// ─── GET /api/jobs/config ──────────────────────────────────────────────────
// Returns categories and global pricing for the Home Screen
router.get('/config', (req, res) => {
    try {
        const jobsConfig = configLoader.get('jobs');
        return res.status(200).json({ status: 'ok', ...jobsConfig });
    } catch (err) {
        console.error('[Jobs] GET /config error:', err);
        return fail(res, 'Failed to load configuration', 500, 'CONFIG_ERROR');
    }
});

// ─── POST /api/jobs/estimate ──────────────────────────────────────────────
// Returns price estimate for a category
router.post('/estimate', async (req, res) => {
    try {
        const { category, hours, is_emergency, scheduled_at } = req.body;
        if (!category) return fail(res, 'Category is required', 400);

        const jobsConfig = configLoader.get('jobs');
        const { generateEstimate } = await import('../utils/pricingEngine.js');
        
        const estimate = generateEstimate({
            category,
            hours,
            isEmergency: is_emergency,
            scheduledAt: scheduled_at
        }, jobsConfig);

        return res.status(200).json({ status: 'ok', ...estimate });
    } catch (err) {
        console.error('[Jobs] POST /estimate error:', err);
        return fail(res, 'Failed to generate estimate', 500);
    }
});

// ─── GET /api/jobs/:id ─────────────────────────────────────────────────────
// Get single job (customer view)
router.get('/:id', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    try {
        const jobId = req.params.id;
        if (!jobId || isNaN(parseInt(jobId, 10))) {
            return fail(res, 'Invalid Job ID', 400, 'INVALID_ID');
        }

        const pool = getPool();
        const [jobsWithWorkers] = await pool.query(`
            SELECT 
                j.*,
                COALESCE(wp.name, 'Worker') as worker_name,
                wp.category as worker_category,
                wp.average_rating as worker_rating,
                wp.profile_s3_key as worker_photo,
                wp.total_jobs as worker_jobs,
                wp.last_location_lat as worker_lat,
                wp.last_location_lng as worker_lng,
                j.inspection_expires_at,
                (wp.kyc_status = 'approved') as worker_verified,
                (SELECT COUNT(*)::INT FROM reviews r WHERE r.job_id = j.id AND r.reviewer_role = 'customer') as is_reviewed,
                (SELECT json_build_object('score', score, 'category_scores', category_scores, 'comment', comment) FROM reviews r WHERE r.job_id = j.id AND r.reviewer_role = 'customer' LIMIT 1) as review_details
            FROM jobs j
            LEFT JOIN worker_profiles wp ON j.worker_id = wp.user_id
            WHERE j.id = $1
        `, [jobId]);

        const job = jobsWithWorkers[0];

        // Use loose comparison (==) because req.user.id might be string while job.customer_id is integer
        if (!job || job.customer_id != userId) {
            console.warn(`[Jobs] Job ${req.params.id} not found or mismatch: C:${job?.customer_id} vs U:${userId}`);
            return fail(res, 'Not found', 404, 'NOT_FOUND');
        }

        // If job is in pending_completion, fetch the END OTP from Redis to show to the customer
        if (job.status === 'pending_completion') {
            console.log(`[Customer] Job ${jobId} is pending_completion, fetching end OTP...`);
            const redisClient = getRedisClient();
            let endOtp = await redisClient.get(`zarva:otp:end:${jobId}`);
            
            console.log(`[Customer] Redis lookup result: ${endOtp ? 'found OTP' : 'OTP not found'}`);
            
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
                    console.log(`[Customer] Materials amount changed for job ${jobId}: was ${declaredMaterialsPaise}, now ${currentMaterialsPaise}. Regenerating OTP...`);
                }
                
                endOtp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
                
                // Store in Redis with extended TTL (30 minutes from now)
                await redisClient.set(`zarva:otp:end:${jobId}`, endOtp, 'EX', 1800);
                console.log(`[Customer] Regenerated OTP for job ${jobId}: ${endOtp}`);
            }
            
            job.end_otp = endOtp;
            console.log(`[Customer] Final end_otp for job ${jobId}: ${job.end_otp}`);
        }

        // Strip sensitive hashes from response
        delete job.start_otp_hash;
        delete job.end_otp_hash;
        delete job.inspection_otp_hash;

        // Build worker sub-object if a worker is assigned
        if (job.worker_id) {
            const bucket = process.env.AWS_BUCKET_NAME;
            const region = process.env.AWS_REGION;
            const w_name = job.worker_name || 'Worker';
            const photoUrl = job.worker_photo
                ? `https://${bucket}.s3.${region}.amazonaws.com/${job.worker_photo}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(w_name)}&background=random`;

            job.worker = {
                id: job.worker_id,
                name: w_name,
                category: job.worker_category || 'Service',
                rating: job.worker_rating,
                photo: photoUrl,
                completed_jobs: job.worker_jobs || 0,
                lat: job.worker_lat,
                lng: job.worker_lng,
                is_verified: !!job.worker_verified
            };
        }

        // Build review sub-object
        job.is_reviewed = !!job.is_reviewed;
        if (job.review_details && typeof job.review_details === 'string') {
            try { job.review = JSON.parse(job.review_details); }
            catch (e) { job.review = job.review_details; }
        } else {
            job.review = job.review_details || null;
        }

        // Remove flattened fields
        delete job.review_details;
        delete job.rating_given;
        delete job.worker_name;
        delete job.worker_rating;
        delete job.worker_photo;
        delete job.worker_jobs;
        delete job.worker_lat;
        delete job.worker_lng;
        delete job.worker_verified;

        return { job };
    } catch (err) {
        console.error('[Jobs] GET /:id error:', err);
        return fail(res, 'Internal error', 500, 'INTERNAL_ERROR');
    }
});

// ─── POST /api/jobs ──────────────────────────────────────────────────────────
// Create new job (customer)
router.post('/', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    try {
        const {
            category,
            description,
            scheduled_at,
            latitude,
            longitude,
            address,
            pincode,
            city,
            district,
            inspection_required
        } = req.body;

        if (!category || !latitude || !longitude || !address || !pincode || !city) {
            return fail(res, 'Missing required fields', 400, 'MISSING_FIELDS');
        }

        const pool = getPool();
        
        // Generate start OTP for job
        const startOtp = crypto.randomInt(1000, 9999).toString().padStart(4, '0');
        const startOtpHash = await bcrypt.hash(startOtp, 10);

        const jobId = await pool.query(`
            INSERT INTO jobs (
                customer_id, category, description, scheduled_at,
                latitude, longitude, address, pincode, city, district,
                start_otp_hash, status, inspection_required, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'created', $12, NOW(), NOW())
            RETURNING id
        `, [
            userId, category, JSON.stringify(description), scheduled_at,
            latitude, longitude, address, pincode, city, district,
            startOtpHash, inspection_required
        ]).then(r => r.rows[0].id);

        // Store start OTP in Redis for worker verification
        const redisClient = getRedisClient();
        await redisClient.set(`zarva:otp:start:${jobId}`, startOtp, 'EX', 10800); // 3 hours

        // Notify matching engine
        const { default: MatchingEngine } = await import('../services/matchingEngine.js');
        await MatchingEngine.notifyNewJob(jobId);

        return { job_id: jobId, start_otp: startOtp };
    } catch (err) {
        console.error('[Jobs] POST / error:', err);
        return fail(res, 'Internal error', 500, 'INTERNAL_ERROR');
    }
});

// ─── POST /api/jobs/:id/verify-start ────────────────────────────────────────
// Customer verifies worker's start OTP
router.post('/:id/verify-start', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    try {
        const jobId = req.params.id;
        const { otp } = req.body;

        if (!otp || !/^[0-9]{4}$/.test(otp)) {
            return fail(res, 'Invalid OTP format', 400, 'INVALID_OTP');
        }

        const pool = getPool();
        
        // Get job and verify ownership
        const [jobs] = await pool.query('SELECT * FROM jobs WHERE id = $1 AND customer_id = $2', [jobId, userId]);
        if (!jobs.length) {
            return fail(res, 'Job not found', 404, 'NOT_FOUND');
        }

        const job = jobs[0];
        if (job.status !== 'worker_arrived') {
            return fail(res, 'Invalid job state for start verification', 400, 'INVALID_STATE');
        }

        // Verify OTP
        const isValid = await bcrypt.compare(otp, job.start_otp_hash);
        if (!isValid) {
            await pool.query('UPDATE jobs SET start_otp_attempts = start_otp_attempts + 1 WHERE id = $1', [jobId]);
            return fail(res, 'Invalid OTP', 400, 'INVALID_OTP');
        }

        // Update job status
        await pool.query(`
            UPDATE jobs 
            SET status = 'in_progress', 
                job_started_at = NOW(),
                start_otp_verified_at = NOW()
            WHERE id = $1
        `, [jobId]);

        // Update Firebase
        const { updateJobNode } = await import('../services/firebaseSync.js');
        await updateJobNode(jobId, { 
            status: 'in_progress',
            timer_status: 'running',
            job_started_at: new Date().toISOString()
        });

        return { success: true };
    } catch (err) {
        console.error('[Jobs] POST /:id/verify-start error:', err);
        return fail(res, 'Internal error', 500, 'INTERNAL_ERROR');
    }
});

// ─── POST /api/jobs/:id/verify-end ──────────────────────────────────────────
// Customer verifies worker's end OTP (completion)
router.post('/:id/verify-end', async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 'Authentication required', 401, 'UNAUTHORIZED');

    try {
        const jobId = req.params.id;
        const { otp } = req.body;

        if (!otp || !/^[0-9]{4}$/.test(otp)) {
            return fail(res, 'Invalid OTP format', 400, 'INVALID_OTP');
        }

        const pool = getPool();
        
        // Get job and verify ownership with final amounts
        const [jobs] = await pool.query(`
            SELECT j.*, 
                   COALESCE(SUM(CASE WHEN jm.status != 'flagged' THEN ROUND(jm.amount * 100) ELSE 0 END), 0)::BIGINT as current_materials_paise,
                   COUNT(CASE WHEN jm.status != 'flagged' THEN 1 END) as material_items
            FROM jobs j
            LEFT JOIN job_materials jm ON jm.job_id = j.id
            WHERE j.id = $1 AND j.customer_id = $2
            GROUP BY j.id
        `, [jobId, userId]);
        
        if (!jobs.length) {
            return fail(res, 'Job not found', 404, 'NOT_FOUND');
        }

        const job = jobs[0];
        if (job.status !== 'pending_completion') {
            return fail(res, 'Invalid job state for completion verification', 400, 'INVALID_STATE');
        }

        // Verify OTP
        const isValid = await bcrypt.compare(otp, job.end_otp_hash);
        if (!isValid) {
            await pool.query('UPDATE jobs SET end_otp_attempts = end_otp_attempts + 1 WHERE id = $1', [jobId]);
            return fail(res, 'Invalid OTP', 400, 'INVALID_OTP');
        }

        // Double-check final amounts match to prevent ledger issues
        const expectedTotal = (job.final_labor_paise || 0) + (job.current_materials_paise || 0);
        const declaredTotal = job.grand_total_paise || 0;
        
        if (expectedTotal !== declaredTotal && job.current_materials_paise > 0) {
            console.warn(`[Customer] Amount mismatch for job ${jobId}: expected ${expectedTotal}, declared ${declaredTotal}. Updating final amounts...`);
            
            // Update final amounts to match actual materials
            await pool.query(`
                UPDATE jobs 
                SET final_material_paise = $1,
                    grand_total_paise = $2,
                    final_amount = $2 / 100,
                    materials_cost = $1 / 100
                WHERE id = $3
            `, [job.current_materials_paise, expectedTotal, jobId]);
        }

        // Update job status and finalize billing
        await pool.query(`
            UPDATE jobs 
            SET status = 'completed', 
                job_ended_at = NOW(),
                end_otp_verified_at = NOW()
            WHERE id = $1
        `, [jobId]);

        // Finalize billing with corrected amounts
        const { default: BillingService } = await import('../services/billing.service.js');
        await BillingService.finalizeJob(jobId);

        // Update Firebase
        const { updateJobNode } = await import('../services/firebaseSync.js');
        await updateJobNode(jobId, { 
            status: 'completed',
            timer_status: 'stopped',
            job_ended_at: new Date().toISOString(),
            end_otp_verified_at: new Date().toISOString()
        });

        return { success: true, final_amount: expectedTotal / 100 };
    } catch (err) {
        console.error('[Jobs] POST /:id/verify-end error:', err);
        return fail(res, 'Internal error', 500, 'INTERNAL_ERROR');
    }
});

export default router;