import { Router } from 'express';
import coverageService from '../services/coverage.service.js';

const router = Router();

// Helper to quickly bail out or succeed
const ok = (res, data, status = 200) => res.status(status).json({ status: 'ok', ...data });
const fail = (res, message, status = 400, code = 'BAD_REQUEST') => res.status(status).json({ status: 'error', code, message });

/**
 * Check if a location is serviceable
 * POST /api/coverage/check
 */
router.post('/check', async (req, res) => {
    try {
        const { latitude, longitude, service_type } = req.body;

        if (latitude == null || longitude == null) {
            return fail(res, 'Latitude and longitude are required');
        }

        const coverage = await coverageService.isLocationServiceable(latitude, longitude, service_type);
        return ok(res, coverage);
    } catch (err) {
        console.error('[CoverageRoute] /check error:', err);
        return fail(res, 'Failed to verify coverage', 500, 'SERVER_ERROR');
    }
});

/**
 * Get map data for visualization
 * POST /api/coverage/map-data
 */
router.post('/map-data', async (req, res) => {
    try {
        const { latitude, longitude, service_type } = req.body;

        if (latitude == null || longitude == null) {
            return fail(res, 'Latitude and longitude are required');
        }

        const workers = await coverageService.getAvailableWorkersForLocation(latitude, longitude, service_type);
        return ok(res, { workers });
    } catch (err) {
        console.error('[CoverageRoute] /map-data error:', err);
        return fail(res, 'Failed to fetch map data', 500, 'SERVER_ERROR');
    }
});

export default router;
