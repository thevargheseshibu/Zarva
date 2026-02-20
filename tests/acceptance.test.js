/**
 * tests/acceptance.test.js — Acceptance criteria verification
 * Tests all 5 spec requirements using Node:test + inline mocks.
 *
 * Run: node --test tests/acceptance.test.js
 */

// Set env vars BEFORE any imports so all modules pick them up on load
process.env.JWT_SECRET = 'zarva_test_secret_for_acceptance';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { toE164 } from '../middleware/normalizePhone.js';
import roleGuard from '../middleware/roleGuard.js';

const SECRET = 'zarva_test_secret_for_acceptance'; // same as process.env.JWT_SECRET above

// ── Mock helper ──────────────────────────────────────────────────────
/** Create a minimal mock Express res with status tracking. */
function mockRes() {
    const res = { _status: null, _body: null };
    res.status = (s) => { res._status = s; return res; };
    res.json = (b) => { res._body = b; return res; };
    return res;
}

// Shared no-op pool — used when we know the JWT check fails before any DB hit
const noopPool = { async query() { return [[]]; } };

// ── 1. Phone normalisation ──────────────────────────────────────────
describe('Acceptance: phone normalisation', () => {
    it('9876543210 → +919876543210', () => {
        assert.equal(toE164('9876543210'), '+919876543210');
    });

    it('919876543210 → +919876543210', () => {
        assert.equal(toE164('919876543210'), '+919876543210');
    });

    it('+919876543210 → +919876543210 (unchanged)', () => {
        assert.equal(toE164('+919876543210'), '+919876543210');
    });
});

// ── 2. Expired JWT → 401 ────────────────────────────────────────────
describe('Acceptance: expired JWT → 401', () => {
    it('expired token causes 401 with "expired" message', async () => {
        const { authenticate } = await import('../middleware/authenticateJWT.js');

        // Set exp 60 s in the past → jwt.verify throws TokenExpiredError
        const now = Math.floor(Date.now() / 1000);
        const expiredToken = jwt.sign({ sub: 99, exp: now - 60 }, SECRET);

        // noopPool — should never be called because jwt.verify fails first
        const result = await authenticate(expiredToken, noopPool);

        assert.equal(result.error?.status, 401,
            `Expected 401, got ${result.error?.status} — ${JSON.stringify(result)}`);
        assert.ok(
            result.error.message.toLowerCase().includes('expired'),
            `Expected "expired" in message, got: "${result.error.message}"`
        );
    });
});


// ── 3. Blocked user → 403 ───────────────────────────────────────────
describe('Acceptance: blocked user JWT → 403', () => {
    it('valid JWT for a blocked user returns 403 with Account suspended', async () => {
        // authenticate() accepts optional pool param — inject mock to avoid live DB
        const { authenticate } = await import('../middleware/authenticateJWT.js');

        const token = jwt.sign(
            { sub: 42, roles: ['customer'], active_role: 'customer' },
            SECRET,
            { expiresIn: '1h' }
        );

        // Mock pool: valid token row + blocked user
        const mockPool = {
            async query(sql) {
                if (sql.includes('auth_tokens')) {
                    return [[{
                        id: 1,
                        user_id: 42,
                        expires_at: new Date(Date.now() + 3_600_000),
                        revoked_at: null,
                    }]];
                }
                return [[{ id: 42, phone: '+919876543210', role: 'customer', is_blocked: 1 }]];
            },
        };

        // Pass feature flags directly — no module cache dependency
        const featureOverrides = { security: { check_blocked_on_every_request: true } };
        const result = await authenticate(token, mockPool, featureOverrides);

        assert.equal(result.error?.status, 403,
            `Expected 403, got ${result.error?.status} — ${JSON.stringify(result)}`);
        assert.ok(
            result.error.message.toLowerCase().includes('suspended'),
            `Expected "suspended" in message, got: "${result.error.message}"`
        );
    });
});

// ── 4. roleGuard('worker') on customer token → 403 ──────────────────
describe('Acceptance: roleGuard worker guard on customer user → 403', () => {
    it("customer role denied access to worker route", () => {
        const req = {
            user: { id: 1, roles: ['customer'], active_role: 'customer' },
        };
        const res = mockRes();
        let nextCalled = false;
        roleGuard('worker')(req, res, () => { nextCalled = true; });

        assert.equal(res._status, 403, `Expected 403, got ${res._status}`);
        assert.equal(res._body.code, 'FORBIDDEN');
        assert.equal(nextCalled, false, 'next() must not be called');
    });
});

// ── 5. normalizePhone sets req.normalizedPhone + calls next ──────────
describe('Acceptance: normalizePhone middleware e2e', () => {
    it('sets req.normalizedPhone and always calls next()', async () => {
        const { default: normalizePhone } = await import('../middleware/normalizePhone.js');
        const req = { body: { phone: '9876543210' }, params: {} };
        const res = mockRes();
        let called = false;
        normalizePhone(req, res, () => { called = true; });
        assert.equal(req.normalizedPhone, '+919876543210');
        assert.equal(called, true);
    });
});
