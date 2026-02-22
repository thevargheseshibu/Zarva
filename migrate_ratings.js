import { getPool } from './config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function migrate() {
    const pool = getPool();
    console.log('--- Starting Rating Column Standardization ---');

    try {
        // 1. Worker Profiles: Drop avg_rating (redundant with average_rating)
        console.log('Checking worker_profiles for redundant avg_rating...');
        const [workerCols] = await pool.query('SHOW COLUMNS FROM worker_profiles LIKE "avg_rating"');
        if (workerCols.length > 0) {
            console.log('Dropping redundant avg_rating from worker_profiles...');
            await pool.query('ALTER TABLE worker_profiles DROP COLUMN avg_rating');
        } else {
            console.log('avg_rating already removed from worker_profiles.');
        }

        // 2. Customer Profiles: Rename avg_rating to average_rating
        console.log('Checking customer_profiles for avg_rating...');
        const [custCols] = await pool.query('SHOW COLUMNS FROM customer_profiles LIKE "avg_rating"');
        const [custColsNew] = await pool.query('SHOW COLUMNS FROM customer_profiles LIKE "average_rating"');

        if (custCols.length > 0 && custColsNew.length === 0) {
            console.log('Renaming avg_rating to average_rating in customer_profiles...');
            await pool.query('ALTER TABLE customer_profiles CHANGE COLUMN avg_rating average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00');
        } else if (custCols.length > 0 && custColsNew.length > 0) {
            console.log('Both exist in customer_profiles. Dropping avg_rating...');
            await pool.query('ALTER TABLE customer_profiles DROP COLUMN avg_rating');
        } else {
            console.log('customer_profiles already standardized.');
        }

        console.log('--- Database Migration Complete ---');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
