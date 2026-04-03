/**
 * Admin routes — config hot-reload.
 * POST /api/admin/config/reload          → reload all configs
 * POST /api/admin/config/reload?name=X   → reload a single config
 */

import { Router } from 'express';
import configLoader from '../config/loader.js';
import ticketsRouter from './admin/tickets.js';
import walletAdminRouter from './admin/wallet.js';
import godModeRouter from './admin/godMode.js';

const router = Router();

router.use('/tickets', ticketsRouter);
router.use('/wallet', walletAdminRouter);
router.use('/', godModeRouter);

router.post('/config/reload', async (req, res) => {
    const { name } = req.query;

    try {
        if (name) {
            // Reload a single named config
            const updated = await configLoader.reload(name);
            return res.status(200).json({
                status: 'ok',
                message: `Config "${name}" reloaded`,
                config: updated,
            });
        }

        // Reload all configs
        await configLoader.loadAllConfigs();
        return res.status(200).json({
            status: 'ok',
            message: 'All configs reloaded',
            configs: configLoader.loadedNames(),
        });
    } catch (err) {
        console.error('[Admin] Config reload error:', err.message);
        return res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
});

export default router;
