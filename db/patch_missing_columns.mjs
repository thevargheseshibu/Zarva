import { getPool } from '../config/database.js';

async function patch() {
    const pool = getPool();
    console.log('[Patch] Starting database schema patch...');

    const queries = [
        // 1. Add missing columns to jobs table (one by one for safety)
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_unread_count SMALLINT DEFAULT 0",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS worker_unread_count SMALLINT DEFAULT 0",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pause_otp_hash VARCHAR(255) NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS resume_otp_hash VARCHAR(255) NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suspend_otp_hash VARCHAR(255) NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_extension_otp_hash VARCHAR(255) NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_paused_seconds INT DEFAULT 0",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pause_reason TEXT NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suspend_reason TEXT NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS suspend_reschedule_at TIMESTAMPTZ NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS followup_job_id BIGINT NULL REFERENCES jobs(id)",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS safe_stop_window_ends_at TIMESTAMPTZ NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_stopped_at TIMESTAMPTZ NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_declared BOOLEAN DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_cost NUMERIC(10,2) DEFAULT 0",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_extended_until TIMESTAMPTZ NULL",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_extension_count SMALLINT DEFAULT 0",

        // 2. Create job_messages table
        `CREATE TABLE IF NOT EXISTS job_messages (
            id                BIGSERIAL PRIMARY KEY,
            job_id            BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            sender_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            sender_role       VARCHAR(20) NOT NULL,
            message_type      VARCHAR(20) NOT NULL DEFAULT 'text',
            content           TEXT NULL,
            s3_key            VARCHAR(512) NULL,
            is_deleted        BOOLEAN DEFAULT FALSE,
            deleted_at        TIMESTAMPTZ NULL,
            client_message_id VARCHAR(36) NULL,
            delivered_at      TIMESTAMPTZ NULL,
            read_at           TIMESTAMPTZ NULL,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT idx_client_message_id UNIQUE (job_id, client_message_id)
        )`,

        // 3. Create job_materials table
        `CREATE TABLE IF NOT EXISTS job_materials (
            id          BIGSERIAL PRIMARY KEY,
            job_id      BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            name        VARCHAR(200) NOT NULL,
            amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
            receipt_url VARCHAR(512) NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,

        // 4. Create missing indexes
        "CREATE INDEX IF NOT EXISTS idx_job_messages_job_created ON job_messages(job_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_job_materials_job ON job_materials(job_id)"
    ];

    for (const q of queries) {
        try {
            await pool.query(q);
            console.log(`[Patch] Success: ${q.substring(0, 50)}...`);
        } catch (e) {
            console.error(`[Patch] Error running query: ${q}`);
            console.error(e.message);
        }
    }

    console.log('[Patch] Database schema patch completed.');
    process.exit(0);
}

patch();
