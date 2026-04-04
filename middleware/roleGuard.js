/**
 * roleGuard — ZARVA Middleware Factory
 *
 * Usage:
 *   router.get('/worker/jobs', authenticateJWT, roleGuard('worker'), handler);
 *
 * Checks:
 *   1. req.user.roles contains requiredRole
 *   2. req.user.active_role === requiredRole
 *
 * Returns 403 if either check fails.
 */

/**
 * @param {string|string[]} requiredRole  'customer' | 'worker' | 'admin' | ['admin','superadmin']
 * @returns {import('express').RequestHandler}
 */
function roleGuard(requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return function (req, res, next) {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                status: 'error',
                code: 'UNAUTHENTICATED',
                message: 'Authentication required.',
            });
        }

        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        const hasRole = allowed.some(r => userRoles.includes(r) || user.active_role === r || user.role === r);

        if (!hasRole) {
            return res.status(403).json({
                status: 'error',
                code: 'FORBIDDEN',
                message: `Access requires one of the following roles: ${allowed.join(', ')}.`,
            });
        }

        next();
    };
}

/**
 * requireAdmin — Flat middleware for admin-only routes.
 * Compatible with Zarva's multi-role auth (roles[] array + active_role).
 * Checked against BOTH the roles array AND the dedicated `role` column (future-proof).
 */
export const requireAdmin = (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ status: 'error', code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    }
    const isAdmin =
        (Array.isArray(user.roles) && user.roles.includes('admin')) ||
        user.active_role === 'admin' ||
        user.role === 'admin';

    if (!isAdmin) {
        console.warn(`[SECURITY] Unauthorized admin access attempt by User ID: ${user.id}`);
        return res.status(403).json({ status: 'error', code: 'FORBIDDEN_ROLE', message: 'Strictly Forbidden: Admin Command Center Access Only' });
    }
    next();
};

export default roleGuard;
