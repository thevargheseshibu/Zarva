import { getPool } from './config/database.js';
async function run() {
    const pool = getPool();
    const [rows] = await pool.query("SELECT id, final_amount, materials_cost, final_labor_paise, final_material_paise, grand_total_paise FROM jobs WHERE status = 'completed'");
    console.log(rows);
    process.exit(0);
}
run();
