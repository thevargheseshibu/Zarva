import { getPool } from './config/database.js';

async function run() {
    const pool = getPool();
    console.log('[Schema] Creating Custom Job tables...');
    
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS custom_job_templates (
                id BIGSERIAL PRIMARY KEY,
                customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(200) NOT NULL,
                description TEXT NOT NULL,
                photos TEXT[] DEFAULT '{}',
                hourly_rate DECIMAL(10,2) NOT NULL,
                fee_negotiable BOOLEAN DEFAULT FALSE,
                city VARCHAR(64),
                state VARCHAR(64),
                pincode VARCHAR(10),
                approval_status VARCHAR(20) DEFAULT 'pending',
                rejection_reason TEXT,
                reviewed_by BIGINT REFERENCES users(id),
                reviewed_at TIMESTAMPTZ,
                admin_notes TEXT,
                is_active BOOLEAN DEFAULT FALSE,
                is_archived BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS custom_job_review_log (
                id BIGSERIAL PRIMARY KEY,
                template_id BIGINT NOT NULL REFERENCES custom_job_templates(id) ON DELETE CASCADE,
                reviewed_by BIGINT NOT NULL REFERENCES users(id),
                action VARCHAR(20) NOT NULL,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS custom_job_instances (
                id BIGSERIAL PRIMARY KEY,
                job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                template_id BIGINT NOT NULL REFERENCES custom_job_templates(id),
                agreed_hourly_rate DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        
        console.log('[Schema] Custom Job tables created successfully!');
        process.exit(0);
    } catch (err) {
        console.error('[Schema] Error creating tables:', err.message);
        process.exit(1);
    }
}

run();
