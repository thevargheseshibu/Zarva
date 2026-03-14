/**
 * src/routes/worker.js
 * 
 * Worker-facing job endpoints
 */

import express from 'express';
import { getPool, handle, fail } from '../lib/db.js';
import { getRedisClient } from '../lib/redis.js';
import configLoader from '../config/loader.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { calculateTravelCharge } from '../utils/pricingEngine.js';

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
        if (!/^\d+$/.test(jobId)) {
            throw Object.assign(new Error('Invalid Job ID format'), { status: 400 });
        }
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
 * Worker accepts a pending job
 * POST /api/worker/jobs/:id/accept
 */
router.post('/jobs/:id/accept', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;
        if (!/^\d+$/.test(jobId)) {
            throw Object.assign(new Error('Invalid Job ID format'), { status: 400 });
        }

        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            // 1. Lock and verify job
            const [jobs] = await conn.query(
                'SELECT id, status, category, job_location, rate_per_hour, advance_amount FROM jobs WHERE id = $1 FOR UPDATE',
                [jobId]
            );
            const job = jobs[0];

            if (!job) throw Object.assign(new Error('Job not found'), { status: 404 });
            if (job.status !== 'open' && job.status !== 'searching') {
                throw Object.assign(new Error('Job is no longer available'), { status: 409 });
            }

            // 2. Check worker's current status
            const [profiles] = await conn.query(
                'SELECT current_job_id, last_location_lat, last_location_lng FROM worker_profiles WHERE user_id = $1 FOR UPDATE',
                [userId]
            );
            const wp = profiles[0];
            if (!wp) throw Object.assign(new Error('Worker profile not found'), { status: 404 });
            if (wp.current_job_id) {
                // If the worker has an active job, verify it's not THIS job already accepted (idempotency)
                if (parseInt(wp.current_job_id) === parseInt(jobId)) {
                    await conn.rollback();
                    return { success: true, already_accepted: true };
                }
                throw Object.assign(new Error('You already have an active job'), { status: 400 });
            }

            // 3. Calculate travel charge based on latest known location
            let travelCharge = 0;
            let distanceKm = 0;
            if (wp.last_location_lat && wp.last_location_lng) {
                const [distRows] = await conn.query(`
                    SELECT ST_Distance(
                        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
                        $3::geography
                    ) / 1000 as distance_km
                `, [wp.last_location_lng, wp.last_location_lat, job.job_location]);
                distanceKm = distRows[0]?.distance_km || 0;

                const jobsCfg = configLoader.get('jobs');
                if (jobsCfg.global_pricing?.travel) {
                    travelCharge = calculateTravelCharge(
                        distanceKm,
                        jobsCfg.global_pricing.travel.free_km_radius || 0,
                        jobsCfg.global_pricing.travel.petrol_rate_per_km || 0,
                        jobsCfg.global_pricing.travel.min_travel_charge,
                        jobsCfg.global_pricing.travel.max_travel_charge
                    );
                }
            }

            // 4. Update Job status
            await conn.query(`
                UPDATE jobs 
                SET worker_id = $1, 
                    status = 'worker_en_route',
                    accepted_at = NOW(),
                    travel_charge = $2
                WHERE id = $3
            `, [userId, travelCharge, jobId]);

            // 5. Update Worker Profile
            await conn.query(`
                UPDATE worker_profiles 
                SET current_job_id = $1 
                WHERE user_id = $2
            `, [jobId, userId]);

            await conn.commit();

            // 6. Firebase Sync for real-time customer updates
            try {
                const { updateJobNode } = await import('../services/firebaseSync.js');
                await updateJobNode(jobId, { 
                    status: 'worker_en_route', 
                    worker_id: userId,
                    accepted_at: new Date().toISOString()
                });
            } catch (fbErr) {
                console.warn('[Worker Accept] Firebase sync failed:', fbErr.message);
            }

            return { success: true, status: 'worker_en_route' };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    })
);

/**
 * Worker marks job as completed and generates END OTP for customer verification
 * POST /api/worker/jobs/:id/complete
 */
