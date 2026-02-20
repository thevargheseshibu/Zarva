/**
 * tests/auth.smoke.js — Auth module smoke test
 * Run with: node tests/auth.smoke.js
 * Requires server to already be running on port 3000.
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
    console.log('\n=== Auth Smoke Tests ===\n');

    // 1. dev-login
    console.log('1. POST /api/auth/dev-login');
    const login = await req('POST', '/api/auth/dev-login', { phone: '9876543210' });
    assert(login.status === 200, `HTTP 200 (got ${login.status})`);
    assert(typeof login.body?.token === 'string', 'Returns token');
    assert(typeof login.body?.refresh_token === 'string', 'Returns refresh_token');
    assert(login.body?.user?.phone === '+919876543210', `Phone normalised: ${login.body?.user?.phone}`);
    assert(Array.isArray(login.body?.user?.roles), 'Roles is array');

    const TOKEN = login.body.token;
    const REFRESH = login.body.refresh_token;

    // 2. /me with valid token
    console.log('\n2. GET /api/me (valid token)');
    const me = await req('GET', '/api/me', null, TOKEN);
    assert(me.status === 200, `HTTP 200 (got ${me.status})`);
    assert(me.body?.user?.phone === '+919876543210', `Phone: ${me.body?.user?.phone}`);
    assert(me.body?.user?.profile !== undefined, 'Profile object present');

    // 3. refresh-token
    console.log('\n3. POST /api/auth/refresh-token');
    const refresh = await req('POST', '/api/auth/refresh-token', { refresh_token: REFRESH });
    assert(refresh.status === 200, `HTTP 200 (got ${refresh.status})`);
    assert(typeof refresh.body?.token === 'string', 'New access token returned');
    assert(typeof refresh.body?.refresh_token === 'string', 'New refresh token returned');
    assert(refresh.body?.refresh_token !== REFRESH, 'New refresh token differs from old');

    const NEW_TOKEN = refresh.body.token;

    // 4. Old refresh token rejected (revoked)
    console.log('\n4. POST /api/auth/refresh-token (old token → should fail)');
    const reuse = await req('POST', '/api/auth/refresh-token', { refresh_token: REFRESH });
    assert(reuse.status === 401, `HTTP 401 (got ${reuse.status})`);

    // 5. logout
    console.log('\n5. POST /api/auth/logout');
    const logout = await req('POST', '/api/auth/logout', null, NEW_TOKEN);
    assert(logout.status === 200, `HTTP 200 (got ${logout.status})`);
    assert(logout.body?.message?.includes('Logged out'), 'Logout message present');

    // 6. Revoked token rejected on /me
    console.log('\n6. GET /api/me with revoked token (should 401)');
    const afterLogout = await req('GET', '/api/me', null, NEW_TOKEN);
    assert(afterLogout.status === 401, `HTTP 401 (got ${afterLogout.status})`);

    // 7. /me without token → 401
    console.log('\n7. GET /api/me without token (should 401)');
    const noToken = await req('GET', '/api/me', null, null);
    assert(noToken.status === 401, `HTTP 401 (got ${noToken.status})`);

    // 8. send-otp (dev mode — just acks)
    console.log('\n8. POST /api/auth/send-otp');
    const otp = await req('POST', '/api/auth/send-otp', { phone: '9876543210' });
    assert(otp.status === 200, `HTTP 200 (got ${otp.status})`);
    assert(otp.body?.message === 'OTP sent', `Message: ${otp.body?.message}`);
    assert(otp.body?.expires_in === 300, 'expires_in = 300');

    console.log('\n=== Done ===\n');
}

run().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
