import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function checkEnum() {
    const pool = getPool();
    try {
        console.log("--- KYC STATUS ENUM DIAGNOSTIC ---");

        const [res] = await pool.query(`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE pg_type.typname = 'kyc_status_enum'
        `);

        console.log("Allowed values for kyc_status_enum:");
        res.forEach(row => console.log(` - ${row.enumlabel}`));

        console.log("--- DIAGNOSTIC COMPLETE ---");
    } catch (err) {
        console.error("Diagnostic failed:", err.message);
    } finally {
        await pool.end();
    }
}

checkEnum();
