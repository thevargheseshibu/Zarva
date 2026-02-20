ALTER TABLE users ADD COLUMN language ENUM('en','ml') NOT NULL DEFAULT 'en' AFTER fcm_token;
