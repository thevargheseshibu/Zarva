import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: 'Vs@123456', database: 'zarva' });
const { rows } = await pool.query(`
    SELECT u.id, u.phone, u.is_blocked, u.onboarding_complete, wp.kyc_status, wp.is_verified
    FROM users u
    LEFT JOIN worker_profiles wp ON wp.user_id = u.id
    WHERE u.active_role = 'worker'
    ORDER BY u.id DESC LIMIT 10
`);
console.table(rows);
await pool.end();
