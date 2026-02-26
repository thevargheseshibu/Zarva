import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function applyCoveragePatch() {
    const pool = getPool();
    try {
        console.log("--- APPLYING COVERAGE SCHEMA PATCH ---");

        // 1. Add fields to worker_profiles
        const alterWorkerProfiles = `
            ALTER TABLE worker_profiles
            ADD COLUMN IF NOT EXISTS service_center GEOGRAPHY(Point, 4326) NULL,
            ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC(5,2) NOT NULL DEFAULT 5.00,
            ADD COLUMN IF NOT EXISTS service_area GEOGRAPHY(Polygon, 4326) NULL,
            ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ NULL,
            ADD COLUMN IF NOT EXISTS service_types TEXT[] NOT NULL DEFAULT '{}';
        `;
        await pool.query(alterWorkerProfiles);
        console.log("Added coverage fields to worker_profiles.");

        // 2. Add spatial indexes
        try {
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_worker_service_area ON worker_profiles USING GIST(service_area)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_worker_service_center ON worker_profiles USING GIST(service_center)`);
            console.log("Created spatial indexes on worker_profiles.");
        } catch (e) { console.log("Indexes might exist:", e.message); }

        // 3. Create Trigger Function and Trigger
        const createTrigger = `
            CREATE OR REPLACE FUNCTION update_service_area()
            RETURNS TRIGGER AS $$
            BEGIN
              IF NEW.service_center IS NOT NULL THEN
                NEW.service_area = ST_Buffer(
                  NEW.service_center::geography,
                  NEW.service_radius_km * 1000  -- Convert km to meters
                )::geography;
              ELSE
                NEW.service_area = NULL;
              END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            
            DROP TRIGGER IF EXISTS worker_service_area_trigger ON worker_profiles;
            CREATE TRIGGER worker_service_area_trigger
            BEFORE INSERT OR UPDATE OF service_center, service_radius_km
            ON worker_profiles
            FOR EACH ROW
            EXECUTE FUNCTION update_service_area();
        `;
        await pool.query(createTrigger);
        console.log("Created trigger update_service_area on worker_profiles.");

        // 4. Create unserviceable_requests table
        const createUnserviceableTable = `
            CREATE TABLE IF NOT EXISTS unserviceable_requests (
              id                          BIGSERIAL PRIMARY KEY,
              location                    GEOGRAPHY(Point, 4326) NOT NULL,
              service_type                VARCHAR(64)         NULL,
              nearest_worker_distance_km  NUMERIC(10,2)       NULL,
              requested_at                TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_unserviceable_loc ON unserviceable_requests USING GIST(location);
            CREATE INDEX IF NOT EXISTS idx_unserviceable_time ON unserviceable_requests(requested_at);
        `;
        await pool.query(createUnserviceableTable);
        console.log("Created table unserviceable_requests.");

        // 5. Create Materialized View
        const createMaterializedView = `
            CREATE MATERIALIZED VIEW IF NOT EXISTS active_worker_coverage AS
            SELECT 
              user_id as worker_profile_id,
              user_id,
              service_center,
              service_area,
              service_radius_km,
              service_types,
              city,
              is_available
            FROM worker_profiles
            WHERE is_online = true AND kyc_status = 'approved';
            
            CREATE INDEX IF NOT EXISTS idx_active_coverage_area ON active_worker_coverage USING GIST(service_area);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_active_coverage_uid ON active_worker_coverage(user_id);
        `;
        await pool.query(createMaterializedView);
        console.log("Created materialized view active_worker_coverage.");

        console.log("--- COVERAGE PATCH COMPLETE ---");
    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        await pool.end();
    }
}
applyCoveragePatch();
