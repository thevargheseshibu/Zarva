/**
 * authenticateJWT — ZARVA Middleware
 *
 * Flow:
 *  1. Extract Bearer token from Authorization header
 *  2. Verify JWT signature + expiry with JWT_SECRET
 *  3. SHA-256 hash the raw token → look up auth_tokens row
 *     (must exist, revoked_at IS NULL, expires_at > NOW())
 *  4. Load user row → check is_blocked
 *  5. If features.security.check_blocked_on_every_request is true, enforce block
 *  6. Attach req.user = { id, roles, active_role, phone }
 *
 * Errors:
 *   401 — missing / invalid / expired token, or token revoked in DB
 *   403 — user is blocked
 */

import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import * as dbModule from '../config/database.js';
import { isEnabled } from '../utils/feature.js';

// ── Helpers ────────────────────────────────────────────────────

/** SHA-256 hex hash of the raw JWT string (stored in auth_tokens.token_hash). */
function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

function unauthorized(res, message = 'Authentication required.') {
    return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message });
}

function forbidden(res, message = 'Account suspended.') {
    return res.status(403).json({ status: 'error', code: 'FORBIDDEN', message });
}

// ── Core authenticate logic (exported for unit tests) ─────────────

/**
 * Core authentication logic, separated for testability.
 * @param {string} rawToken         The raw Bearer token string
 * @param {object|null} [pool]      Optional pool override (tests inject a mock pool)
 * @param {object|null} [features]  Optional feature overrides (tests inject flags directly)
 * @returns {Promise<{user: object}|{error: {status: number, code: string, message: string}}>}
 */
export async function authenticate(rawToken, pool = null, features = null) {
    // 1. Verify JWT
    let payload;
    try {
        payload = jwt.verify(rawToken, process.env.JWT_SECRET || 'zarva_dev_secret');
    } catch (err) {
        const msg = err.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.';
        return { error: { status: 401, code: 'UNAUTHORIZED', message: msg } };
    }

    // 2. Hash + DB lookup
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const db = pool ?? dbModule.getPool();

    const [tokenRows] = await db.query(
        `SELECT id, user_id, expires_at, revoked_at FROM auth_tokens WHERE token_hash = ? LIMIT 1`,
        [tokenHash],
    );

    if (tokenRows.length === 0) {
        return { error: { status: 401, code: 'UNAUTHORIZED', message: 'Token not recognised.' } };
    }

    const dbToken = tokenRows[0];

    if (dbToken.revoked_at !== null) {
        return { error: { status: 401, code: 'UNAUTHORIZED', message: 'Token has been revoked.' } };
    }

    if (new Date(dbToken.expires_at) <= new Date()) {
        return { error: { status: 401, code: 'UNAUTHORIZED', message: 'Token has expired.' } };
    }

    // 3. Load user
    const [userRows] = await db.query(
        `SELECT id, phone, role, is_blocked FROM users WHERE id = ? LIMIT 1`,
        [dbToken.user_id],
    );

    if (userRows.length === 0) {
        return { error: { status: 401, code: 'UNAUTHORIZED', message: 'User not found.' } };
    }

    const user = userRows[0];

    // 4. Block check (feature-flagged)
    //    Use injected features object (tests) or live isEnabled() (production)
    const checkBlocked = features
        ? Boolean(features?.security?.check_blocked_on_every_request)
        : isEnabled('security.check_blocked_on_every_request');
    if (checkBlocked && user.is_blocked) {
        return { error: { status: 403, code: 'FORBIDDEN', message: 'Account suspended.' } };
    }

    // 5. Build req.user
    const roles = payload.roles ?? [user.role];
    const active_role = payload.active_role ?? user.role;

    return { user: { id: user.id, phone: user.phone, roles, active_role } };
}

// ── Public paths — skip JWT enforcement ─────────────────────────
//    These paths handle their own auth (OTP flow, refresh, dev-login).
const PUBLIC_PATHS = new Set([
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/refresh-token',
    '/api/auth/dev-login',
    '/api/auth/dev-otp/send',
    '/api/auth/dev-otp/verify',
    '/api/whatsapp/send-otp',
    '/api/whatsapp/verify-otp',
]);

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticateJWT(req, res, next) {
    try {
        // Skip auth for public paths (OTP flow, refresh, dev-login, public worker reviews)
        if (PUBLIC_PATHS.has(req.path) || (req.originalUrl.startsWith('/api/reviews/worker/') && req.method === 'GET')) {
            return next();
        }

        const authHeader = req.headers['authorization'] ?? '';
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 'error',
                code: 'UNAUTHORIZED',
                message: 'Missing or malformed Authorization header.',
            });
        }
        const rawToken = authHeader.slice(7).trim();

        const result = await authenticate(rawToken);

        if (result.error) {
            return res.status(result.error.status).json({
                status: 'error',
                code: result.error.code,
                message: result.error.message,
            });
        }

        req.user = result.user;
        next();
    } catch (err) {
        console.error('[authenticateJWT] Unexpected error:', err.message);
        return res.status(500).json({
            status: 'error',
            code: 'INTERNAL_ERROR',
            message: 'Authentication service error.',
        });
    }
}

export default authenticateJWT;
