/**
 * normalizePhone — ZARVA Middleware
 *
 * Reads phone from req.body.phone | req.body.phone_number | req.params.phone,
 * normalizes it to E.164 (+91XXXXXXXXXX), and stores it in req.normalizedPhone.
 *
 * NEVER blocks the request — always calls next().
 */

/**
 * Normalize a raw phone string to E.164 (+91XXXXXXXXXX).
 * Returns null if the input cannot be resolved to a valid Indian number.
 *
 * @param {string|undefined} raw
 * @returns {string|null}
 */
export function toE164(raw) {
    if (!raw || typeof raw !== 'string') return null;

    // Strip all whitespace, dashes, dots, parentheses
    const stripped = raw.replace(/[\s\-().]/g, '');

    // Already E.164: +91 followed by exactly 10 digits
    if (/^\+91[6-9]\d{9}$/.test(stripped)) return stripped;

    // Starts with 91 + 10 digits (no leading +)
    if (/^91[6-9]\d{9}$/.test(stripped)) return `+${stripped}`;

    // Bare 10-digit Indian mobile number
    if (/^[6-9]\d{9}$/.test(stripped)) return `+91${stripped}`;

    // Could not normalize
    return null;
}

/**
 * Express middleware.
 * Attaches req.normalizedPhone (string | null).
 * Always calls next() — never returns an error response.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function normalizePhone(req, res, next) {
    const raw =
        req.body?.phone ??
        req.body?.phone_number ??
        req.params?.phone ??
        null;

    req.normalizedPhone = toE164(raw);

    next();
}

export default normalizePhone;
