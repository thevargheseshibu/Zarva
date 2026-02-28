/**
 * middleware/reAuthRequired.js
 * Requires re-authentication (PIN or biometric) before sensitive operations like withdrawal.
 * For now, we treat a valid JWT as sufficient; can later add short-lived PIN validation.
 */

/**
 * Middleware that ensures user has re-authenticated recently.
 * Optionally checks for X-Reauth-Token or biometric verification header.
 * Currently: no-op (passes through). Integrate with PIN/biometric flow when available.
 */
export default function reAuthRequired(req, res, next) {
    // Future: validate X-Reauth-Token or session.reauth_at within last N seconds
    next();
}
