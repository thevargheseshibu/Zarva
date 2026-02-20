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
import { getPool } from '../config/database.js';
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

// ── Middleware ─────────────────────────────────────────────────

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticateJWT(req, res, next) {
    try {
        // 1. Extract token
        const authHeader = req.headers['authorization'] ?? '';
        if (!authHeader.startsWith('Bearer ')) {
            return unauthorized(res, 'Missing or malformed Authorization header.');
        }
        const rawToken = authHeader.slice(7).trim();

        // 2. Verify JWT signature & expiry
        let payload;
        try {
            payload = jwt.verify(rawToken, process.env.JWT_SECRET || 'zarva_dev_secret');
        } catch (err) {
            const msg =
                err.name === 'TokenExpiredError'
                    ? 'Token has expired.'
                    : 'Invalid token.';
            return unauthorized(res, msg);
        }

        // 3. Hash and look up in auth_tokens
        const tokenHash = hashToken(rawToken);
        const pool = getPool();

        const [tokenRows] = await pool.query(
            `SELECT id, user_id, expires_at, revoked_at
         FROM auth_tokens
        WHERE token_hash = ?
        LIMIT 1`,
            [tokenHash],
        );

        if (tokenRows.length === 0) {
            return unauthorized(res, 'Token not recognised.');
        }

        const dbToken = tokenRows[0];

        if (dbToken.revoked_at !== null) {
            return unauthorized(res, 'Token has been revoked.');
        }

        if (new Date(dbToken.expires_at) <= new Date()) {
            return unauthorized(res, 'Token has expired.');
        }

        // 4. Load user
        const [userRows] = await pool.query(
            `SELECT id, phone, role, is_blocked
         FROM users
        WHERE id = ?
        LIMIT 1`,
            [dbToken.user_id],
        );

        if (userRows.length === 0) {
            return unauthorized(res, 'User not found.');
        }

        const user = userRows[0];

        // 5. Check block status (always-on if feature flag is set)
        const checkBlocked = isEnabled('security.check_blocked_on_every_request');
        if (checkBlocked && user.is_blocked) {
            return forbidden(res, 'Account suspended.');
        }

        // 6. Attach req.user
        //    roles array derived from the DB role column + any claim in JWT payload
        const roles = payload.roles ?? [user.role];
        const active_role = payload.active_role ?? user.role;

        req.user = {
            id: user.id,
            phone: user.phone,
            roles,
            active_role,
        };

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
