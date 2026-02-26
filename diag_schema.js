import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();

console.log("DB Environment Variables:");
console.log(" - DB_HOST:", process.env.DB_HOST);
console.log(" - DB_PORT:", process.env.DB_PORT);
console.log(" - DB_NAME:", process.env.DB_NAME);
console.log(" - DB_USER:", process.env.DB_USER);
console.log(" - NODE_ENV:", process.env.NODE_ENV);

async function checkSchema() {
    const pool = getPool();
    try {
        console.log("Checking for 'worker_profiles' metadata...");
        const [meta] = await pool.query(`
            SELECT table_schema, table_name, table_type 
            FROM information_schema.tables 
            WHERE table_name = 'worker_profiles';
        `);
        console.log("Meta found:", meta);

        console.log("\nChecking columns for ALL 'worker_profiles' tables...");
        const [rows] = await pool.query(`
            SELECT table_schema, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'worker_profiles'
            ORDER BY table_schema, ordinal_position;
        `);

        if (rows.length === 0) {
            console.log("Table 'worker_profiles' NOT FOUND!");
        } else {
            console.log("Columns found:");
            rows.forEach(r => console.log(` - ${r.table_schema}.${r.column_name} (${r.data_type})`));

            // ATTEMPT DUMMY UPDATE
            console.log("\nAttempting dummy UPDATE on worker_profiles...");
            try {
                // We don't need a real row to check if the column exists in the context of the query
                await pool.query(`
                    UPDATE worker_profiles 
                    SET gender = 'test' 
                    WHERE user_id = -1
                `);
                console.log("SUCCESS: Column 'gender' is reachable in UPDATE query.");
            } catch (uErr) {
                console.error("FAIL: UPDATE failed with error:", uErr.message);
            }
        }

        if (rows.length === 0) {
            console.log("Table 'worker_profiles' NOT FOUND!");
        } else {
            console.log("Columns found:");
            rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
        }
    } catch (err) {
        console.error("Error checking schema:", err.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
