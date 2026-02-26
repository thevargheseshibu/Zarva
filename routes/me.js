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

        const conn = await pool.getConnection();
        await conn.query('BEGIN');

        try {
            // 1. Update global user record
            if (language_preference) {
                await conn.query(`UPDATE users SET language_preference = $1 WHERE id = $2`, [language_preference, req.user.id]);
            }

            // 2. Update/Insert Customer Profile (UPSERT)
            if (name || email || city) {
                const cols = ['user_id']; const vals = [req.user.id]; const updates = []; let idx = 2;
                if (name) { cols.push('name'); vals.push(name); updates.push(`name = EXCLUDED.name`); }
                if (email) { cols.push('email'); vals.push(email); updates.push(`email = EXCLUDED.email`); }
                if (city) { cols.push('city'); vals.push(city); updates.push(`city = EXCLUDED.city`); }

                const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
                const sql = `INSERT INTO customer_profiles (${cols.join(', ')}) VALUES (${placeholders}) 
                             ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()`;
                await conn.query(sql, vals);
            }

            // 3. Update Worker Profile (Only if exists, because category is NOT NULL)
            if (name || city) {
                const wUpdates = []; const wVals = []; let wIdx = 1;
                if (name) { wUpdates.push(`name = $${wIdx++}`); wVals.push(name); }
                if (city) { wUpdates.push(`city = $${wIdx++}`); wVals.push(city); }
                if (wUpdates.length > 0) {
                    wVals.push(req.user.id);
                    await conn.query(`UPDATE worker_profiles SET ${wUpdates.join(', ')} WHERE user_id = $${wIdx}`, wVals);
                }
            }

            await conn.query('COMMIT');
        } catch (txnErr) {
            await conn.query('ROLLBACK');
            throw txnErr;
        } finally {
            conn.release();
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

// Update Customer Base Location explicit sync
router.post('/location', async (req, res) => {
    if (!req.user) return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Auth required.' });

    const { address, lat, lng, pincode } = req.body;
    if (!address || lat == null || lng == null) {
        return res.status(400).json({ status: 'error', message: 'Address, lat, and lng are required' });
    }

    try {
        const pool = getPool();
        // UPSERT the location into customer_profiles
        await pool.query(
            `INSERT INTO customer_profiles (user_id, home_address, home_location, current_location, home_pincode)
             VALUES ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326), ST_SetSRID(ST_MakePoint($4, $3), 4326), $5)
             ON CONFLICT (user_id) DO UPDATE 
             SET home_address = EXCLUDED.home_address, 
                 home_location = EXCLUDED.home_location, 
                 current_location = EXCLUDED.current_location,
                 home_pincode = EXCLUDED.home_pincode,
                 updated_at = NOW()`,
            [req.user.id, address, lat, lng, pincode || null]
        );

        return res.status(200).json({ status: 'ok', message: 'Location synced successfully' });
    } catch (err) {
        console.error('[me.js] Location Sync Error:', err);
        return res.status(500).json({ status: 'error', message: 'Failed to sync location' });
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
                `UPDATE users SET active_role = $1, role = $2 WHERE id = $3`, [active_role, active_role, req.user.id]
            );

            if (active_role === 'customer') {
                await conn.query(`INSERT INTO customer_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [req.user.id]
                );
            } else if (active_role === 'worker') {
                await conn.query(`INSERT INTO worker_profiles (user_id, name, category) VALUES ($1, $2, 'Service') ON CONFLICT DO NOTHING`, [req.user.id, profile.name || 'Worker']
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
            `UPDATE users SET fcm_token = $1 WHERE id = $2`,
            [fcm_token, req.user.id]
        );

        return res.status(200).json({ status: 'ok', message: 'FCM token synced successfully' });
    } catch (err) {
        console.error('[me.js] Update FCM Token Error:', err);
        return res.status(500).json({ status: 'error', code: 'UPDATE_FAILED', message: 'Failed to sync FCM token.' });
    }
});

export default router;
