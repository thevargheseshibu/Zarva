-- db/migrations/001_onboarding_fields.sql
-- Upgrades the Task 1.2 schema to support Task 3.2 Onboarding APIs

-- 1. Modify `worker_profiles` ENUM and add missing fields
ALTER TABLE worker_profiles
  MODIFY COLUMN kyc_status ENUM('draft', 'documents_pending', 'pending_review', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  ADD COLUMN dob DATE NULL AFTER name,
  ADD COLUMN gender ENUM('male', 'female', 'other') NULL AFTER dob,
  ADD COLUMN skills JSON NULL AFTER category,
  ADD COLUMN experience_years TINYINT UNSIGNED NULL AFTER skills,
  ADD COLUMN service_pincodes JSON NULL AFTER experience_years,
  ADD COLUMN payment_method ENUM('upi', 'bank') NULL AFTER average_rating,
  ADD COLUMN payment_details JSON NULL COMMENT '{upi_id} OR {account_no, ifsc}' AFTER payment_method;

-- 2. Modify `worker_agreements` to capture the legally typed signature name
ALTER TABLE worker_agreements
  ADD COLUMN name_typed VARCHAR(255) NOT NULL AFTER worker_id;
