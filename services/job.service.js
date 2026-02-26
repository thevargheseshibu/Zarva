/**
 * services/job.service.js
 * 
 * Job creation logic, estimating integration, and idempotent handling.
 */

import configLoader from '../config/loader.js';
import { generateEstimate, calculatePricing } from '../utils/pricingEngine.js';
import * as matchingEngine from './matchingEngine.js';
import { processLocation } from './location.service.js';

import coverageService from './coverage.service.js';

/**
 * Validates a photo_s3_key to ensure it exists and belongs to the user.
 */
async function validatePhotoKey(userId, photoKey, pool) {
    const [tokens] = await pool.query(
        `SELECT is_used FROM s3_upload_tokens 
         WHERE user_id = $1 AND s3_key = $2 AND is_used = true`,
        [userId, photoKey]
    );

    if (tokens.length === 0) {
        throw Object.assign(new Error('photo_s3_key is invalid or not confirmed.'), { status: 400 });
    }
    return true;
}

/**
 * Create a Job 
 * Enforces exactly-once execution using the idempotency key against the database UNIQUE constraint.
 */
export async function createJob(customerId, payload, idempotencyKey, pool) {
    if (!idempotencyKey) {
        throw Object.assign(new Error('X-Idempotency-Key header is required.'), { status: 400 });
    }

    // 1. Check idempotency (within a reasonable window or simply by existence)
    // The DB enforces this physically via `uq_jobs_idempotency`
    const [existingJobs] = await pool.query(
        `SELECT * FROM jobs WHERE idempotency_key = $1 AND customer_id = $2`,
        [idempotencyKey, customerId]
    );

    if (existingJobs.length > 0) {
        // Return existing job identically
        return { job: existingJobs[0], is_duplicate: true };
    }

    const {
        category,
        description,
        photo_s3_key,
        customer_lat,
        customer_lng,
        pincode,
        customer_address,
        estimated_hours,
        is_emergency,
        scheduled_for
    } = payload;

    if (!category || !customer_address) {
        throw Object.assign(new Error('Missing required job creation fields'), { status: 400 });
    }

    // Process Location Server-Side Fallback
    const locationInfo = await processLocation({
        latitude: customer_lat,
        longitude: customer_lng,
        pincode: pincode,
        city: 'Kochi'
    });

    // CRITICAL - Verify serviceability BEFORE creating job
    const coverage = await coverageService.isLocationServiceable(
        locationInfo.latitude,
        locationInfo.longitude,
        category
    );

    if (!coverage.is_serviceable) {
        // Log unserviceable request asynchronously
        import('./analytics.service.js').then(m => {
            m.default.logUnserviceableRequest(locationInfo.latitude, locationInfo.longitude, category);
        }).catch(err => console.error(err));

        throw Object.assign(new Error(`Sorry, we don't have ${category} workers available in this area yet. Nearest worker is ${coverage.nearest_worker_distance_km ? coverage.nearest_worker_distance_km.toFixed(1) : 'unknown'} km away.`), {
            status: 400,
            code: 'LOCATION_NOT_SERVICEABLE',
            nearest_worker_distance_km: coverage.nearest_worker_distance_km,
            suggestion: (coverage.nearest_worker_distance_km && coverage.nearest_worker_distance_km < 20)
                ? 'We may expand here soon.'
                : 'We currently serve other areas.'
        });
    }

    // 2. Load Configs & Compute Exact Pricing bindings
    const pricingConfig = configLoader.get('jobs');
    if (!pricingConfig.categories[category]) {
        throw Object.assign(new Error(`Invalid category: ${category}`), { status: 400 });
    }

    // 3. Optional S3 Key validation
    if (photo_s3_key) {
        await validatePhotoKey(customerId, photo_s3_key, pool);
    }

    // Compute locked-in rates and constraints
    const lockedHours = estimated_hours || pricingConfig.categories[category].min_hours;
    const pricingBreakdown = calculatePricing({
        category,
        hours: lockedHours,
        travelKm: 0,
        isEmergency: Boolean(is_emergency),
        scheduledAt: scheduled_for
    }, pricingConfig);

    const scheduledDate = scheduled_for ? new Date(scheduled_for) : null;
    let jobId = null;

    // 4. Insert Job into DB
    try {
        const [rows] = await pool.query(
            `INSERT INTO jobs (
                idempotency_key, customer_id, category, status,
                address, job_location, location_source, latitude, longitude, pincode, city,
                description, scheduled_at,
                rate_per_hour, advance_amount, travel_charge, platform_fee, total_amount
            ) VALUES ($1, $2, $3, 'open', $4, ST_GeogFromText($5), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
            [
                idempotencyKey, customerId, category, customer_address, locationInfo.location, locationInfo.location_source,
                locationInfo.latitude, locationInfo.longitude, locationInfo.pincode, locationInfo.city,
                description || null, scheduledDate,
                pricingConfig.categories[category].rate_per_hour, pricingBreakdown.advance_amount,
                pricingBreakdown.travel_charge, pricingBreakdown.platform_fee, pricingBreakdown.total_amount
            ]
        );
        jobId = rows[0].id;
    } catch (err) {
        if (err.code === '23505') { // Postgres unique constraint payload code
            const [concurrent] = await pool.query(
                `SELECT * FROM jobs WHERE idempotency_key = $1`, [idempotencyKey]
            );
            return { job: concurrent[0], is_duplicate: true };
        }
        throw err;
    }

    // Immediately mutate to 'searching'
    await pool.query(`UPDATE jobs SET status = 'searching' WHERE id = $1`, [jobId]);

    // 5. Fire Matching Engine asynchronously
    console.log(`[JobService] Job ${jobId} created and moved to 'searching'. Triggering Matching Engine...`);
    matchingEngine.startMatching(jobId).catch(e => {
        console.error(`[JobService] Async matching failed for ${jobId}:`, e.message);
    });

    return { job: (await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]))[0][0], is_duplicate: false };
}
