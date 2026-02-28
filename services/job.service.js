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
import * as PricingService from './pricing.service.js';
import { updateJobStatus } from './firebase.service.js';

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
        district,
        customer_address,
        customer_address_detail,
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
        city: 'Kochi',
        district: district
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
            m.default.logUnserviceableRequest(locationInfo.latitude, locationInfo.longitude, category, locationInfo.district);
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

    // 2. Resolve Hourly Rate and Lock it in
    const pricing = PricingService.resolveHourlyRate(
        category,
        locationInfo.city,
        locationInfo.district, // Note: using district as stateName proxy if state is missing in locationInfo
        locationInfo.pincode,
        is_emergency ? 1.5 : 1.0
    );

    // Update pricing for standard billing fields
    const rate_per_hour = pricing.hourly_rate;
    const travel_charge = 0; // Set to 0 at job creation, calculated at worker arrival
    const advance_amount = 0; // As per new design, we focus on hourly logic
    const platform_fee = 0;
    const total_amount = 0;

    const scheduledDate = scheduled_for ? new Date(scheduled_for) : null;
    let jobId = null;

    // 4. Insert Job into DB
    try {
        const [rows] = await pool.query(
            `INSERT INTO jobs (
                idempotency_key, customer_id, category, status,
                address, customer_address_detail, job_location, location_source, latitude, longitude, pincode, city, district,
                description, scheduled_at,
                rate_per_hour, advance_amount, travel_charge, platform_fee, total_amount, metadata
            ) VALUES ($1, $2, $3, 'open', $4, $5, ST_GeogFromText($6), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`,
            [
                idempotencyKey, customerId, category, customer_address,
                JSON.stringify(customer_address_detail || {}),
                locationInfo.location, locationInfo.location_source,
                locationInfo.latitude, locationInfo.longitude, locationInfo.pincode, locationInfo.city, locationInfo.district,
                description || null, scheduledDate,
                rate_per_hour, advance_amount, travel_charge, platform_fee, total_amount,
                JSON.stringify({ resolved_via: pricing.resolved_via, tier: pricing.tier })
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

    // Initialize Firebase visibility (status: 'searching')
    await updateJobStatus(jobId, 'searching').catch(e => console.error(`[JobService] Firebase status init failed for ${jobId}:`, e.message));


    // 5. Fire Matching Engine asynchronously
    console.log(`[JobService] Job ${jobId} created and moved to 'searching'. Triggering Matching Engine...`);
    matchingEngine.startMatching(jobId).catch(e => {
        console.error(`[JobService] Async matching failed for ${jobId}:`, e.message);
    });

    return { job: (await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]))[0][0], is_duplicate: false };
}
