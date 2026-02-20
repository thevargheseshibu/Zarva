/**
 * rateLimiter — ZARVA Middleware
 *
 * Three pre-configured rate limiters using express-rate-limit + rate-limit-redis.
 *
 *  generalLimiter    — 60 req/min  per IP         (global API guard)
 *  otpLimiter        — 3  req/hr   per phone       (zarva:otp_rate:{phone})
 *  jobCreateLimiter  — 5  req/hr   per user ID     (zarva:job_rate:{userId})
 *
 * In NODE_ENV=development all limiters are passthrough (no-op).
 * Limits are read from features.rate_limiting.* so they can be overridden live.
 */

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
// Import ipKeyGenerator from express-rate-limit
import { ipKeyGenerator } from 'express-rate-limit';
import { getRedisClient } from '../config/redis.js';
import { getFeatureValue } from '../utils/feature.js';

const IS_DEV = (process.env.NODE_ENV || 'development') === 'development';

/** No-op passthrough used when rate limiting is disabled in development. */
const passthrough = (_req, _res, next) => next();

// ── Redis store factory ────────────────────────────────────────

/**
 * Build a RedisStore for express-rate-limit.
 * Prefix uniquely namespaces each limiter's keys.
 *
 * @param {string} prefix  Redis key prefix
 */
function makeRedisStore(prefix) {
    return new RedisStore({
        sendCommand: (...args) => getRedisClient().call(...args),
        prefix,
    });
}

// ── Limiter factory ────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string}   opts.prefix        Redis key prefix
 * @param {number}   opts.windowMs      Time window in milliseconds
 * @param {number}   opts.max           Max requests per window
 * @param {string}   [opts.message]     Message on limit exceeded
 * @param {function} [opts.keyGenerator] Custom key generator
 */
function makeLimiter({ prefix, windowMs, max, message, keyGenerator }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,   // Return RateLimit-* headers
        legacyHeaders: false,
        store: makeRedisStore(prefix),
        keyGenerator: keyGenerator ?? ipKeyGenerator,
        handler(_req, res) {
            res.status(429).json({
                status: 'error',
                code: 'RATE_LIMITED',
                message: message ?? 'Too many requests. Please try again later.',
            });
        },
        skip: () => false,
    });
}

// ── Exported limiters ──────────────────────────────────────────

/**
 * General API rate limiter: 60 req/min per IP.
 * Applied globally in app.js.
 */
export const generalLimiter = IS_DEV
    ? passthrough
    : makeLimiter({
        prefix: 'zarva:api_rate:',
        windowMs: 60 * 1000,
        max: getFeatureValue('rate_limiting.api_requests_per_minute', 60),
        message: 'API rate limit exceeded. Try again in a minute.',
    });

/**
 * OTP send rate limiter: 3 req/hr per normalised phone number.
 * Key: zarva:otp_rate:{phone}
 * Applied on POST /api/auth/send-otp
 * Note: Enforced even in dev mode to allow local testing of OTP limits.
 */
export const otpLimiter = makeLimiter({
    prefix: 'zarva:otp_rate:',
    windowMs: 60 * 60 * 1000,
    max: getFeatureValue('rate_limiting.otp_per_phone_per_hour', 3),
    message: 'OTP limit reached. Maximum 3 OTPs per phone per hour.',
    keyGenerator(req) {
        // Prefer normalizedPhone (set by normalizePhone middleware);
        // fall back to raw body value so the limiter works even without the mw.
        return (
            req.normalizedPhone ??
            req.body?.phone ??
            req.body?.phone_number ??
            ipKeyGenerator(req)
        );
    },
});

/**
 * Job creation rate limiter: 5 req/hr per authenticated user ID.
 * Key: zarva:job_rate:{userId}
 * Applied on POST /api/jobs
 */
export const jobCreateLimiter = IS_DEV
    ? passthrough
    : makeLimiter({
        prefix: 'zarva:job_rate:',
        windowMs: 60 * 60 * 1000,
        max: getFeatureValue('rate_limiting.job_create_per_hour', 5),
        message: 'Job creation limit reached. Maximum 5 jobs per hour.',
        keyGenerator(req) {
            return req.user?.id ? String(req.user.id) : ipKeyGenerator(req);
        },
    });
