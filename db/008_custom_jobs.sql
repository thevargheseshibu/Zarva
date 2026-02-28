-- Custom job definitions (the "tile" that appears in job selection)
CREATE TABLE custom_job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who created it
  customer_id BIGINT NOT NULL REFERENCES users(id),

  -- Job details
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  photos TEXT[],                    -- up to 5 photos

  -- Pricing (hourly rate instead of flat fee per latest spec)
  hourly_rate DECIMAL(10,2) NOT NULL,
  fee_negotiable BOOLEAN DEFAULT FALSE,

  -- Location context
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),

  -- Admin approval gate
  approval_status VARCHAR(30) DEFAULT 'pending',
  -- 'pending', 'approved', 'rejected', 'flagged'
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_notes TEXT,

  -- Visibility
  is_active BOOLEAN DEFAULT FALSE,  -- only TRUE after approval
  is_archived BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_templates_customer ON custom_job_templates(customer_id);
CREATE INDEX idx_custom_templates_approval ON custom_job_templates(approval_status, is_active);
CREATE INDEX idx_custom_templates_city ON custom_job_templates(city, is_active);

-- Actual job instances created from a custom template
-- When worker accepts a custom job, a row goes into the main jobs table
-- AND a reference row here for custom-specific fields
CREATE TABLE custom_job_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id BIGINT NOT NULL REFERENCES jobs(id),           -- link to main jobs table
  template_id UUID NOT NULL REFERENCES custom_job_templates(id),

  -- Agreed hourly rate (may differ from template if negotiable)
  agreed_hourly_rate DECIMAL(10,2) NOT NULL,
  fee_was_negotiated BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin review log
CREATE TABLE custom_job_review_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES custom_job_templates(id),
  reviewed_by BIGINT NOT NULL REFERENCES users(id),
  action VARCHAR(30) NOT NULL,  -- 'approved', 'rejected', 'flagged', 'requested_edit'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add source column to existing jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_source VARCHAR(20) DEFAULT 'standard';
-- 'standard' = normal category job
-- 'custom'   = from custom_job_templates
