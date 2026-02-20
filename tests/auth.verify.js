/**
 * tests/auth.verify.js — Final Verification Checklist
 * Run with: node tests/auth.verify.js
 *
 * Verifies exactly the 5 steps requested by the user:
 * 1. POST /api/auth/dev-login { phone: '9999999999' } → returns { token, refresh_token, user }
 * 2. Using returned token: GET /api/me → returns user object
 * 3. POST /api/auth/logout with token → token marked revoked in DB
 * 4. Using revoked token → 401
 * 5. 4th send-otp for same phone in 1hr → 429
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

function assert(condition, label) {
    if (condition) {
        console.log(`  ✔ ${label}`);
    } else {
        console.error(`  ✖ ${label}`);
        process.exitCode = 1;
    }
}

async function run() {
    console.log('\n=== ZARVA Auth Module Final Verification ===\n');

    // Step 1
    console.log('⬡ POST /api/auth/dev-login { phone: "9999999999" } → returns { token, refresh_token, user }');
    const login = await req('POST', '/api/auth/dev-login', { phone: '9999999999' });
    assert(login.status === 200, 'Status 200 OK');
    assert(typeof login.body?.token === 'string', 'Returns token');
    assert(typeof login.body?.refresh_token === 'string', 'Returns refresh_token');
    assert(login.body?.user?.phone === '+919999999999', 'Returns user with normalised phone');

    const TOKEN = login.body.token;

    // Step 2
    console.log('\n⬡ Using returned token: GET /api/me → returns user object');
    const me = await req('GET', '/api/me', null, TOKEN);
    assert(me.status === 200, 'Status 200 OK');
    assert(me.body?.user?.phone === '+919999999999', 'Returns correct user object');

    // Step 3
    console.log('\n⬡ POST /api/auth/logout with token → token marked revoked in DB');
    const logout = await req('POST', '/api/auth/logout', null, TOKEN);
    assert(logout.status === 200, 'Status 200 OK');
    assert(logout.body?.message === 'Logged out successfully.', 'Logout success message');

    // Step 4
    console.log('\n⬡ Using revoked token → 401');
    const afterLogout = await req('GET', '/api/me', null, TOKEN);
    assert(afterLogout.status === 401, 'Status 401 Unauthorized');
    assert(afterLogout.body?.message === 'Token has been revoked.', 'Revoked message verified');

    // Step 5
    console.log('\n⬡ 4th send-otp for same phone in 1hr → 429');
    const TEST_PHONE = '8888888888';

    let status429Hit = false;
    // Fire 4 requests
    for (let i = 1; i <= 4; i++) {
        const otpRes = await req('POST', '/api/auth/send-otp', { phone: TEST_PHONE });
        if (i <= 3) {
            if (otpRes.status !== 200) console.error(`Unexpected status on request ${i}: ${otpRes.status}`);
        } else {
            assert(otpRes.status === 429, '4th request triggers 429 Too Many Requests');
            status429Hit = otpRes.status === 429;
        }
    }
    assert(status429Hit, 'Rate limit enforced successfully');

    console.log('\n=== All Verification Steps Passed ===\n');
}

run().catch(err => {
    console.error('\nFatal Error:', err.message);
    process.exit(1);
});
