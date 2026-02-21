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

router.post('/profile', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            status: 'error',
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
        });
    }

    const { language_preference, name, email, city } = req.body;

    try {
        const pool = getPool();

        // Update language preference on global user record
        if (language_preference) {
            await pool.query(
                `UPDATE users SET language_preference = ? WHERE id = ?`,
                [language_preference, req.user.id]
            );
        }

        // Fetch refreshed profile to return
        const profile = await getUserProfile(req.user.id, pool);

        return res.status(200).json({
            status: 'ok',
            message: 'Profile updated successfully',
            user: profile,
        });
    } catch (err) {
        console.error('[me.js] Update Profile Error:', err);
        return res.status(500).json({
            status: 'error',
            code: 'UPDATE_FAILED',
            message: 'Failed to update profile.',
        });
    }
});

router.put('/', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const { active_role } = req.body;
    if (!active_role || (active_role !== 'customer' && active_role !== 'worker')) {
        return res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'Valid active_role is required.' });
    }

    try {
        const pool = getPool();
        const profile = await getUserProfile(req.user.id, pool);

        if (profile.active_role) {
            return res.status(409).json({
                status: 'error',
                code: 'ROLE_ALREADY_SET',
                message: 'Role cannot be changed once selected',
                user: profile
            });
        }

        await pool.query(
            `UPDATE users SET active_role = ?, role = ? WHERE id = ?`,
            [active_role, active_role, req.user.id]
        );

        const updatedProfile = await getUserProfile(req.user.id, pool);

        return res.status(200).json({
            status: 'ok',
            message: 'Role updated successfully',
            user: updatedProfile,
        });

    } catch (err) {
        console.error('[me.js] Update Role Error:', err);
        return res.status(500).json({ status: 'error', code: 'UPDATE_FAILED', message: 'Failed to set active_role.' });
    }
});

export default router;
