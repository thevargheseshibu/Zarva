import { getPool } from '../config/database.js';

class AnalyticsService {
  // Track locations that aren't serviceable (expansion opportunities)
  async logUnserviceableRequest(latitude, longitude, serviceType, district) {
    const pool = getPool();
    try {
      await pool.query(`
        INSERT INTO unserviceable_requests (
          location,
          service_type,
          district,
          nearest_worker_distance_km,
          requested_at
        )
        SELECT 
          ST_GeogFromText($1),
          $2,
          $3,
          MIN(ST_Distance(service_center, ST_GeogFromText($1))) / 1000,
          NOW()
        FROM worker_profiles
        WHERE is_online = true AND kyc_status = 'approved'
      `, [`POINT(${longitude} ${latitude})`, serviceType, district]);
    } catch (e) {
      console.error('[Analytics] Failed to log unserviceable request:', e.message);
    }
  }

  // Get heatmap of unserviced demand
  async getExpansionOpportunities(city) {
    const pool = getPool();
    const query = `
      SELECT 
        ST_AsGeoJSON(location)::json as location,
        COUNT(*) as request_count,
        AVG(nearest_worker_distance_km) as avg_distance,
        service_type
      FROM unserviceable_requests
      WHERE requested_at > NOW() - INTERVAL '30 days'
      GROUP BY location, service_type
      HAVING COUNT(*) > 5
      ORDER BY request_count DESC
    `;

    const [rows] = await pool.query(query);
    return rows;
  }
}

export default new AnalyticsService();
