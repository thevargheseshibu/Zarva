/**
 * tests/job.verify.js
 * Comprehensive end-to-end verification of the Pricing Engine and Idempotent Job Creation.
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
        if (res) console.error(`      -> Got HTTP ${res.status}:`, JSON.stringify(res.body));
        process.exitCode = 1;
    }
}

async function run() {
    console.log('\n=== ZARVA Pricing Engine & Jobs API Verification ===\n');

    // Load configs locally for pure unit testing
    await configLoader.loadAllConfigs();
    const pricingConfig = configLoader.get('pricing');
    const jobsConfig = configLoader.get('jobs');

    assert(pricingConfig && jobsConfig, 'Successfully loaded pricing & jobs configs in test env');

    // 1. Pure Function Math Checks
    console.log('\n⬡ PURE FUNCTION: calculatePricing() - Standard 2 hr Job');
    const p1 = calculatePricing({ category: 'plumber', hours: 2, travelKm: 5, isEmergency: false, scheduledAt: '2026-05-10T12:00:00.000Z' }, pricingConfig);
    // Plumber = 300/hr * 2 = 600 base. 
    // Travel = 5km - 2km(free) = 3km * 8 = 24. It's < min_travel_charge 30, so 30.
    // Totals: base=600, travel=30, sub=630. Platform 10% = 63. Total = 693
    assert(p1.base_amount === 600, `Base amount calculated exactly: ${p1.base_amount}`);
    assert(p1.travel_charge === 30, `Travel charge enforced minimums: ${p1.travel_charge}`);
    assert(p1.subtotal === 630, `Subtotal summed exactly: ${p1.subtotal}`);
    assert(p1.platform_fee === 63, `Platform commission generated: ${p1.platform_fee}`);
    assert(p1.total_amount === 693, `Total amount generated: ${p1.total_amount}`);

    console.log('\n⬡ PURE FUNCTION: calculatePricing() - Night Surcharge + Emergency');
    const p2 = calculatePricing({ category: 'electrician', hours: 2, travelKm: 0, isEmergency: true, scheduledAt: '2026-05-10T22:00:00.000Z' }, pricingConfig);
    // Electrician = 350. hours = 2. base = 700. travel = 0.
    // Night (22:00 -> 00:00) = 2 hours. Night Base = 700. Surcharge 20% = 140.
    // Emergency Surge 25% of base = 175.
    // subtotal = 700 + 0 + 140 + 175 = 1015
    assert(p2.night_surcharge === 140, `Night surcharge calculated correctly for 2 hours in window: ${p2.night_surcharge}`);
    assert(p2.emergency_surcharge === 175, `Emergency surcharge strictly applied: ${p2.emergency_surcharge}`);
    assert(p2.subtotal === 1015, `Subtotal with surges mathematically correct: ${p2.subtotal}`);

    // Hardcode dev login
    const login = await req('POST', '/api/auth/dev-login', { phone: '9876543210' });
    const TOKEN = login.body?.token;
    if (!TOKEN) throw new Error('Failed to get auth token for test');

    // 2. HTTP E2E checks
    console.log('\n⬡ GET /api/jobs/config');
    const cfg = await req('GET', '/api/jobs/config', null, TOKEN);
    assert(cfg.status === 200, 'Jobs config endpoint returned 200 OK', cfg);
    assert(Array.isArray(cfg.body?.categories), 'Categories mapped explicitly to array', cfg);
    assert(cfg.body?.questions?.electrician?.length > 0, 'Questions schema loaded cleanly', cfg);

    console.log('\n⬡ POST /api/jobs/estimate (Range Check)');
    const est1 = await req('POST', '/api/jobs/estimate', { category: 'cleaner', is_emergency: true }, TOKEN);
    assert(est1.status === 200, 'Estimates range OK', est1);
    assert(est1.body?.type === 'range', 'Returns range type when hours missing', est1);
    assert(est1.body?.min_estimate > 0 && est1.body?.max_estimate > est1.body?.min_estimate, 'Range calculations expand exactly correctly ($min -> $min+1)', est1);

    const idempotencyKey = 'testing-key-' + Date.now();

    console.log(`\n⬡ POST /api/jobs (Idempotent exactly-once creation)`);

    // First Call - Creates Job
    const create1 = await req('POST', '/api/jobs', {
        category: 'electrician',
        customer_lat: 9.9312,
        customer_lng: 76.2673,
        customer_address: 'Test House, Kochi',
        is_emergency: false
    }, TOKEN, { 'X-Idempotency-Key': idempotencyKey });

    assert(create1.status === 200, 'Job created successfully', create1);
    assert(create1.body?.job?.id > 0, 'Returned physical DB Job ID', create1);
    assert(create1.body?.is_duplicate === false, 'is_duplicate labeled FALSE correctly', create1);

    // Second Call - Should return duplicate instantly
    console.log(`\n⬡ POST /api/jobs (Duplicating idempotency key request)`);
    const create2 = await req('POST', '/api/jobs', {
        category: 'electrician',
        customer_lat: 9.9312,
        customer_lng: 76.2673,
        customer_address: 'Test House, Kochi',
        is_emergency: false
    }, TOKEN, { 'X-Idempotency-Key': idempotencyKey });

    assert(create2.status === 200, 'Duplicate request returned 200 OK cleanly', create2);
    assert(create2.body?.job?.id === create1.body?.job?.id, 'Returned IDENTICAL Job ID without generating new records', create2);
    assert(create2.body?.is_duplicate === true, 'is_duplicate labeled TRUE perfectly', create2);

    // Allow async MatchingEngine to print
    await new Promise(r => setTimeout(r, 1500));

    const pool = getPool();
    await pool.end();

    console.log('\n=== All Verification Steps Completed ===\n');
}

run().catch(err => {
    console.error('\nFatal Error:', err.message);
    process.exit(1);
});
