/**
 * routes/auth.js — Authentication Endpoints
 *
 * Mounted at /api/auth in server.js (public — JWT auth skipped for these paths).
 *
 * POST /send-otp        — trigger Firebase phone OTP (or no-op in dev)
 * POST /verify-otp      — verify Firebase ID token, return JWT pair
 * POST /refresh-token   — swap refresh token for new JWT pair
 * POST /logout          — revoke current access token
 * POST /dev-login       — dev-only bypass (NODE_ENV=development)
 * GET  /me              — mounted at /api/me (authenticated)
 */

import { Router } from 'express';
import { createHash } from 'node:crypto';
import { getPool } from '../config/database.js';
import { verifyIdToken } from '../config/firebase.js';
import { otpLimiter, normalizePhone } from '../middleware/index.js';
import { isEnabled } from '../utils/feature.js';
import {
    findOrCreateUser,
    issueTokenPair,
    revokeToken,
    refreshTokenPair,
    getUserProfile,
    sha256,
} from '../services/auth.service.js';

const router = Router();
const IS_DEV = (process.env.NODE_ENV || 'development') === 'development';

// ── Helpers ────────────────────────────────────────────────────────────

function ok(res, data, status = 200) {
    return res.status(status).json({ status: 'ok', ...data });
}

function fail(res, message, status = 400, code = 'BAD_REQUEST') {
    return res.status(status).json({ status: 'error', code, message });
}

