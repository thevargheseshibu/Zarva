/**
 * routes/me.js — GET /api/me
 *
 * Returns the authenticated user's full profile.
 * Protected — requires valid JWT (authenticateJWT applied globally).
 */

import { Router } from 'express';
import { getPool } from '../config/database.js';
import { getUserProfile } from '../services/auth.service.js';

const router = Router();

router.get('/', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            status: 'error',
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
        });
    }

    try {
        const pool = getPool();
        const profile = await getUserProfile(req.user.id, pool);

        return res.status(200).json({
            status: 'ok',
            user: profile,
        });
    } catch (err) {
        const status = err.status ?? 500;
        return res.status(status).json({
            status: 'error',
            code: 'PROFILE_ERROR',
            message: err.message ?? 'Failed to fetch profile.',
        });
    }
});

export default router;
