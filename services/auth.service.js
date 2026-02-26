/**
 * services/auth.service.js — Auth Business Logic
 *
 * Pure functions — no Express objects, fully testable.
 * All DB operations go through the passed pool (dependency injection).
 *
 * Exported functions:
 *   findOrCreateUser(phone, pool)         → user row
 *   issueTokenPair(user, pool)            → { token, refresh_token }
 *   revokeToken(tokenHash, pool)          → void
 *   refreshTokenPair(oldRefreshToken, pool) → { token, refresh_token }
 *   getUserProfile(userId, pool)          → full user + profile object
 */

import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';

// ── Constants ──────────────────────────────────────────────────────────
const JWT_EXPIRY_SECONDS = 30 * 24 * 60 * 60;   // 30 days
const REFRESH_EXPIRY_SECONDS = 90 * 24 * 60 * 60;   // 90 days

function getSecret() {
    return process.env.JWT_SECRET || 'zarva_dev_secret';
}

// ── Token helpers ──────────────────────────────────────────────────────

/** SHA-256 hex of a raw token string — used as auth_tokens.token_hash */
function sha256(raw) {
    return createHash('sha256').update(raw).digest('hex');
}

/**
 * Build and sign a JWT access token.
 * Payload: { userId, roles, active_role }
 *
 * @param {object} user   - { id, role }
 * @returns {string}      - signed JWT
 */
function signJwt(user) {
    const payload = {
        userId: user.id,
        roles: user.role ? [user.role] : [],
        active_role: user.active_role || null,
    };
    return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRY_SECONDS });
}

// ── Core service functions ─────────────────────────────────────────────

/**
 * Find an existing user by phone, or create a new one.
 * Also creates customer_profiles for brand-new users.
 *
 * @param {string} phone  - E.164 normalised phone number
 * @param {object} pool   - mysql2 pool
 * @returns {Promise<object>}  - users row
 */
