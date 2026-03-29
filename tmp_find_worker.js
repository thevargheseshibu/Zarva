import { getPool } from './config/database.js';
const pool = getPool();
const [workers] = await pool.query("SELECT user_id, name FROM worker_profiles WHERE name ILIKE '%Dean%'");
console.log('Found workers:', workers);
process.exit(0);
