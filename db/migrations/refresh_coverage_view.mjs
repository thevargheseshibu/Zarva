import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: 'Vs@123456', database: 'zarva' });

console.log('Refreshing active_worker_coverage materialized view...');
try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY active_worker_coverage');
    console.log('✅ Refreshed with CONCURRENTLY (no lock)');
} catch(e) {
    console.log('CONCURRENTLY failed, trying without:', e.message);
    await pool.query('REFRESH MATERIALIZED VIEW active_worker_coverage');
    console.log('✅ Refreshed');
}

const { rows } = await pool.query('SELECT COUNT(*) as cnt FROM active_worker_coverage');
console.log('📊 View now contains', rows[0].cnt, 'worker(s)');

await pool.end();
