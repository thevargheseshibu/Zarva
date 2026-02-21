/**
 * services/job.service.js
 * 
 * Job creation logic, estimating integration, and idempotent handling.
 */

import configLoader from '../config/loader.js';
import { generateEstimate, calculatePricing } from '../utils/pricingEngine.js';
import * as matchingEngine from './matchingEngine.js';

/**
 * Validates a photo_s3_key to ensure it exists and belongs to the user.
 */
async function validatePhotoKey(userId, photoKey, pool) {
    const [tokens] = await pool.query(
        `SELECT is_used FROM s3_upload_tokens 
         WHERE user_id = ? AND s3_key = ? AND is_used = 1`,
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
        `SELECT * FROM jobs WHERE idempotency_key = ? AND customer_id = ?`,
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
        customer_address,
        estimated_hours,
        is_emergency,
        scheduled_for
    } = payload;

    if (!category || !customer_lat || !customer_lng || !customer_address) {
        throw Object.assign(new Error('Missing required job creation fields'), { status: 400 });
    }

    // 2. Load Configs & Compute Exact Pricing bindings
    const pricingConfig = configLoader.get('pricing');
    if (!pricingConfig.categories[category]) {
        throw Object.assign(new Error(`Invalid category: ${category}`), { status: 400 });
    }

    // 3. Optional S3 Key validation
    if (photo_s3_key) {
        await validatePhotoKey(customerId, photo_s3_key, pool);
    }

    // Compute locked-in rates and constraints
    // If estimated_hours is missing, we lock in the pricing for the 'min_hours' for this category
    const lockedHours = estimated_hours || pricingConfig.categories[category].min_hours;
    const pricingBreakdown = calculatePricing({
        category,
        hours: lockedHours,
        travelKm: 0, // In production, compute distance between lat/lng and worker later or base point. Assuming 0 for booking creation upfront.
        isEmergency: Boolean(is_emergency),
        scheduledAt: scheduled_for
    }, pricingConfig);

    const scheduledDate = scheduled_for ? new Date(scheduled_for) : null;
    let jobId = null;

    // 4. Insert Job into DB
    try {
        const [result] = await pool.query(
            `INSERT INTO jobs (
                idempotency_key, customer_id, category, status,
                address, latitude, longitude, city,
                description, scheduled_at,
                rate_per_hour, advance_amount, travel_charge, platform_fee, total_amount
            ) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                idempotencyKey,
                customerId,
                category,
                customer_address,
                customer_lat,
                customer_lng,
                'Kochi', // Hardcoded per spec rules default
                description || null,
                scheduledDate,
                pricingConfig.categories[category].rate_per_hour,
                pricingBreakdown.advance_amount,
                pricingBreakdown.travel_charge,
                pricingBreakdown.platform_fee,
                pricingBreakdown.total_amount
            ]
        );
        jobId = result.insertId;
    } catch (err) {
        // Handle race conditions on idempotency key
        if (err.code === 'ER_DUP_ENTRY') {
            const [concurrent] = await pool.query(
                `SELECT * FROM jobs WHERE idempotency_key = ?`, [idempotencyKey]
            );
            return { job: concurrent[0], is_duplicate: true };
        }
        throw err;
    }

    // Immediately mutate to 'searching'
    await pool.query(`UPDATE jobs SET status = 'searching' WHERE id = ?`, [jobId]);

    const [finalJob] = await pool.query(`SELECT * FROM jobs WHERE id = ?`, [jobId]);

    // 5. Fire Matching Engine asynchronously
    matchingEngine.startMatching(jobId).catch(e => {
        console.error(`[JobService] Async matching failed for ${jobId}:`, e.message);
    });

    return { job: finalJob[0], is_duplicate: false };
}
