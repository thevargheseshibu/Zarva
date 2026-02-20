/**
 * tests/worker.verify-final.js
 * Comprehensive end-to-end verification of the Worker Onboarding API.
 * 
 * Flow matching USER EXPECTED OUTPUT:
 * 1. POST /api/worker/onboard/start
 * 2. PUT /api/worker/onboard/profile
 * 3. PUT /api/worker/onboard/payment
 * 4. POST /api/worker/onboard/documents (validates pre-confirmed S3 keys)
 * 5. POST /api/worker/onboard/agree (stores IP)
 * 6. GET /api/worker/onboard/status (checks step completion & progress)
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
    console.log('\n=== ZARVA Worker Onboarding Module Final Verification ===\n');

    // Hardcode a unique dev login to avoid conflicts with previous test suites
    const login = await req('POST', '/api/auth/dev-login', { phone: '9999999997' });
    const TOKEN = login.body?.token;
    if (!TOKEN) throw new Error('Failed to get auth token for test');

    // Reset state just in case this phone number was used
    const pool = getPool();
    const [userRow] = await pool.query("SELECT id FROM users WHERE phone = '+919999999997'");
    if (userRow.length) {
        const uId = userRow[0].id;
        await pool.query("DELETE FROM worker_agreements WHERE worker_id = ?", [uId]);
        await pool.query("DELETE FROM worker_documents WHERE worker_id = ?", [uId]);
        await pool.query("DELETE FROM worker_profiles WHERE user_id = ?", [uId]);
        await pool.query("UPDATE users SET role = 'customer' WHERE id = ?", [uId]);
    }

    const userId = userRow[0].id;

    // 1. Start Onboarding
    console.log('\n⬡ POST /api/worker/onboard/start');
    const start = await req('POST', '/api/worker/onboard/start', {}, TOKEN);
    assert(start.status === 200, 'Starts onboarding (200)', start);

    // Verify status progress 1 (Draft)
    const [prof1] = await pool.query("SELECT kyc_status FROM worker_profiles WHERE user_id = ?", [userId]);
    assert(prof1[0].kyc_status === 'draft', "onboarding_status progresses to 'draft'");

    // 2. Profile Update
    console.log('\n⬡ PUT /api/worker/onboard/profile');
    const profileOk = await req('PUT', '/api/worker/onboard/profile', {
        full_name: 'Test Worker', dob: '1990-01-01', gender: 'male',
        skills: ['electrician', 'plumber'],
        experience_years: 5, service_pincodes: ['682001', '682002']
    }, TOKEN);
    assert(profileOk.status === 200, 'Profile update successful', profileOk);

    // Verify status progress 2 (Documents Pending)
    const [prof2] = await pool.query("SELECT kyc_status FROM worker_profiles WHERE user_id = ?", [userId]);
    assert(prof2[0].kyc_status === 'documents_pending', "onboarding_status progresses to 'documents_pending'");

    // 3. Payment Update 
    console.log('\n⬡ PUT /api/worker/onboard/payment');
    const payOk = await req('PUT', '/api/worker/onboard/payment', {
        payment_method: 'upi', payment_details: { upi_id: 'test@upi' }
    }, TOKEN);
    assert(payOk.status === 200, 'Payment details update successful', payOk);

    // 4. Documents Endpoints validates pre-confirmed S3 Keys
    console.log('\n⬡ POST /api/worker/onboard/documents');

    // Try with invalid keys first to prove validation works
    const docsFail = await req('POST', '/api/worker/onboard/documents', {
        aadhar_front_key: 'invalid_key',
        aadhar_back_key: 'invalid_key',
        photo_key: 'invalid_key'
    }, TOKEN);
    assert(docsFail.status === 400, 'Documents endpoint validates s3_keys were pre-confirmed (rejects raw/invalid keys)', docsFail);

    // Mock valid keys in DB
    await pool.query(`INSERT IGNORE INTO s3_upload_tokens (user_id, s3_key, purpose, is_used, expires_at) VALUES 
    (?, 'worker_doc/final/front.jpg', 'worker_doc', 1, DATE_ADD(NOW(), INTERVAL 1 HOUR)),
    (?, 'worker_doc/final/back.jpg', 'worker_doc', 1, DATE_ADD(NOW(), INTERVAL 1 HOUR)),
    (?, 'worker_doc/final/selfie.jpg', 'profile_photo', 1, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
        [userId, userId, userId]
    );

    const docsOk = await req('POST', '/api/worker/onboard/documents', {
        aadhar_front_key: 'worker_doc/final/front.jpg',
        aadhar_back_key: 'worker_doc/final/back.jpg',
        photo_key: 'worker_doc/final/selfie.jpg'
    }, TOKEN);
    assert(docsOk.status === 200, 'Documents accepted when S3 keys are confirmed', docsOk);

    // Verify status progress 3 (Pending Review)
    const [prof3] = await pool.query("SELECT kyc_status FROM worker_profiles WHERE user_id = ?", [userId]);
    assert(prof3[0].kyc_status === 'pending_review', "onboarding_status progresses to 'pending_review'");

    // 5. Agreement records IP
    console.log('\n⬡ POST /api/worker/onboard/agree');
    const agreeOk = await req('POST', '/api/worker/onboard/agree', { name_typed: 'Test Worker' }, TOKEN);
    assert(agreeOk.status === 200, 'Agreement signed correctly', agreeOk);

    const [agreementRows] = await pool.query("SELECT ip_address FROM worker_agreements WHERE worker_id = ?", [userId]);
    assert(agreementRows.length > 0 && agreementRows[0].ip_address, 'Agreement stores ip_address from req.ip');

    // 6. Overall Status returns completion object
    console.log('\n⬡ GET /api/worker/onboard/status');
    const status = await req('GET', '/api/worker/onboard/status', null, TOKEN);
    assert(status.status === 200, 'Status fetched OK', status);

    const steps = status.body?.steps_complete;
    assert(steps !== undefined, 'Returns which steps are complete');

    const allStepsTrue = steps.profile === true && steps.payment === true && steps.documents === true && steps.agreement === true;
    assert(allStepsTrue, 'Full onboarding flow completes: start → profile → payment → documents → agree');

    await pool.end();
    console.log('\n=== All Verification Steps Completed ===\n');
}

run().catch(err => {
    console.error('\nFatal Error:', err.message);
    process.exit(1);
});
