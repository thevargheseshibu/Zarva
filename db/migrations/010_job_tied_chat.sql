-- Add chat control columns to jobs table
ALTER TABLE jobs
    ADD COLUMN chat_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN last_message_at TIMESTAMP NULL,
    ADD COLUMN customer_unread_count SMALLINT UNSIGNED DEFAULT 0,
    ADD COLUMN worker_unread_count SMALLINT UNSIGNED DEFAULT 0;

-- Create job_messages table
CREATE TABLE job_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    sender_id INT NOT NULL,
    sender_role ENUM('customer', 'worker') NOT NULL,
    message_type ENUM('text', 'image') NOT NULL DEFAULT 'text',
    content TEXT NULL,
    s3_key VARCHAR(500) NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    client_message_id VARCHAR(36) NULL,
    delivered_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_job_messages_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT fk_job_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_job_messages_job_created (job_id, created_at DESC),
    INDEX idx_job_messages_job_sender (job_id, sender_id),
    UNIQUE INDEX idx_client_message_id (job_id, client_message_id)
);
