import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: 'Vs@123456', database: 'zarva' });

// Drop and recreate the materialized view WITHOUT the is_online condition.
// Coverage should reflect all APPROVED workers with a service area set,
// so customers can see if their area is serviceable regardless of worker online status.
await pool.query(`DROP MATERIALIZED VIEW IF EXISTS active_worker_coverage`);

await pool.query(`
    CREATE MATERIALIZED VIEW active_worker_coverage AS
    SELECT 
        user_id AS worker_profile_id,
        user_id,
        service_center,
        service_area,
        service_radius_km,
        service_types,
        city,
        is_available,
        is_online
    FROM worker_profiles
    WHERE 
        kyc_status = 'approved'
        AND service_center IS NOT NULL
        AND service_area IS NOT NULL
`);

// Create unique index needed for CONCURRENTLY refresh
await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_worker_coverage_uid
    ON active_worker_coverage (worker_profile_id)
`);

const { rows } = await pool.query('SELECT COUNT(*) as cnt FROM active_worker_coverage');
console.log(`✅ active_worker_coverage recreated — ${rows[0].cnt} worker(s) in coverage area`);

await pool.end();
