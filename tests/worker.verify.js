/**
 * tests/worker.verify.js
 * Comprehensive end-to-end verification of the Worker Onboarding API.
 */

import 'dotenv/config';
import { getPool } from '../config/database.js';

const BASE = 'http://localhost:3000';

async function req(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
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
    console.log('\n=== ZARVA Worker Onboarding Module Verification ===\n');

    // Hardcode a unique dev login to avoid conflicts with previous test suites
    // Using a valid 10-digit Indian pattern for normalizePhone
    const login = await req('POST', '/api/auth/dev-login', { phone: '9999999998' });
    const TOKEN = login.body?.token;
    if (!TOKEN) throw new Error('Failed to get auth token for test');

    // Reset state just in case this phone number was used
    const pool = getPool();
    const [userRow] = await pool.query("SELECT id FROM users WHERE phone = '+919999999998'");
    if (userRow.length) {
        const uId = userRow[0].id;
        await pool.query("DELETE FROM worker_agreements WHERE worker_id = ?", [uId]);
        await pool.query("DELETE FROM worker_documents WHERE worker_id = ?", [uId]);
        await pool.query("DELETE FROM worker_profiles WHERE user_id = ?", [uId]);
        await pool.query("UPDATE users SET role = 'customer' WHERE id = ?", [uId]);
    }

    // 1. Start Onboarding
    console.log('\n⬡ POST /api/worker/onboard/start');
    const start = await req('POST', '/api/worker/onboard/start', {}, TOKEN);
    assert(start.status === 200, 'Starts onboarding (200)', start);
    assert(start.body?.roles?.includes('worker'), 'Returns updated roles claiming "worker"', start);

    // 2. Profile Update (Bad constraints check)
    console.log('\n⬡ PUT /api/worker/onboard/profile (Invalid Skills)');
    const profileBad = await req('PUT', '/api/worker/onboard/profile', {
        full_name: 'Test Worker', dob: '1990-01-01', gender: 'male',
        skills: ['hacking'], // Not allowed
        experience_years: 5, service_pincodes: ['682001']
    }, TOKEN);
    assert(profileBad.status === 400, 'Rejects invalid skills properly (400)', profileBad);

    // 3. Profile Update (Valid)
    console.log('\n⬡ PUT /api/worker/onboard/profile (Valid)');
    const profileOk = await req('PUT', '/api/worker/onboard/profile', {
        full_name: 'Test Worker', dob: '1990-01-01', gender: 'male',
        skills: ['electrician', 'plumber'],
        experience_years: 5, service_pincodes: ['682001', '682002']
    }, TOKEN);
    assert(profileOk.status === 200, 'Profile update successful', profileOk);

    // 4. Payment Update 
    console.log('\n⬡ PUT /api/worker/onboard/payment (Valid UPI)');
    const payOk = await req('PUT', '/api/worker/onboard/payment', {
        payment_method: 'upi', payment_details: { upi_id: 'test@upi' }
    }, TOKEN);
    assert(payOk.status === 200, 'Payment details update successful', payOk);

    // 5. Build S3 Documents payload
    // We need to inject "confirmed" s3 keys into s3_upload_tokens
    const userId = userRow[0].id;
    await pool.query(`INSERT IGNORE INTO s3_upload_tokens (user_id, s3_key, purpose, is_used, expires_at) VALUES 
    (?, 'worker_doc/1/front.jpg', 'worker_doc', 1, DATE_ADD(NOW(), INTERVAL 1 HOUR)),
    (?, 'worker_doc/1/back.jpg', 'worker_doc', 1, DATE_ADD(NOW(), INTERVAL 1 HOUR)),
    (?, 'worker_doc/1/selfie.jpg', 'profile_photo', 1, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
        [userId, userId, userId]
    );

    console.log('\n⬡ POST /api/worker/onboard/documents');
    const docs = await req('POST', '/api/worker/onboard/documents', {
        aadhar_front_key: 'worker_doc/1/front.jpg',
        aadhar_back_key: 'worker_doc/1/back.jpg',
        photo_key: 'worker_doc/1/selfie.jpg'
    }, TOKEN);
    assert(docs.status === 200, 'Document links submitted successfully', docs);

    // 6. Agreement failure (mismatched name)
    console.log('\n⬡ POST /api/worker/onboard/agree (Typos)');
    const agreeBad = await req('POST', '/api/worker/onboard/agree', { name_typed: 'Wrong Name' }, TOKEN);
    assert(agreeBad.status === 400, 'Rejects mismatched typed name', agreeBad);

    // 7. Agreement Success
    console.log('\n⬡ POST /api/worker/onboard/agree (Match)');
    const agreeOk = await req('POST', '/api/worker/onboard/agree', { name_typed: 'Test Worker' }, TOKEN);
    assert(agreeOk.status === 200, 'Agreement signed correctly', agreeOk);

    // 8. Overall Status
    console.log('\n⬡ GET /api/worker/onboard/status');
    const status = await req('GET', '/api/worker/onboard/status', null, TOKEN);
    assert(status.status === 200, 'Status fetched OK', status);
    assert(status.body?.onboarding_status === 'pending_review', 'onboarding_status -> pending_review', status);
    assert(status.body?.steps_complete?.profile === true, 'steps.profile completed', status);
    assert(status.body?.steps_complete?.payment === true, 'steps.payment completed', status);
    assert(status.body?.steps_complete?.documents === true, 'steps.documents completed', status);
    assert(status.body?.steps_complete?.agreement === true, 'steps.agreement completed', status);

    await pool.end();
    console.log('\n=== All Verification Steps Completed ===\n');
}

run().catch(err => {
    console.error('\nFatal Error:', err.message);
    process.exit(1);
});
