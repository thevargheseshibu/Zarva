import { getPool } from './lib/db.js';
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

async function findTrigger() {
    const pool = getPool();
    try {
        const [rows] = await pool.query(`
            SELECT pg_get_triggerdef(oid) as def 
            FROM pg_trigger 
            WHERE tgname = 'ledger_entries_balance_check' 
               OR tgname LIKE '%double_entry%'
        `);
        if (rows.length > 0) {
            console.log('Found triggers:');
            rows.forEach(r => console.log(r.def));
        } else {
            console.log('No such triggers found by name.');
            // Let's try to find the function verify_double_entry
            const [funcs] = await pool.query(`
                SELECT prosrc 
                FROM pg_proc 
                WHERE proname = 'verify_double_entry'
            `);
            if (funcs.length > 0) {
                console.log('Found verify_double_entry function source:');
                console.log(funcs[0].prosrc);
            } else {
                console.log('Function verify_double_entry not found.');
            }
        }
    } catch (e) {
        console.error('Error querying DB:', e.message);
    }
    process.exit(0);
}
findTrigger();
