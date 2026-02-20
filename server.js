/**
 * Zarva API Server — Entry Point
 * ES Module, Node.js >= 20.6
 */

import dotenv from 'dotenv';
// Load .env.development in dev, .env otherwise
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}`, override: false });
dotenv.config({ override: false }); // fallback to plain .env

import express from 'express';

import configLoader from './config/loader.js';
import { getPool } from './config/database.js';
import { connectRedis } from './config/redis.js';
import healthRouter from './routes/health.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import meRouter from './routes/me.js';
import uploadsRouter from './routes/uploads.js';
import workerRouter from './routes/worker.js';
import jobsRouter from './routes/jobs.js';
import {
    generalLimiter,
    authenticateJWT,
    normalizePhone,
} from './middleware/index.js';

const PORT = Number(process.env.PORT) || 3000;
const ENV = process.env.NODE_ENV || 'development';

async function bootstrap() {
    // 1. Load all configs (JSON files + DB overrides)
    // Wire in DB pool for override support, then load
    const pool = getPool();
    configLoader.setPool(pool);
    await configLoader.loadAllConfigs();

    // 2. Connect Redis (non-blocking — server starts even if Redis is down)
    await connectRedis();

    // 3. Create Express app
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // ── Global middleware (order matters) ─────────────────────
    // Rate limit first — cheapest check, no DB hit
    app.use(generalLimiter);
    // JWT auth — verifies token, attaches req.user
    app.use(authenticateJWT);
    // Phone normalisation — populates req.normalizedPhone (never blocks)
    app.use(normalizePhone);
    // roleGuard is NOT global — apply per-route: roleGuard('worker')

    // 4. Mount routes
    app.use('/api/health', healthRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/auth', authRouter);   // public — skip-listed in authenticateJWT
    app.use('/api/me', meRouter);     // protected — requires valid JWT
    app.use('/api/uploads', uploadsRouter); // protected — requires valid JWT
    app.use('/api/worker', workerRouter);   // protected — requires valid JWT
    app.use('/api/jobs', jobsRouter);       // protected — requires valid JWT

    // 5. 404 handler
    app.use((_req, res) => {
        res.status(404).json({ status: 'error', message: 'Route not found' });
    });

    // 6. Global error handler
    app.use((err, _req, res, _next) => {
        console.error('[Server] Unhandled error:', err);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    });

    // 7. Start listening
    app.listen(PORT, () => {
        console.log(`[Server] Zarva API running on port ${PORT} (${ENV})`);
    });
}

bootstrap().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
});
