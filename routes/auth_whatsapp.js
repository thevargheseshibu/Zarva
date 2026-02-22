/**
 * routes/auth_whatsapp.js — WhatsApp OTP Authentication Endpoints
 *
 * Maintains a complete separation of concerns from the Firebase SMS flow.
 * Uses Redis to store the 6-digit OTP temporarily.
 *
 * POST /api/whatsapp/send-otp
 * POST /api/whatsapp/verify-otp
 */

import { Router } from 'express';
import { getPool } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import { sendWhatsAppOTP } from '../services/whatsapp.service.js';
import { otpLimiter, normalizePhone } from '../middleware/index.js';
import { findOrCreateUser, issueTokenPair } from '../services/auth.service.js';

const router = Router();
const REDIS_OTP_PREFIX = 'wa_otp:';
const OTP_TTL_SECONDS = 300; // 5 minutes

// ── Helpers ────────────────────────────────────────────────────────────

function ok(res, data, status = 200) {
    return res.status(status).json({ status: 'ok', ...data });
}

function fail(res, message, status = 400, code = 'BAD_REQUEST') {
    return res.status(status).json({ status: 'error', code, message });
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

// ── POST /send-otp ─────────────────────────────────────────────────────
router.post('/send-otp', normalizePhone, otpLimiter, async (req, res) => {
    const phone = req.normalizedPhone;
    if (!phone) {
        return fail(res, 'Valid Indian phone number required.', 400, 'INVALID_PHONE');
    }

    try {
        const otpCode = generateOTP();
        const redisClient = getRedisClient();

        // Save to Redis: wa_otp:+919999999999
        await redisClient.setex(`${REDIS_OTP_PREFIX}${phone}`, OTP_TTL_SECONDS, otpCode);

        console.log(`[WhatsApp Auth] Generated OTP for ${phone}: ${otpCode}`);

        // Dispatch via WhatsApp API
        await sendWhatsAppOTP(phone, otpCode);

        // DEV ONLY: Return the OTP in the response if in development mode
        const isDev = (process.env.NODE_ENV || 'development') === 'development';

        return ok(res, {
            message: 'WhatsApp OTP sent successfully',
            expires_in: OTP_TTL_SECONDS,
            ...(isDev && { dev_otp: otpCode }) // Helpful for testing if WhatsApp API errors out
        });
    } catch (err) {
        console.error('[WhatsApp Auth] Send OTP Error:', err);
        const status = err.status || 500;
        const msg = err.message || 'Failed to send WhatsApp OTP.';
        // If it's a known dispatch error, we use the specific code or a general fallback
        const code = err.code || 'WHATSAPP_ERROR';

        return fail(res, msg, status, code);
    }
});

// ── POST /verify-otp ───────────────────────────────────────────────────
router.post('/verify-otp', normalizePhone, async (req, res) => {
    const phone = req.normalizedPhone;
    const { otp } = req.body ?? {};

    if (!phone) {
        return fail(res, 'Valid Indian phone number required.', 400, 'INVALID_PHONE');
    }

    if (!otp || typeof otp !== 'string' || otp.length !== 6) {
        return fail(res, 'Valid 6-digit OTP required.', 400, 'INVALID_OTP');
    }

    try {
        const redisClient = getRedisClient();
        const redisKey = `${REDIS_OTP_PREFIX}${phone}`;
        const storedOtp = await redisClient.get(redisKey);

        if (!storedOtp) {
            return fail(res, 'OTP has expired or was never requested.', 400, 'OTP_EXPIRED');
        }

        if (storedOtp !== otp) {
            return fail(res, 'Incorrect OTP.', 401, 'OTP_MISMATCH');
        }

        // OTP Validated successfully! Clean up Redis immediately to prevent reuse.
        await redisClient.del(redisKey);

        // Issue token pair
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
        console.error('[WhatsApp Auth] Verify OTP Error:', err);
        return fail(res, 'Failed to verify WhatsApp OTP.', 500, 'VERIFY_ERROR');
    }
});

export default router;
