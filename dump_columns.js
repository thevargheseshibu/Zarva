import { getPool } from './config/database.js';
async function run() {
    const pool = getPool();
    const [rows] = await pool.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'ledger_accounts'");
    console.log(rows);
    process.exit(0);
}
run();
