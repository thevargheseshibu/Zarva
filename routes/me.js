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

    const { language_preference, name, email, city, dob } = req.body;

    try {
        const pool = getPool();
        const profile = await getUserProfile(req.user.id, pool);
        const role = profile.active_role;

        // 1. Update global user record
        const userUpdates = [];
        const userValues = [];

        if (language_preference) {
            userUpdates.push('language_preference = ?');
            userValues.push(language_preference);
        }
        if (name) {
            userUpdates.push('name = ?');
            userValues.push(name);
        }
        if (dob) {
            userUpdates.push('dob = ?');
            userValues.push(dob);
        }

        if (userUpdates.length > 0) {
            userValues.push(req.user.id);
            await pool.query(
                `UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`,
                userValues
            );
        }

        // Fetch refreshed profile to return
        const refreshed = await getUserProfile(req.user.id, pool);

        return res.status(200).json({
            status: 'ok',
            message: 'Profile updated successfully',
            user: refreshed,
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

        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            await conn.query(
                `UPDATE users SET active_role = ?, role = ? WHERE id = ?`,
                [active_role, active_role, req.user.id]
            );

            if (active_role === 'customer') {
                await conn.query(
                    `INSERT IGNORE INTO customer_profiles (user_id) VALUES (?)`,
                    [req.user.id]
                );
            } else if (active_role === 'worker') {
                await conn.query(
                    `INSERT IGNORE INTO worker_profiles (user_id, category) VALUES (?, 'Service')`,
                    [req.user.id]
                );
            }

            await conn.commit();
        } catch (txnErr) {
            await conn.rollback();
            throw txnErr;
        } finally {
            conn.release();
        }

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

router.put('/fcm-token', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const { fcm_token } = req.body;
    if (!fcm_token) {
        return res.status(400).json({ status: 'error', code: 'BAD_REQUEST', message: 'fcm_token is required.' });
    }

    try {
        const pool = getPool();
        await pool.query(
            `UPDATE users SET fcm_token = ? WHERE id = ?`,
            [fcm_token, req.user.id]
        );

        return res.status(200).json({ status: 'ok', message: 'FCM token synced successfully' });
    } catch (err) {
        console.error('[me.js] Update FCM Token Error:', err);
        return res.status(500).json({ status: 'error', code: 'UPDATE_FAILED', message: 'Failed to sync FCM token.' });
    }
});

export default router;
