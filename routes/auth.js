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

        if (isEnabled('auth.phone_otp_enabled')) {
            // Real mode: Firebase triggers the OTP SMS itself via client SDK;
            // server-side we just acknowledge. (Firebase REST trigger optional.)
            console.log(`[Auth] OTP requested for ${phone}`);
        } else {
            // Dev mode — OTP skipped entirely; use dev-login or verify-otp with mock token
            console.log(`[Auth][DEV] phone_otp_enabled=false — OTP skipped for ${phone}`);
        }

        // NEVER reveal whether the phone exists in DB (security spec)
        return ok(res, { message: 'OTP sent', expires_in: 300 });
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

        if (user.is_blocked) {
            return fail(res, 'Account suspended.', 403, 'ACCOUNT_BLOCKED');
        }

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
                roles: [user.role],
                active_role: user.role,
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

        if (user.is_blocked) {
            return fail(res, 'Account suspended.', 403, 'ACCOUNT_BLOCKED');
        }

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
                roles: [user.role],
                active_role: user.role,
            },
        });
    } catch (err) {
        console.error('[Auth] dev-login error:', err.message);
        return fail(res, 'Dev login failed.', 500, 'AUTH_ERROR');
    }
});

export default router;
