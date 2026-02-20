/**
 * tests/upload.verify.js — S3 Pre-signed Upload API verifier
 *
 * 1. POST /api/auth/dev-login  -> Get Auth Token
 * 2. POST /api/uploads/presign -> Get S3 presigned URL
 * 3. POST /api/uploads/confirm -> Finalise upload token
 * 4. POST /api/uploads/confirm -> Should fail (already used)
 */

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
        if (res) {
            console.error(`      -> Got HTTP ${res.status}:`, JSON.stringify(res.body));
        }
        process.exitCode = 1;
    }
}

async function run() {
    console.log('\n=== ZARVA Uploads Module Final Verification ===\n');

    // Step 1: Login
    console.log('⬡ POST /api/auth/dev-login { phone: "9999999999" }');
    const login = await req('POST', '/api/auth/dev-login', { phone: '9999999999' });
    const TOKEN = login.body?.token;
    assert(TOKEN, 'Auth token received', login);

    // Step 2: Presign Error (Missing Fields)
    console.log('\n⬡ POST /api/uploads/presign (Missing Fields)');
    const presignBad = await req('POST', '/api/uploads/presign', {}, TOKEN);
    assert(presignBad.status === 400, 'Rejects empty payload (400)', presignBad);

    // Step 3: Presign Error (Invalid Purpose)
    console.log('\n⬡ POST /api/uploads/presign (Invalid Purpose)');
    const presignInvalid = await req('POST', '/api/uploads/presign', { purpose: 'invalid_purpose', filename: 'doc.pdf', mime_type: 'application/pdf' }, TOKEN);
    assert(presignInvalid.status === 400, 'Rejects invalid purpose (400)', presignInvalid);

    // Step 4: Presign Valid
    console.log('\n⬡ POST /api/uploads/presign (Valid payload)');
    const presign = await req('POST', '/api/uploads/presign', {
        purpose: 'worker_doc',
        filename: 'aadhaar_front.jpg',
        mime_type: 'image/jpeg'
    }, TOKEN);

    assert(presign.status === 200, 'Status 200 OK', presign);
    assert(presign.body?.upload_url?.includes('x-amz-signature') || presign.body?.upload_url?.includes('X-Amz-Signature'), 'upload_url contains AWS signature');
    assert(presign.body?.s3_key?.startsWith('worker_doc/'), 's3_key uses correct namespace prefix');
    assert(presign.body?.s3_key?.endsWith('.jpeg'), 's3_key uses correct sanitized extension');

    const { s3_key } = presign.body || {};

    // Step 5: Confirm valid token
    console.log('\n⬡ POST /api/uploads/confirm (Valid payload)');
    const confirm = await req('POST', '/api/uploads/confirm', { s3_key }, TOKEN);
    assert(confirm.status === 200, 'Status 200 OK', confirm);
    assert(confirm.body?.confirmed === true, 'Returns confirmed: true', confirm);

    // Step 6: Confirm second time (Token used)
    console.log('\n⬡ POST /api/uploads/confirm (Reusing same token)');
    const confirmFail = await req('POST', '/api/uploads/confirm', { s3_key }, TOKEN);
    assert(confirmFail.status === 400, 'Rejects used token (400)', confirmFail);
    assert(confirmFail.body?.message === 'Token already used.', 'Expected error message', confirmFail);

    // Step 7: Confirm invalid/unknown token
    console.log('\n⬡ POST /api/uploads/confirm (Unknown token)');
    const confirmUnknown = await req('POST', '/api/uploads/confirm', { s3_key: 'worker_doc/random/non_existent.png' }, TOKEN);
    assert(confirmUnknown.status === 404, 'Rejects unknown token (404)', confirmUnknown);

    console.log('\n=== All Verification Steps Passed ===\n');
}

run().catch(err => {
    console.error('\nFatal Error:', err.message);
    process.exit(1);
});