async function findOrCreateUser(phone, pool) {
    // 1. Try to find existing user
    const [rows] = await pool.query(
        `SELECT id, phone, role, active_role, is_blocked, language_preference, last_login_at
       FROM users WHERE phone = $1 LIMIT 1`,
        [phone],
    );

    if (rows.length > 0) {
        // Update last_login_at
        await pool.query(
            `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
            [rows[0].id],
        );
        return rows[0];
    }

    // 2. Create new user (role defaults to customer, active_role defaults to NULL to force Role Selection)
    const [result] = await pool.query(
        `INSERT INTO users (phone) VALUES ($1) RETURNING id`,
        [phone],
    );
    const userId = result[0]?.id;

    // 3. Create matching customer_profile immediately so name/email updates work.
    await pool.query(
        `INSERT INTO customer_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [userId]
    );

    const [newRows] = await pool.query(
        `SELECT id, phone, role, active_role, is_blocked, language_preference, last_login_at
       FROM users WHERE id = $1 LIMIT 1`,
        [userId],
    );
    return newRows[0];
}

/**
 * Issue a JWT + refresh token pair and persist both in auth_tokens.
 *
 * @param {object} user     - users row { id, role, ... }
 * @param {object} pool     - mysql2 pool
 * @param {object} [meta]   - optional { device_info, ip_address }
 * @returns {Promise<{ token: string, refresh_token: string }>}
 */
async function issueTokenPair(user, pool, meta = {}) {
    const token = signJwt(user);
    const refreshToken = randomUUID();   // opaque random string

    const tokenHash = sha256(token);
    const refreshTokenHash = sha256(refreshToken);

    const accessExpires = new Date(Date.now() + JWT_EXPIRY_SECONDS * 1000);
    const refreshExpires = new Date(Date.now() + REFRESH_EXPIRY_SECONDS * 1000);

    // Store access token
    await pool.query(
        `INSERT INTO auth_tokens
       (user_id, token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenHash, meta.device_info ?? null, meta.ip_address ?? null, accessExpires],
    );

    // Store refresh token (we reuse auth_tokens with a special long expiry)
    await pool.query(
        `INSERT INTO auth_tokens
       (user_id, token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
        [user.id, refreshTokenHash, meta.device_info ?? null, meta.ip_address ?? null, refreshExpires],
    );

    return { token, refresh_token: refreshToken };
}

/**
 * Revoke a token by setting revoked_at = NOW().
 *
 * @param {string} tokenHash - sha256 of the raw token
 * @param {object} pool
 */
async function revokeToken(tokenHash, pool) {
    await pool.query(
        `UPDATE auth_tokens
        SET revoked_at = NOW()
      WHERE token_hash = $1 AND revoked_at IS NULL`,
        [tokenHash],
    );
}

/**
 * Validate an old refresh token, revoke it, and issue a fresh pair.
 *
 * @param {string} oldRefreshToken  - raw (un-hashed) refresh token
 * @param {object} pool
 * @returns {Promise<{ token: string, refresh_token: string }>}
 * @throws {Error}  if token is not found, revoked, or expired
 */
async function refreshTokenPair(oldRefreshToken, pool) {
    const oldHash = sha256(oldRefreshToken);

    const [rows] = await pool.query(
        `SELECT at.id, at.user_id, at.expires_at, at.revoked_at,
            u.id as uid, u.phone, u.role, u.active_role, u.is_blocked, u.language_preference
       FROM auth_tokens at
       JOIN users u ON u.id = at.user_id
      WHERE at.token_hash = $1
      LIMIT 1`,
        [oldHash],
    );

    if (rows.length === 0) throw Object.assign(new Error('Refresh token not found.'), { status: 401 });
    if (rows[0].revoked_at !== null) throw Object.assign(new Error('Refresh token revoked.'), { status: 401 });
    if (new Date(rows[0].expires_at) <= new Date()) {
        throw Object.assign(new Error('Refresh token expired.'), { status: 401 });
    }
    if (rows[0].is_blocked) throw Object.assign(new Error('Account suspended.'), { status: 403 });

    // Revoke old refresh token
    await revokeToken(oldHash, pool);

    const user = { id: rows[0].uid, role: rows[0].role, active_role: rows[0].active_role };
    return issueTokenPair(user, pool);
}

/**
 * Fetch a complete user profile (users + profile sub-table).
 *
 * @param {number|bigint} userId
 * @param {object} pool
 * @returns {Promise<object>}
 */
async function getUserProfile(userId, pool) {
    const [userRows] = await pool.query(
        `SELECT u.id, u.phone, u.role, u.active_role, u.is_blocked, u.language_preference, u.last_login_at, u.created_at, COALESCE(cp.name, wp.name) as global_name, NULL as dob,
            cp.email, cp.profile_s3_key, cp.city,
            cp.default_lat, cp.default_lng, cp.total_jobs as customer_total_jobs,
            cp.average_rating as customer_average_rating, cp.rating_count as customer_rating_count,
            COALESCE(cp.cancelled_jobs, 0) as customer_cancelled_jobs,
            COALESCE(cp.saved_addresses, '[]') as saved_addresses,
            wp.category    as worker_category,
            COALESCE(wp.average_rating, 0) as average_rating, 
            COALESCE(wp.total_jobs, 0) as worker_total_jobs,
            'free' as subscription_status,
            '[]' as skills,
            20 as service_range,
            wp.is_verified, wp.is_online, wp.is_available,
            wp.kyc_status, wp.city as worker_city, wp.current_job_id,
            wp.last_location_lat, wp.last_location_lng,
            (SELECT COALESCE(SUM(ji.subtotal), 0) FROM job_invoices ji JOIN jobs j ON ji.job_id = j.id WHERE j.worker_id = u.id AND j.work_ended_at::date = CURRENT_DATE) as earnings_today,
            (SELECT COUNT(*) FROM jobs WHERE worker_id = u.id AND status = 'completed' AND work_ended_at::date = CURRENT_DATE) as jobs_today,
            (SELECT COUNT(*) FROM jobs WHERE worker_id = u.id AND status = 'completed' AND work_ended_at >= NOW() - INTERVAL '7 days') as jobs_week
       FROM users u
       LEFT JOIN customer_profiles cp ON cp.user_id = u.id
       LEFT JOIN worker_profiles   wp ON wp.user_id = u.id
      WHERE u.id = $1
      LIMIT 1`,
        [userId],
    );

    if (userRows.length === 0) throw Object.assign(new Error('User not found.'), { status: 404 });

    const row = userRows[0];
    const role = row.role;

    const base = {
        id: row.id,
        phone: row.phone,
        name: row.global_name,
        dob: row.dob,
        roles: [role],
        active_role: row.active_role,
        is_blocked: Boolean(row.is_blocked),
        language_preference: row.language_preference,
        last_login_at: row.last_login_at,
        created_at: row.created_at,
    };

    if (role === 'worker') {
        base.profile = {
            category: row.worker_category,
            average_rating: row.average_rating,
            total_jobs: row.worker_total_jobs,
            subscription_status: row.subscription_status,
            skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : (row.skills || []),
            service_range: row.service_range,
            is_verified: Boolean(row.is_verified),
            is_online: Boolean(row.is_online),
            is_available: Boolean(row.is_available),
            kyc_status: row.kyc_status,
            city: row.worker_city,
            current_job_id: row.current_job_id,
            last_location_lat: row.last_location_lat,
            last_location_lng: row.last_location_lng,
            earnings_today: row.earnings_today || 0,
            jobs_today: row.jobs_today || 0,
            jobs_week: row.jobs_week || 0,
        };
    } else {
        base.profile = {
            email: row.email,
            city: row.city,
            total_jobs: row.customer_total_jobs,
            average_rating: row.customer_average_rating,
            rating_count: row.customer_rating_count,
            cancelled_jobs: row.customer_cancelled_jobs,
            saved_addresses: typeof row.saved_addresses === 'string' ? JSON.parse(row.saved_addresses) : (row.saved_addresses || []),
        };
    }

    return base;
}

export {
    findOrCreateUser,
    issueTokenPair,
    revokeToken,
    refreshTokenPair,
    getUserProfile,
    sha256,
};
