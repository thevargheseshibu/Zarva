import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: 'Vs@123456', database: 'zarva' });

// 1. Check what's actually in active_worker_coverage
const { rows: coverage } = await pool.query(`SELECT * FROM active_worker_coverage LIMIT 5`);
console.log('\n=== active_worker_coverage data ===');
console.log(coverage.length, 'rows', coverage.length ? coverage[0] : 'EMPTY');

// 2. Check the worker profile flags and geometry
const { rows: wp } = await pool.query(`
    SELECT user_id, is_verified, is_online, is_available, kyc_status,
           service_center IS NOT NULL as has_center,
           service_area IS NOT NULL as has_area,
           service_radius_km,
           service_types
    FROM worker_profiles ORDER BY user_id DESC LIMIT 5
`);
console.log('\n=== worker_profiles actual state ===');
console.table(wp);

// 3. Get the active_worker_coverage view definition
const { rows: viewDef } = await pool.query(`SELECT definition FROM pg_views WHERE viewname = 'active_worker_coverage'`);
const { rows: matViewDef } = await pool.query(`SELECT definition FROM pg_matviews WHERE matviewname = 'active_worker_coverage'`);
if (matViewDef.length) { console.log('\n=== VIEW DEFINITION ===\n', matViewDef[0].definition); }

await pool.end();
