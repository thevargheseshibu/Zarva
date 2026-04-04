/**
 * routes/admin/analytics.js
 *
 * Geospatial and operational analytics for the Admin Command Center.
 *
 * GET /api/admin/analytics/worker-density  — Heatmap: supply vs demand coordinates
 * GET /api/admin/analytics/regional-stats  — Bar chart: district-level job pipeline
 * GET /api/admin/analytics/overview        — KPI dashboard numbers
 */

import express from 'express';
import { getPool, handle } from '../../lib/db.js';

const router = express.Router();

/**
 * GET /api/admin/analytics/worker-density
 * Returns Lat/Lng point arrays for the React-Leaflet heatmap.
 *
 * supply → online verified workers with GPS
 * demand → jobs currently searching for a worker
 */
router.get('/worker-density', handle(async (adminId, pool) => {
    // Workers — try PostGIS first, fall back to flat lat/lng columns
    const [workers] = await pool.query(`
        SELECT
            user_id, category,
            COALESCE(last_location_lat, ST_Y(current_location::geometry))  AS lat,
            COALESCE(last_location_lng, ST_X(current_location::geometry))  AS lng
        FROM worker_profiles
        WHERE is_online = true
          AND is_verified = true
          AND (
              last_location_lat IS NOT NULL
              OR current_location IS NOT NULL
          )
    `).catch(() =>
        // Graceful fallback if PostGIS extension is unavailable
        pool.query(`
            SELECT user_id, category, last_location_lat AS lat, last_location_lng AS lng
            FROM worker_profiles
            WHERE is_online = true AND is_verified = true AND last_location_lat IS NOT NULL
        `)
    );

    const [jobs] = await pool.query(`
        SELECT id, category, hourly_rate, latitude AS lat, longitude AS lng
        FROM jobs
        WHERE status = 'searching'
          AND latitude  IS NOT NULL
          AND longitude IS NOT NULL
    `);

    return {
        heatmaps: {
            workers: (Array.isArray(workers) ? workers : workers[0]).filter(w => w.lat && w.lng),
            demand:  jobs[0]?.length !== undefined ? jobs[0].filter(j => j.lat && j.lng) : jobs.filter(j => j.lat && j.lng),
        },
    };
}));


/**
 * GET /api/admin/analytics/regional-stats
 * Returns per-district job counts for the Bar Chart component.
 * Covers the last 24 hours by default.
 */
router.get('/regional-stats', handle(async (adminId, pool, req) => {
    const { hours = 24 } = req.query;
    const safeHours = Math.min(Math.max(parseInt(hours, 10) || 24, 1), 720); // cap 1h–30d

    const [stats] = await pool.query(`
        SELECT
            COALESCE(district, city, 'Unknown') AS district,
            COUNT(*)                                                           AS total_jobs,
            COUNT(*) FILTER (WHERE status = 'searching')                      AS pending_jobs,
            COUNT(*) FILTER (WHERE status IN ('assigned','in_progress'))      AS active_jobs,
            COUNT(*) FILTER (WHERE status = 'completed')                      AS completed_jobs,
            COALESCE(SUM(final_amount) FILTER (WHERE status = 'completed'), 0) AS revenue
        FROM jobs
        WHERE created_at >= NOW() - INTERVAL '${safeHours} hours'
        GROUP BY COALESCE(district, city, 'Unknown')
        ORDER BY total_jobs DESC
        LIMIT 20
    `);

    return { regional_stats: stats };
}));


/**
 * GET /api/admin/analytics/overview
 * High-level KPI numbers for the Command Center dashboard cards.
 */
router.get('/overview', handle(async (adminId, pool) => {
    const [[totals], [workers], [revenue]] = await Promise.all([
        pool.query(`
            SELECT
                COUNT(*)                                               AS total_jobs,
                COUNT(*) FILTER (WHERE status = 'searching')          AS jobs_searching,
                COUNT(*) FILTER (WHERE status = 'in_progress')        AS jobs_active,
                COUNT(*) FILTER (WHERE status = 'completed'
                                   AND job_ended_at >= CURRENT_DATE)  AS jobs_completed_today
            FROM jobs
        `),
        pool.query(`
            SELECT
                COUNT(*)                                               AS total_workers,
                COUNT(*) FILTER (WHERE is_online = true)              AS online,
                COUNT(*) FILTER (WHERE kyc_status = 'pending_review')   AS kyc_pending,
                COUNT(*) FILTER (WHERE is_verified = false
                                   AND kyc_status != 'pending_review')       AS unverified
            FROM worker_profiles
        `),
        pool.query(`
            SELECT
                COALESCE(SUM(final_amount) FILTER (WHERE job_ended_at >= CURRENT_DATE), 0)             AS revenue_today,
                COALESCE(SUM(final_amount) FILTER (WHERE job_ended_at >= date_trunc('month', NOW())), 0) AS revenue_month
            FROM jobs
            WHERE status = 'completed'
        `),
    ]);

    return {
        overview: {
            jobs:    totals[0],
            workers: workers[0],
            revenue: revenue[0],
        },
    };
}));

export default router;
