import { getPool } from '../config/database.js';

class CoverageService {

    // CORE FUNCTION: Check if location is covered by any worker
    async isLocationServiceable(latitude, longitude, serviceType = null) {
        const pool = getPool();
        const point = `POINT(${longitude} ${latitude})`;

        const query = `
        SELECT 
          COUNT(*) as worker_count,
          MIN(ST_Distance(service_center, ST_GeogFromText($1))) / 1000 as nearest_distance_km
        FROM active_worker_coverage
        WHERE 
          ST_Intersects(
            service_area,
            ST_GeogFromText($1)
          )
          ${serviceType ? "AND $2 = ANY(service_types)" : ""}
      `;

        const params = serviceType ? [point, serviceType] : [point];
        const [rows] = await pool.query(query, params);

        const count = parseInt(rows[0].worker_count) || 0;
        let nearestDist = parseFloat(rows[0].nearest_distance_km);

        // If no workers intersect the polygon, calculate absolute nearest to provide useful feedback
        if (count === 0) {
            const nearestQuery = `
            SELECT MIN(ST_Distance(service_center, ST_GeogFromText($1))) / 1000 as nearest_distance_km
            FROM active_worker_coverage
            ${serviceType ? "WHERE $2 = ANY(service_types)" : ""}
          `;
            const [nearestRows] = await pool.query(nearestQuery, params);
            nearestDist = nearestRows[0]?.nearest_distance_km ? parseFloat(nearestRows[0].nearest_distance_km) : null;
        }

        return {
            is_serviceable: count > 0,
            available_workers_count: count,
            nearest_worker_distance_km: nearestDist
        };
    }

    // Find all workers who can service this location
    async getAvailableWorkersForLocation(latitude, longitude, serviceType) {
        const pool = getPool();
        const point = `POINT(${longitude} ${latitude})`;

        const query = `
        SELECT 
          worker_profile_id as id,
          user_id,
          ST_X(service_center::geometry) as center_lng,
          ST_Y(service_center::geometry) as center_lat,
          service_radius_km,
          is_available,
          ST_Distance(service_center, ST_GeogFromText($1)) / 1000 as distance_km,
          service_types,
          ST_Intersects(service_area, ST_GeogFromText($1)) as can_service
        FROM active_worker_coverage
        WHERE 
          ST_Intersects(
            service_area,
            ST_GeogFromText($1)
          )
          AND $2 = ANY(service_types)
        ORDER BY distance_km ASC
        LIMIT 50
      `;

        const [rows] = await pool.query(query, [point, serviceType]);
        return rows;
    }

    // Check if worker's service area covers a specific location
    async doesWorkerCoverLocation(workerId, latitude, longitude) {
        const pool = getPool();
        const point = `POINT(${longitude} ${latitude})`;

        const query = `
        SELECT 
          ST_Intersects(service_area, ST_GeogFromText($1)) as covers_location,
          ST_Distance(service_center, ST_GeogFromText($1)) / 1000 as distance_km
        FROM worker_profiles
        WHERE user_id = $2
      `;

        const [rows] = await pool.query(query, [point, workerId]);
        return rows[0];
    }

    // Get coverage statistics for a city/area
    async getCoverageStats(city) {
        const pool = getPool();
        const query = `
        SELECT 
          COUNT(*) as total_workers,
          COUNT(*) FILTER (WHERE is_available = true) as available_workers,
          AVG(service_radius_km) as avg_radius
        FROM active_worker_coverage
        WHERE city = $1
      `;

        const [rows] = await pool.query(query, [city]);
        return rows[0];
    }

    // Update worker service area (called during onboarding/profile update)
    async updateWorkerServiceArea(userId, centerLat, centerLng, radiusKm) {
        const pool = getPool();
        const point = `POINT(${centerLng} ${centerLat})`;

        const query = `
        UPDATE worker_profiles
        SET 
          service_center = ST_GeogFromText($1),
          service_radius_km = $2,
          home_location = ST_GeogFromText($1),
          updated_at = NOW()
        WHERE user_id = $3
        RETURNING 
          user_id,
          ST_AsGeoJSON(service_area)::json as service_area_geojson
      `;

        const [rows] = await pool.query(query, [point, radiusKm, userId]);

        try {
            await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY active_worker_coverage');
        } catch (e) {
            await pool.query('REFRESH MATERIALIZED VIEW active_worker_coverage');
        }

        return rows[0];
    }
}

export default new CoverageService();
