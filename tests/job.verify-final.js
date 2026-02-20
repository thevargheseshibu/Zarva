/**
 * tests/job.verify-final.js
 * Comprehensive end-to-end verification of the Worker Onboarding API.
 * 
 * Flow matching USER EXPECTED OUTPUT:
 * 1. POST /api/jobs/estimate { category: 'electrician', hours: 2 } 
 *    -> { base_amount: 700, travel_charge: 0, total_estimate(total_amount): 770, advance: ~115 (115.5) }
 * 2. POST /api/jobs with same X-Idempotency-Key twice -> same job_id returned
 * 3. Night surcharge: job from 20:00-01:00 -> exactly 4hrs billed at night rate
 * 4. Platform fee ON TOP of subtotal
 * 5. minimum_charge enforced: 30min plumber job -> charged minimum 300
 */

import 'dotenv/config';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import { calculatePricing } from '../utils/pricingEngine.js';

const BASE = 'http://localhost:3000';

async function req(method, path, body, token, headers = {}) {
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: reqHeaders,
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
}

function assert(condition, label, res = null) {
    if (condition) {
        console.log(`  ✔ ${label}`);
    } else {
        console.error(`  ✖ ${label}`);
        if (res) console.error(`      -> Result:`, JSON.stringify(res, null, 2));
        process.exitCode = 1;
    }
}

async function run() {
    console.log('\n=== ZARVA Pricing Engine & Jobs API Final Verification ===\n');

    await configLoader.loadAllConfigs();
    const pricingConfig = configLoader.get('pricing');

    // Hardcode dev login
    const login = await req('POST', '/api/auth/dev-login', { phone: '9876543210' });
    const TOKEN = login.body?.token;
    if (!TOKEN) throw new Error('Failed to get auth token for test');

    // Requirement 1: Estimate Output
    console.log("⬡ POST /api/jobs/estimate { category: 'electrician', hours: 2 }");
    const estRTS = await req('POST', '/api/jobs/estimate', { category: 'electrician', hours: 2 }, TOKEN);
    assert(estRTS.status === 200, 'Estimate Endpoint returns 200 OK');
    const payload = estRTS.body;
    assert(payload?.breakdown?.base_amount === 700, 'breakdown.base_amount is 700', payload);
    assert(payload?.breakdown?.travel_charge === 0, 'breakdown.travel_charge is 0', payload);
    assert(payload?.exact_estimate === 770, 'exact_estimate (Total) is 770', payload);
    assert(payload?.advance_amount === 115.5 || payload?.advance_amount === 115, 'Advance calculated successfully (15%)', payload);

    // Requirement 2: Idempotency
    console.log("\n⬡ POST /api/jobs with same X-Idempotency-Key twice");
    const idempotencyKey = 'testing-key-' + Date.now();

    const create1 = await req('POST', '/api/jobs', {
        category: 'electrician',
        customer_lat: 9.9312,
        customer_lng: 76.2673,
        customer_address: 'Test House, Kochi',
        is_emergency: false,
        estimated_hours: 2
    }, TOKEN, { 'X-Idempotency-Key': idempotencyKey });

    const create2 = await req('POST', '/api/jobs', {
        category: 'electrician',
        customer_lat: 9.9312,
        customer_lng: 76.2673,
        customer_address: 'Test House, Kochi',
        is_emergency: false,
        estimated_hours: 2
    }, TOKEN, { 'X-Idempotency-Key': idempotencyKey });

    assert(create1.status === 200 && create2.status === 200, 'Both requests returned 200 OK');
    assert(create1.body?.job?.id > 0, 'First request generated physical Job ID');
    assert(create1.body?.job?.id === create2.body?.job?.id, 'Second request returned identical job_id');
    assert(create1.body?.is_duplicate === false && create2.body?.is_duplicate === true, 'Duplicate flag correctly assigned');

    // Requirement 3: Night Surcharge Split (20:00 to 01:00 = 5 total hours)
    console.log('\n⬡ Night surcharge: job from 20:00-01:00 -> only 4hrs billed at night rate');
    const scheduledTime = new Date();
    scheduledTime.setHours(20, 0, 0, 0); // 20:00
    const pnight = calculatePricing({ category: 'electrician', hours: 5, scheduledAt: scheduledTime.toISOString() }, pricingConfig);
    // Total = 5 hrs. 20:00 to 21:00 = 1hr Day. 21:00 to 01:00 = 4hr Night. Correct Night Hours = 4.
    // 4 hrs * 350 = 1400. 20% of 1400 = 280 Night Surcharge.
    assert(pnight.night_surcharge === 280, `Exactly 4 hours (1400) billed at night rate (20% = 280)`, pnight);

    // Requirement 4: Platform Fee vs Worker Payout
    console.log('\n⬡ Platform fee is added ON TOP of subtotal (customer pays it, worker gets full subtotal)');
    assert(pnight.platform_fee > 0, 'Platform fee generated');
    assert(pnight.total_amount === Number((pnight.subtotal + pnight.platform_fee).toFixed(2)), 'total = subtotal + platform_fee');
    assert(pnight.worker_payout === pnight.subtotal, 'Worker payout is 100% of the subtotal');

    // Requirement 5: Minimum Charge (plumber, 30 min)
    console.log('\n⬡ minimum_charge enforced: 30min plumber job -> charged minimum 300 not 150');
    const pmin = calculatePricing({ category: 'plumber', hours: 0.5 }, pricingConfig);
    assert(pmin.base_amount === 300, `plumber base amount strictly floored to ₹300 for 0.5 hours`, pmin);

    await getPool().end();
    console.log('\n=== All Verification Steps Completed ===\n');
}

run().catch(err => {
    console.error('\nFatal Error:', err.message);
    process.exit(1);
});
