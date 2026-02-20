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
 * @param {string} requiredRole  'customer' | 'worker' | 'admin'
 * @returns {import('express').RequestHandler}
 */
function roleGuard(requiredRole) {
    return function (req, res, next) {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                status: 'error',
                code: 'UNAUTHENTICATED',
                message: 'Authentication required.',
            });
        }

        const hasRole = Array.isArray(user.roles) && user.roles.includes(requiredRole);
        const isActiveRole = user.active_role === requiredRole;

        if (!hasRole || !isActiveRole) {
            return res.status(403).json({
                status: 'error',
                code: 'FORBIDDEN',
                message: `Access requires the '${requiredRole}' role.`,
            });
        }

        next();
    };
}

export default roleGuard;
