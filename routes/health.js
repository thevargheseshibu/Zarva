/**
 * Health route — GET /api/health
 * Returns server status, loaded config names, and Redis connectivity.
 */

import { Router } from 'express';
import configLoader from '../config/loader.js';
import { getRedisStatus } from '../config/redis.js';

const router = Router();

router.get('/', async (_req, res) => {
    let redisStatus = 'disconnected';
    try {
        redisStatus = await getRedisStatus();
    } catch {
        redisStatus = 'disconnected';
    }

    return res.status(200).json({
        status: 'ok',
        environment: process.env.NODE_ENV || 'development',
        configs: configLoader.loadedNames(),
        redis: redisStatus,
    });
});

export default router;
