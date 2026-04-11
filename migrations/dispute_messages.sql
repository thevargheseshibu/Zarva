-- Dispute Messages table for the Admin Command Center chat system.
-- Each dispute is tied to a job_id. Messages can be from customer, worker, or admin.
-- Internal notes (is_internal_note = true) are ONLY visible to admins.

CREATE TABLE IF NOT EXISTS dispute_messages (
    id              BIGSERIAL PRIMARY KEY,
    dispute_id      BIGINT NOT NULL,                    -- references the job_id that is disputed
    sender_id       BIGINT NOT NULL REFERENCES users(id),
    sender_role     VARCHAR(20) NOT NULL,               -- 'customer', 'worker', 'admin', 'superadmin'
    content         TEXT,
    attachment_url  TEXT,
    is_internal_note BOOLEAN DEFAULT false,             -- admin-only whisper messages
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast room-based queries
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id ON dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_created_at ON dispute_messages(dispute_id, created_at);

-- Audit logs table (if not already created)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    admin_id        BIGINT REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,
    target_table    VARCHAR(50),
    target_id       BIGINT,
    previous_data   JSONB,
    new_data        JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
