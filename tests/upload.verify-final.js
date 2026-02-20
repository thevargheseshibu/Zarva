/**
 * tests/upload.verify-final.js — Final Verification Checklist for Task 3.1
 * Run with: node tests/upload.verify-final.js
 *
 * Verifies exactly the 5 steps requested by the user:
 * 1. POST /api/uploads/presign { purpose: 'worker_doc', filename: 'aadhar_front.jpg', mime_type: 'image/jpeg' } 
 *    → returns upload_url and s3_key
 * 2. upload_url is a real pre-signed S3 URL (starts with https://zarva-images.s3.[region].amazonaws.com)
 * 3. POST /api/uploads/confirm { s3_key } → returns confirmed key
 * 4. Second confirm of same key → 409 (already used)
 * 5. Confirm after expiry → 400
 */

import 'dotenv/config';
import { getPool } from '../config/database.js';

const BASE = 'http://localhost:3000';
const AWS_BUCKET_NAME = 'zarva-images';
const AWS_REGION = 'ap-south-1';

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
    console.log('\n=== ZARVA S3 Upload Module Final Verification ===\n');

    // Prerequisite: Login to get token
    const login = await req('POST', '/api/auth/dev-login', { phone: '9999999999' });
    const TOKEN = login.body?.token;
    if (!TOKEN) throw new Error('Failed to get auth token for test');

    // Step 1
    console.log('⬡ POST /api/uploads/presign { purpose: "worker_doc", filename: "aadhar_front.jpg", mime_type: "image/jpeg" } → returns upload_url and s3_key');
    const presign = await req('POST', '/api/uploads/presign', {
        purpose: 'worker_doc',
        filename: 'aadhar_front.jpg',
        mime_type: 'image/jpeg'
    }, TOKEN);

    assert(presign.status === 200, 'Status 200 OK', presign);
    assert(presign.body?.upload_url, 'Returns upload_url', presign);
    assert(presign.body?.s3_key, 'Returns s3_key', presign);

    const { upload_url, s3_key } = presign.body;

    // Step 2
    console.log('\n⬡ upload_url is a real pre-signed S3 URL');
    // Format typically: https://[bucket-name].s3.[region].amazonaws.com/...
    // OR https://s3.[region].amazonaws.com/[bucket-name]/... (path style)
    // AWS SDK v3 generally defaults to virtual-hosted style
    const expectedUrlPrefix1 = `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`;
    const expectedUrlPrefix2 = `https://s3.${AWS_REGION}.amazonaws.com/${AWS_BUCKET_NAME}`;

    const isValidUrl = upload_url.startsWith(expectedUrlPrefix1) || upload_url.startsWith(expectedUrlPrefix2);
    assert(isValidUrl, `URL starts with expected S3 domain (got: ${upload_url.substring(0, 50)}...)`);
    assert(upload_url.includes('X-Amz-Signature') || upload_url.includes('x-amz-signature'), 'URL contains AWS Signature parameter');

    // Step 3
    console.log('\n⬡ POST /api/uploads/confirm { s3_key } → returns confirmed key');
    const confirm1 = await req('POST', '/api/uploads/confirm', { s3_key }, TOKEN);
    assert(confirm1.status === 200, 'Status 200 OK', confirm1);
    assert(confirm1.body?.s3_key === s3_key, 'Returns confirmed key', confirm1);
    assert(confirm1.body?.confirmed === true, 'Returns confirmed: true', confirm1);

    // Step 4
    console.log('\n⬡ Second confirm of same key → 409 (already used)');
    // NOTE: The current implementation returns 400. The user explicitly requested 409. 
    // We will run the test. If it fails (which it will, returning 400), we know we need to update the service to return 409.
    const confirm2 = await req('POST', '/api/uploads/confirm', { s3_key }, TOKEN);
    assert(confirm2.status === 409, 'Status 409 Conflict', confirm2);

    // Step 5
    console.log('\n⬡ Confirm after expiry → 400');
    // First generate a new token
    const presignExp = await req('POST', '/api/uploads/presign', {
        purpose: 'worker_doc',
        filename: 'test_expiry.jpg',
        mime_type: 'image/jpeg'
    }, TOKEN);
    const exp_s3_key = presignExp.body?.s3_key;

    // Now manually alter the DB to make it expired using a direct mysql query
    const pool = getPool();
    await pool.query(
        "UPDATE s3_upload_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE s3_key = ?",
        [exp_s3_key]
    );

    // Try to confirm it now
    const confirmExp = await req('POST', '/api/uploads/confirm', { s3_key: exp_s3_key }, TOKEN);
    assert(confirmExp.status === 400, 'Status 400 Bad Request', confirmExp);
    assert(confirmExp.body?.message === 'Upload token expired.', 'Correct expiry message', confirmExp);

    await pool.end();

    console.log('\n=== All Verification Steps Completed ===\n');
}

run().catch(err => {
    console.error('\nFatal Error:', err.message);
    process.exit(1);
});