router.post('/jobs/:id/complete', (req, res) =>
    handle(req, res, async (userId, pool) => {
        const jobId = req.params.id;
        if (!/^\d+$/.test(jobId)) {
            throw Object.assign(new Error('Invalid Job ID format'), { status: 400 });
        }

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
        if (!/^\d+$/.test(jobId)) {
            throw Object.assign(new Error('Invalid Job ID format'), { status: 400 });
        }

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
        if (!/^\d+$/.test(jobId)) {
            throw Object.assign(new Error('Invalid Job ID format'), { status: 400 });
        }
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

/**
 * Get available skills/categories
 * GET /api/worker/skills
 */
router.get('/skills', handle(async (userId, pool) => {
    const [rows] = await pool.query('SELECT skills FROM worker_profiles WHERE user_id = $1', [userId]);
    const skills = rows[0]?.skills || [];
    console.log(`[Worker] Fetched skills for user ${userId}:`, skills);
    return { skills };
}));

/**
 * Update worker skills
 * POST /api/worker/onboarding/skills
 */
router.post('/onboarding/skills', handle(async (userId, pool, req) => {
    const { skills } = req.body;
    console.log(`[Worker] Updating skills for user ${userId}:`, skills);

    if (!Array.isArray(skills)) {
        console.error(`[Worker] Skills update failed for user ${userId}: skills is not an array`, skills);
        throw Object.assign(new Error('Skills must be an array'), { status: 400 });
    }

    try {
        await pool.query(`
            UPDATE worker_profiles 
            SET skills = $1::jsonb,
                updated_at = NOW()
            WHERE user_id = $2
        `, [JSON.stringify(skills), userId]);
        console.log(`[Worker] Successfully updated skills for user ${userId}`);
    } catch (err) {
        console.error(`[Worker] DB Error updating skills for user ${userId}:`, err);
        throw err;
    }

    return { success: true };
}));

/**
 * Get worker's job history
 * GET /api/worker/history
 */
router.get('/history', handle(async (userId, pool) => {
    console.log(`[Worker] Fetching history for userId: ${userId}`);
    
    // Debug: Check total jobs for this worker regardless of status
    const [debugCount] = await pool.query(`SELECT COUNT(*) as count FROM jobs WHERE worker_id = $1`, [userId]);
    console.log(`[Worker] Total jobs in DB for this worker_id: ${debugCount[0].count}`);

    const [rows] = await pool.query(`
        SELECT 
            j.id, j.category, j.status, j.address, 
            COALESCE(j.final_amount, 0) as amount, 
            j.job_ended_at as date,
            cp.name as customer_name
        FROM jobs j
        LEFT JOIN customer_profiles cp ON j.customer_id = cp.user_id
        WHERE j.worker_id = $1 AND j.status IN ('completed', 'cancelled')
        ORDER BY j.updated_at DESC
        LIMIT 50
    `, [userId]);
    console.log(`[Worker] Found ${rows.length} completed/cancelled history items for userId: ${userId}`);
    return { history: rows };
}));

/**
 * Get worker's earnings summary
 * GET /api/worker/earnings
 */
router.get('/earnings', handle(async (userId, pool) => {
    const query = `
        SELECT 
            COALESCE(SUM(final_amount) FILTER (WHERE job_ended_at >= CURRENT_DATE), 0) as today,
            COALESCE(SUM(final_amount) FILTER (WHERE job_ended_at >= date_trunc('week', CURRENT_DATE)), 0) as this_week,
            COALESCE(SUM(final_amount) FILTER (WHERE job_ended_at >= date_trunc('month', CURRENT_DATE)), 0) as this_month,
            COALESCE(SUM(final_amount), 0) as total
        FROM jobs
        WHERE worker_id = $1 AND status = 'completed'
    `;
    const [rows] = await pool.query(query, [userId]);
    return { earnings: rows[0] };
}));

/**
 * Get available jobs matching worker's category and service area
 * GET /api/worker/available-jobs
 */
router.get('/available-jobs', handle(async (userId, pool) => {
    // 1. Get worker's category and service area
    const [profiles] = await pool.query(`
        SELECT category, service_area, is_verified, is_online, current_location
        FROM worker_profiles
        WHERE user_id = $1
    `, [userId]);

    const wp = profiles[0];
    if (!wp) throw Object.assign(new Error('Worker profile not found'), { status: 404 });
    
    console.log(`[Worker] Available Jobs request for userId: ${userId}`);
    console.log(`[Worker] Category: ${wp.category}, Online: ${wp.is_online}, Verified: ${wp.is_verified}`);
    console.log(`[Worker] Has Service Area: ${!!wp.service_area}`);

    if (!wp.is_verified) return { jobs: [], is_online: wp.is_online, is_verified: false, message: 'Account pending verification' };
    if (!wp.is_online) return { jobs: [], is_online: false, is_verified: wp.is_verified, message: 'Go online to see available jobs' };

    // Debug: Check total 'searching' jobs in this category globally
    const [categoryCount] = await pool.query(`SELECT COUNT(*) as count FROM jobs WHERE status = 'searching' AND category = $1`, [wp.category]);
    console.log(`[Worker] Global 'searching' jobs for category ${wp.category}: ${categoryCount[0].count}`);

    // 2. Find jobs that intersect with service area
    const [jobs] = await pool.query(`
        SELECT j.id, j.category, j.address, j.description, j.latitude, j.longitude, j.created_at,
               ST_Distance(j.job_location, wp.current_location) / 1000 as distance_km
        FROM jobs j
        JOIN worker_profiles wp ON wp.user_id = $1
        WHERE j.status = 'searching' 
          AND j.category = $2
          AND ST_Intersects(j.job_location, wp.service_area)
        ORDER BY j.created_at DESC
        LIMIT 20
    `, [userId, wp.category]);

    console.log(`[Worker] Found ${jobs.length} available jobs matching category and service area.`);
    return { jobs, is_online: true, is_verified: true };
}));

/**
 * Get worker onboarding status
 * GET /api/worker/onboard/status
 */
router.get('/onboard/status', handle(async (userId, pool) => {
    const { getOnboardingStatus } = await import('../services/worker.service.js');
    return await getOnboardingStatus(userId, pool);
}));

/**
 * Update worker's current location
 * PUT /api/worker/location
 */
router.put('/location', handle(async (userId, pool, req) => {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
        throw Object.assign(new Error('Latitude and longitude are required'), { status: 400 });
    }

    await pool.query(`
        UPDATE worker_profiles 
        SET current_location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
            last_location_lat = $1,
            last_location_lng = $2,
            location_updated_at = NOW(),
            updated_at = NOW()
        WHERE user_id = $3
    `, [lat, lng, userId]);

    return { success: true };
}));

/**
 * Update worker availability and online status
 * PUT /api/worker/availability
 */
router.put('/availability', handle(async (userId, pool, req) => {
    const { is_online, is_available } = req.body;
    
    const updates = [];
    const values = [];
    let idx = 1;

    if (is_online !== undefined) {
        updates.push(`is_online = $${idx++}`);
        values.push(!!is_online);
    }
    if (is_available !== undefined) {
        updates.push(`is_available = $${idx++}`);
        values.push(!!is_available);
    }

    if (updates.length === 0) {
        throw Object.assign(new Error('No update fields provided'), { status: 400 });
    }

    values.push(userId);
    await pool.query(`
        UPDATE worker_profiles 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE user_id = $${idx}
    `, values);

    // Fetch updated state
    const [rows] = await pool.query('SELECT is_online, is_available FROM worker_profiles WHERE user_id = $1', [userId]);
    return rows[0];
}));

/**
 * Update worker service area (Base Location)
 * POST /api/worker/onboarding/service-area
 */
router.post('/onboarding/service-area', handle(async (userId, pool, req) => {
    const { latitude, longitude, radius_km } = req.body;
    if (!latitude || !longitude) {
        throw Object.assign(new Error('Location is required'), { status: 400 });
    }

    // Default to 15km if not provided or too small
    const radius = Math.max(parseFloat(radius_km || 15), 5);

    await pool.query(`
        UPDATE worker_profiles 
        SET service_center = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
            service_radius_km = $3,
            updated_at = NOW()
        WHERE user_id = $4
    `, [latitude, longitude, radius, userId]);

    // Note: The service_area polygon is automatically updated by the DB trigger
    return { success: true, radius_km: radius };
}));

export default router;
