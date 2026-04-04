/**
 * routes/admin.js
 *
 * Admin root router — gatekeeper for all /api/admin/* routes.
 *
 * Security: every sub-route requires a valid JWT AND the 'admin' or 'superadmin' role.
 * The authenticateJWT middleware is already applied globally in server.js,
 * so we only need to add the role guard here.
 */

import { Router } from 'express';
import roleGuard from '../middleware/roleGuard.js';

// ── Sub-routers ────────────────────────────────────────────────────────────────
import usersRouter     from './admin/users.js';
import jobsRouter      from './admin/jobs.js';
import analyticsRouter from './admin/analytics.js';
import ticketsRouter   from './admin/tickets.js';
import walletRouter    from './admin/wallet.js';
import godModeRouter   from './admin/godMode.js';  // dynamic table PATCH + audit viewer
import configLoader    from '../config/loader.js';

const router = Router();

// 🛡️ SECURITY: All admin routes require admin/superadmin role
router.use(roleGuard(['admin', 'superadmin']));

// ── Domain sub-routers ────────────────────────────────────────────────────────
router.use('/users',     usersRouter);
router.use('/jobs',      jobsRouter);
router.use('/analytics', analyticsRouter);
router.use('/tickets',   ticketsRouter);
router.use('/wallet',    walletRouter);

// God-mode: dynamic table PATCH, audit log viewer, worker approve, density
// mounts at /tables/:table/:id, /workers/:id/approve, /audit-logs
router.use('/', godModeRouter);

// ── Config hot-reload (admin-only utility) ─────────────────────────────────────
router.post('/config/reload', async (req, res) => {
    const { name } = req.query;
    try {
        if (name) {
            const updated = await configLoader.reload(name);
            return res.status(200).json({ status: 'ok', message: `Config "${name}" reloaded`, config: updated });
        }
        await configLoader.loadAllConfigs();
        return res.status(200).json({ status: 'ok', message: 'All configs reloaded', configs: configLoader.loadedNames() });
    } catch (err) {
        console.error('[Admin] Config reload error:', err.message);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

export default router;