function extractToken(req) {
    const header = req.headers['authorization'] ?? '';
    return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

// ── POST /send-otp ─────────────────────────────────────────────────────
// Apply normalizePhone then otpLimiter (key = req.normalizedPhone)
router.post(
    '/send-otp',
    normalizePhone,
    otpLimiter,
    async (req, res) => {
        const phone = req.normalizedPhone;
        if (!phone) {
            return fail(res, 'Valid Indian phone number required.', 400, 'INVALID_PHONE');
        }

        const isBypassed = !isEnabled('auth.phone_otp_enabled');
        if (!isBypassed) {
            // Real mode: Firebase triggers the OTP SMS itself via client SDK;
            // server-side we just acknowledge. (Firebase REST trigger optional.)
            console.log(`[Auth] OTP requested for ${phone}`);
        } else {
            // Dev mode — OTP skipped entirely; use dev-login or verify-otp with mock token
            console.log(`[Auth][DEV] phone_otp_enabled=false — OTP skipped for ${phone}`);
        }

        // NEVER reveal whether the phone exists in DB (security spec)
        return ok(res, { message: 'OTP sent', expires_in: 300, bypassed: isBypassed });
    },
);

// ── POST /verify-otp ───────────────────────────────────────────────────
router.post('/verify-otp', normalizePhone, async (req, res) => {
    const phone = req.normalizedPhone;
    const { firebase_id_token } = req.body ?? {};

    if (!phone) {
        return fail(res, 'Valid Indian phone number required.', 400, 'INVALID_PHONE');
    }

    const otpEnabled = isEnabled('auth.phone_otp_enabled');

    if (otpEnabled) {
        // Verify Firebase ID token
        if (!firebase_id_token) {
            return fail(res, 'firebase_id_token is required.', 400, 'MISSING_TOKEN');
        }

        let decoded;
        try {
            decoded = await verifyIdToken(firebase_id_token);
        } catch (err) {
            console.error('[Auth] Firebase token verification failed:', err.message);
            return fail(res, 'Invalid or expired Firebase token.', 401, 'FIREBASE_TOKEN_INVALID');
        }

        if (!decoded) {
            return fail(res, 'Firebase not configured on server.', 503, 'FIREBASE_UNAVAILABLE');
        }

        // Phone in token must match the request phone
        const tokenPhone = decoded.phone_number;
        if (tokenPhone !== phone) {
            return fail(res, 'Phone number mismatch.', 400, 'PHONE_MISMATCH');
        }
    }

    try {
        const pool = getPool();
        const user = await findOrCreateUser(phone, pool);

        // Issue token even for blocked users so the app can show BlockedScreen with reason.
        // The middleware enforces the block on all other API calls.
        const isSuspended = Boolean(user.is_blocked);

        const meta = {
            device_info: req.headers['user-agent'] ?? null,
            ip_address: req.ip ?? null,
        };
        const { token, refresh_token } = await issueTokenPair(user, pool, meta);

        return ok(res, {
            token,
            refresh_token,
            user: {
                id: user.id,
                phone: user.phone,
                name: user.name,
                dob: user.dob,
                roles: user.role ? [user.role] : [],
                active_role: user.active_role || null,
                is_blocked: isSuspended,
                block_reason: user.block_reason || null,
                onboarding_complete: Boolean(user.onboarding_complete),
            },
        }, 200);
    } catch (err) {
        console.error('[Auth] verify-otp error:', err.message);
        return fail(res, 'Authentication failed.', 500, 'AUTH_ERROR');
    }
});

// ── POST /refresh-token ────────────────────────────────────────────────
router.post('/refresh-token', async (req, res) => {
    const { refresh_token } = req.body ?? {};

    if (!refresh_token || typeof refresh_token !== 'string') {
        return fail(res, 'refresh_token is required.', 400, 'MISSING_TOKEN');
    }

    try {
        const pool = getPool();
        const { token, refresh_token: newRefresh } = await refreshTokenPair(refresh_token, pool);
        return ok(res, { token, refresh_token: newRefresh });
    } catch (err) {
        const status = err.status ?? 401;
        return fail(res, err.message, status, 'TOKEN_ERROR');
    }
});

// ── POST /logout ───────────────────────────────────────────────────────
// NOTE: This route is behind authenticateJWT globally via server.js,
// but we also handle the case where no token is present gracefully.
router.post('/logout', async (req, res) => {
    const rawToken = extractToken(req);
    if (!rawToken) {
        return fail(res, 'No token provided.', 400, 'MISSING_TOKEN');
    }

    try {
        const pool = getPool();
        const tokenHash = sha256(rawToken);
        await revokeToken(tokenHash, pool);
        return ok(res, { message: 'Logged out successfully.' });
    } catch (err) {
        console.error('[Auth] logout error:', err.message);
        return fail(res, 'Logout failed.', 500, 'LOGOUT_ERROR');
    }
});

// ── DEV TEST PHONE HELPERS ─────────────────────────────────────────────
function getTestPhoneMap() {
    let raw = process.env.TEST_PHONE_NUMBERS || '';
    const map = new Map();

    // Clean up array brackets and quotes if present e.g. "['9746020743:123456']"
    raw = raw.replace(/[\[\]'"]/g, '');

    raw.split(',').forEach(pair => {
        const [phone, otp] = pair.trim().split(':');
        if (phone && otp) map.set(phone.trim(), otp.trim());
    });
    return map;
}

// ── POST /dev-otp/send ─────────────────────────────────────────────────
// Mobile calls this when Firebase is blocked (emulator/missing-client-identifier).
// Server checks if the number is a known test number.
// Returns: { isTestNumber: true } or { isTestNumber: false }
// No OTP code is ever sent to mobile — client stays blind.
router.post('/dev-otp/send', normalizePhone, async (req, res) => {
    if (!IS_DEV) {
        return fail(res, 'Not available in production.', 403, 'FORBIDDEN');
    }

    const phone = req.normalizedPhone;
    if (!phone) {
        return fail(res, 'Valid Indian phone number required.', 400, 'INVALID_PHONE');
    }

    const bare = phone.replace('+91', '').replace(/\s/g, '');
    const testPhones = getTestPhoneMap();
    const isTestNumber = testPhones.has(bare);

    console.log(`[Auth][DEV] dev-otp/send — phone=${phone} isTestNumber=${isTestNumber}`);
    return ok(res, { isTestNumber });
});

// ── POST /dev-otp/verify ───────────────────────────────────────────────
// Mobile sends the OTP the user typed. Server validates it against the config.
// Returns JWT on success, 401 on wrong OTP.
router.post('/dev-otp/verify', normalizePhone, async (req, res) => {
    if (!IS_DEV) {
        return fail(res, 'Not available in production.', 403, 'FORBIDDEN');
    }

    const phone = req.normalizedPhone;
    const { otp } = req.body ?? {};

    if (!phone) {
        return fail(res, 'Valid Indian phone number required.', 400, 'INVALID_PHONE');
    }
    if (!otp) {
        return fail(res, 'otp is required.', 400, 'MISSING_OTP');
    }

    const bare = phone.replace('+91', '').replace(/\s/g, '');
    const testPhones = getTestPhoneMap();

    if (!testPhones.has(bare)) {
        return fail(res, 'Not a test phone number.', 400, 'NOT_TEST_NUMBER');
    }

    const expectedOtp = testPhones.get(bare);
    if (otp !== expectedOtp) {
        console.warn(`[Auth][DEV] dev-otp/verify — wrong OTP for ${phone}`);
        return fail(res, 'Invalid OTP.', 401, 'INVALID_OTP');
    }

    console.log(`[Auth][DEV] dev-otp/verify — success for ${phone}`);

    try {
        const pool = getPool();
        const user = await findOrCreateUser(phone, pool);

        // Issue token even for blocked users so the app can show BlockedScreen with reason.
        const isSuspended = Boolean(user.is_blocked);

        const meta = {
            device_info: req.headers['user-agent'] ?? null,
            ip_address: req.ip ?? null,
        };
        const { token, refresh_token } = await issueTokenPair(user, pool, meta);

        return ok(res, {
            token,
            refresh_token,
            user: {
                id: user.id,
                phone: user.phone,
                name: user.name,
                dob: user.dob,
                roles: user.role ? [user.role] : [],
                active_role: user.active_role || null,
                is_blocked: isSuspended,
                block_reason: user.block_reason || null,
                onboarding_complete: Boolean(user.onboarding_complete),
            },
        });
    } catch (err) {
        console.error('[Auth] dev-otp/verify error:', err.message);
        return fail(res, 'Authentication failed.', 500, 'AUTH_ERROR');
    }
});

// ── POST /dev-login ────────────────────────────────────────────────────
router.post('/dev-login', normalizePhone, async (req, res) => {
    if (!IS_DEV) {
        return fail(res, 'Dev login is only available in development mode.', 403, 'FORBIDDEN');
    }

    console.warn('⚠️  DEV LOGIN USED — disable in production');

    const phone = req.normalizedPhone;
    if (!phone) {
        return fail(res, 'Valid Indian phone number required.', 400, 'INVALID_PHONE');
    }

    try {
        const pool = getPool();
        const user = await findOrCreateUser(phone, pool);

        // Issue token even for blocked users so app can show BlockedScreen.
        const isSuspended = Boolean(user.is_blocked);

        const meta = {
            device_info: req.headers['user-agent'] ?? null,
            ip_address: req.ip ?? null,
        };
        const { token, refresh_token } = await issueTokenPair(user, pool, meta);

        return ok(res, {
            token,
            refresh_token,
            user: {
                id: user.id,
                phone: user.phone,
                name: user.name,
                dob: user.dob,
                roles: [user.role],
                active_role: user.role,
                is_blocked: isSuspended,
                block_reason: user.block_reason || null,
                onboarding_complete: Boolean(user.onboarding_complete),
            },
        });
    } catch (err) {
        console.error('[Auth] dev-login error:', err.message);
        return fail(res, 'Dev login failed.', 500, 'AUTH_ERROR');
    }
});

export default router;
