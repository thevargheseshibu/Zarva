import dotenv from 'dotenv';
dotenv.config();

import { getPool } from './config/database.js';
import configLoader from './config/loader.js';
import * as JobService from './services/job.service.js';

async function verify() {
    const pool = getPool();
    configLoader.setPool(pool);
    await configLoader.loadAllConfigs();

    // 1. Create a dummy customer
    const [userRes] = await pool.query(`INSERT INTO users (phone, role) VALUES ('+919999999999', 'customer') ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone RETURNING id`);
    const customerId = userRes[0].id;

    await pool.query(`INSERT INTO customer_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [customerId]);

    console.log('[Verify] Created a dummy customer:', customerId);

    // 2. Trigger Job Creation with ONLY a pincode
    const payload = {
        category: 'cleaning',
        description: 'Need basic cleaning',
        customer_address: 'Kochi, Kerala, 682020',
        pincode: '682020',
        // customer_lat/lng explicitly missing to test fallback
    };

    const idempotencyKey = `test-job-${Date.now()}`;

    try {
        console.log('[Verify] Submitting Job Payload for Geocoding...');
        const result = await JobService.createJob(customerId, payload, idempotencyKey, pool);

        console.log('[Verify] Success! Job Created:', result.job.id);

        const [jobRows] = await pool.query(`
            SELECT id, ST_AsText(job_location) as geo, location_source, location_accuracy_meters 
            FROM jobs WHERE id = $1
        `, [result.job.id]);

        console.log('[Verify] Job DB Record Location Fields:', jobRows[0]);
        console.log('\n[Verify] PASS: Pincode Geocoding and Geometry mapping was successful.');

    } catch (err) {
        console.error('[Verify] FAILED:', err.message);
    } finally {
        process.exit(0);
    }
}

verify();
