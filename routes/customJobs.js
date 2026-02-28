import express from 'express';
import { authenticateJWT as authenticateToken } from '../middleware/index.js';
import CustomJobService from '../services/customJob.service.js';

const router = express.Router();

/**
 * POST /api/custom-jobs/templates
 * Create a new custom job template
 */
router.post('/templates', authenticateToken, async (req, res) => {
    try {
        const customerId = req.user.id;
        const result = await CustomJobService.createTemplate(customerId, req.body);
        res.status(201).json(result);
    } catch (error) {
        console.error('Create Custom Template Error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
});

/**
 * GET /api/custom-jobs/templates
 * Get all templates created by the customer
 */
router.get('/templates', authenticateToken, async (req, res) => {
    try {
        const customerId = req.user.id;
        const templates = await CustomJobService.getMyTemplates(customerId);
        res.json(templates);
    } catch (error) {
        console.error('Get Custom Templates Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/custom-jobs/templates/:templateId/post
 * Go live with an approved template
 */
router.post('/templates/:templateId/post', authenticateToken, async (req, res) => {
    try {
        const customerId = req.user.id;
        const { templateId } = req.params;
        const locationData = req.body.location; // Must include { latitude, longitude, address, etc }

        if (!locationData) throw Object.assign(new Error('Location data required to post job'), { status: 400 });

        const result = await CustomJobService.postJobFromTemplate(customerId, templateId, locationData);
        res.status(201).json(result);
    } catch (error) {
        console.error('Post Custom Job Error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
});

/**
 * GET /api/custom-jobs/available
 * Provide active custom jobs nearby to worker feed
 */
router.get('/available', authenticateToken, async (req, res) => {
    try {
        // Assuming worker's latest location is passed as query parameters for accuracy
        const { lat, lng } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Worker location (lat, lng) required' });
        }

        const workerId = req.user.id;
        const jobs = await CustomJobService.getAvailableCustomJobs(workerId, parseFloat(lat), parseFloat(lng));
        res.json(jobs);
    } catch (error) {
        console.error('Get Available Custom Jobs Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
