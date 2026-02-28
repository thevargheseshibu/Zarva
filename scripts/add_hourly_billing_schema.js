import { getPool } from '../config/database.js';

async function migrateHourlyBillingSchema() {
    const db = getPool();
    const client = await db.getConnection();
    try {
        await client.query('BEGIN');
        console.log('--- Starting Hourly Billing DB Migration ---');

        // 1. Alter "jobs" table
        console.log('1. Adding hourly billing columns to jobs table...');
        const addColumnsQuery = `
            ALTER TABLE jobs 
            ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) DEFAULT 'hourly',
            ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS inspection_fee DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS travel_charge DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS distance_km DECIMAL(6,2),
            ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
            ADD COLUMN IF NOT EXISTS approved_extension_minutes INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS billing_cap_minutes INTEGER,
            ADD COLUMN IF NOT EXISTS issue_notes TEXT,
            ADD COLUMN IF NOT EXISTS inspection_otp_hash VARCHAR(255),
            ADD COLUMN IF NOT EXISTS inspection_started_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS inspection_expires_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS job_started_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS job_ended_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS final_billed_minutes INTEGER,
            ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS exceeded_estimate BOOLEAN DEFAULT FALSE;
        `;
        await client.query(addColumnsQuery);
        console.log('   Jobs table altered successfully.');

        // 2. Create "job_timer_events" table
        console.log('2. Creating job_timer_events audit table...');
        const createTimerEventsQuery = `
            CREATE TABLE IF NOT EXISTS job_timer_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL,
                triggered_by VARCHAR(20) NOT NULL,
                server_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
                gps_lat DECIMAL(10,8),
                gps_lng DECIMAL(11,8),
                notes TEXT,
                metadata JSONB
            );
        `;
        await client.query(createTimerEventsQuery);

        // Add index for job_timer_events
        const createTimerIndex = `
            CREATE INDEX IF NOT EXISTS idx_timer_events_job 
            ON job_timer_events(job_id, server_timestamp ASC);
        `;
        await client.query(createTimerIndex);
        console.log('   job_timer_events table and index created.');

        // 3. Create "job_extensions" table
        console.log('3. Creating job_extensions table...');
        const createExtensionsQuery = `
            CREATE TABLE IF NOT EXISTS job_extensions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                requested_at TIMESTAMP DEFAULT NOW(),
                reason TEXT NOT NULL,
                additional_minutes INTEGER NOT NULL,
                photo_url TEXT NOT NULL,
                photo_captured_at TIMESTAMP NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                otp_hash VARCHAR(255),
                resolved_at TIMESTAMP
            );
        `;
        await client.query(createExtensionsQuery);
        console.log('   job_extensions table created.');

        await client.query('COMMIT');
        console.log('--- Hourly Billing Migration Completed Successfully ---');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed, rolled back.', e);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrateHourlyBillingSchema().then(() => process.exit(0)).catch(console.error);
