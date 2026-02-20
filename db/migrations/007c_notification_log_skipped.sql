ALTER TABLE notification_log MODIFY COLUMN status ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending';
