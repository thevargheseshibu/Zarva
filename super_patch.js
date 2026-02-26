import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function superPatch() {
    const pool = getPool();
    try {
        console.log("--- SUPER PATCH START ---");

        // 1. Connection Check
        const [connInfo] = await pool.query("SELECT current_database(), current_user, version()");
        console.log("Connected to:", connInfo[0]);

        // 1b. Enum Fix
        console.log("Expanding 'kyc_status_enum'...");
        const missingValues = ['draft', 'documents_pending', 'pending_review', 'approved', 'rejected'];
        for (const val of missingValues) {
            try {
                await pool.query(`ALTER TYPE kyc_status_enum ADD VALUE IF NOT EXISTS '${val}'`);
                console.log(`Added value '${val}' to kyc_status_enum.`);
            } catch (e) {
                // IF NOT EXISTS is only supported on some PG versions for ADD VALUE, 
                // but we can catch "already exists" errors.
                if (!e.message.includes('already exists')) {
                    console.error(`Error adding ${val}:`, e.message);
                }
            }
        }

        // 2. Column Check & Fix
        console.log("Checking columns for 'worker_profiles'...");
        const columnsToAdd = [
            { name: 'gender', type: 'VARCHAR(20)' },
            { name: 'experience_years', type: 'NUMERIC(4,1)' },
            { name: 'skills', type: 'JSONB DEFAULT \'[]\'' },
            { name: 'service_range', type: 'INT DEFAULT 20' },
            { name: 'payment_method', type: 'VARCHAR(50)' },
            { name: 'payment_details', type: 'JSONB DEFAULT \'{}\'' },
            { name: 'aadhaar_number', type: 'VARCHAR(12)' },
            { name: 'documents', type: 'JSONB DEFAULT \'{}\'' }
        ];

        for (const col of columnsToAdd) {
            const [exists] = await pool.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'worker_profiles' AND column_name = $1
            `, [col.name]);

            if (exists.length === 0) {
                console.log(`Adding column: ${col.name} ...`);
                await pool.query(`ALTER TABLE worker_profiles ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Column ${col.name} added.`);
            } else {
                console.log(`Column ${col.name} already exists.`);
                // If it exists, let's also ensure the type is correct for experience_years which was character varying
                if (col.name === 'experience_years') {
                    console.log("Ensuring 'experience_years' is numeric...");
                    try {
                        await pool.query("ALTER TABLE worker_profiles ALTER COLUMN experience_years TYPE NUMERIC(4,1) USING experience_years::numeric");
                        console.log("experience_years type fixed.");
                    } catch (e) {
                        console.log("Could not convert experience_years to numeric (maybe has non-numeric data). Skipping casting, just ensuring it exists.");
                    }
                }
            }
        }

        // 2b. Add fcm_token to users
        console.log("Checking columns for 'users'...");
        const [fcmExists] = await pool.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'fcm_token'
        `);
        if (fcmExists.length === 0) {
            console.log("Adding fcm_token to users...");
            await pool.query("ALTER TABLE users ADD COLUMN fcm_token VARCHAR(255) NULL");
            console.log("fcm_token added.");
        }

        // 2c. Add distance_km to job_worker_notifications
        console.log("Checking columns for 'job_worker_notifications'...");
        const [distExists] = await pool.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'job_worker_notifications' AND column_name = 'distance_km'
        `);
        if (distExists.length === 0) {
            console.log("Adding distance_km to job_worker_notifications...");
            await pool.query("ALTER TABLE job_worker_notifications ADD COLUMN distance_km NUMERIC(10,2) NULL");
            console.log("distance_km added.");
        }

        // 3. Final verification
        const [cols] = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'worker_profiles'
        `);
        console.log("Final columns in worker_profiles:");
        cols.forEach(c => console.log(` - ${c.column_name} (${c.data_type})`));

        console.log("--- SUPER PATCH COMPLETE ---");
    } catch (err) {
        console.error("CRITICAL ERROR DURING PATCH:", err.message);
        console.error(err.stack);
    } finally {
        await pool.end();
    }
}

superPatch();
