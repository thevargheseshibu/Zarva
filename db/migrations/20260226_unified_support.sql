-- ============================================
-- UNIFIED SUPPORT SYSTEM SCHEMA
-- ============================================

-- 1. Support Tickets Table (Unified — Dispute + General Chat)
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who raised it
  raised_by_user_id UUID NOT NULL REFERENCES users(id),
  raised_by_role VARCHAR(20) NOT NULL,  -- 'customer', 'worker'

  -- Ticket type
  ticket_type VARCHAR(30) NOT NULL,
  -- 'general_chat'    -> No job attached, just talking to admin
  -- 'job_dispute'     -> Formal dispute on a specific job
  -- 'job_query'       -> Question about a job, not a formal dispute

  -- Job reference (NULL for general_chat)
  job_id UUID REFERENCES jobs(id),

  -- Dispute-specific (only if ticket_type = 'job_dispute')
  dispute_category VARCHAR(100),
  is_formal_dispute BOOLEAN DEFAULT FALSE,

  -- Ticket status
  status VARCHAR(30) DEFAULT 'open',
  -- 'open', 'admin_replied', 'awaiting_user', 'resolved', 'closed'

  -- Job blocking (only for job_dispute)
  affects_job_completion BOOLEAN DEFAULT FALSE,

  -- Resolution
  resolved_by UUID REFERENCES users(id),
  resolution_type VARCHAR(50),
  resolution_notes TEXT,
  resolution_amount DECIMAL(10, 2),

  -- Priority
  priority VARCHAR(20) DEFAULT 'medium',

  -- Metadata
  ticket_number VARCHAR(30) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(raised_by_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_job ON support_tickets(job_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON support_tickets(ticket_type);

-- 2. Ticket Messages (Unified Chat)
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,

  sender_id UUID REFERENCES users(id),
  sender_role VARCHAR(20) NOT NULL,  -- 'customer', 'worker', 'admin', 'system'

  message_text TEXT,
  attachment_urls TEXT[],
  attachment_types VARCHAR(20)[],

  message_type VARCHAR(20) DEFAULT 'text',
  
  read_by_admin BOOLEAN DEFAULT FALSE,
  read_by_user BOOLEAN DEFAULT FALSE,

  is_internal_note BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at ASC);

-- 3. Updated Jobs Table (Concurrency Control)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(30) DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS active_ticket_id UUID REFERENCES support_tickets(id);

-- User concurrency tracking
CREATE TABLE IF NOT EXISTS user_job_slots (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  active_job_count INTEGER DEFAULT 0,
  disputed_job_count INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Dispute Categories (Config Table)
CREATE TABLE IF NOT EXISTS dispute_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key VARCHAR(100) UNIQUE NOT NULL,
  category_name VARCHAR(200) NOT NULL,
  who_can_raise VARCHAR(20) NOT NULL,  -- 'customer', 'worker', 'both'
  priority_default VARCHAR(20) DEFAULT 'medium',
  sla_hours INTEGER DEFAULT 24,
  active BOOLEAN DEFAULT TRUE
);

-- Populate if empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dispute_categories LIMIT 1) THEN
    INSERT INTO dispute_categories
      (category_key, category_name, who_can_raise, priority_default, sla_hours) VALUES
    ('work_quality', 'Poor Work Quality', 'customer', 'high', 12),
    ('work_incomplete', 'Work Not Completed', 'customer', 'high', 8),
    ('property_damage', 'Property Damaged', 'customer', 'critical', 4),
    ('no_show', 'Worker Did Not Show Up', 'customer', 'high', 4),
    ('overcharged', 'Overcharged / Wrong Amount', 'customer', 'high', 12),
    ('worker_behavior', 'Unprofessional Behavior', 'customer', 'high', 8),
    ('work_failed_later', 'Work Failed After Completion', 'customer', 'high', 24),
    ('warranty_breach', 'Warranty Claim', 'customer', 'medium', 48),
    ('customer_refusing_otp', 'Customer Refusing to Enter OTP', 'worker', 'critical', 4),
    ('customer_absent', 'Customer Not Available', 'worker', 'medium', 12),
    ('scope_change', 'Customer Changing Scope', 'worker', 'high', 8),
    ('customer_harassment', 'Customer Harassment/Abuse', 'worker', 'critical', 2),
    ('false_damage_claim', 'False Damage Claim Against Me', 'worker', 'high', 24),
    ('fraudulent_refund', 'Customer Requested Fraudulent Refund', 'worker', 'critical', 12),
    ('payment_issue', 'Payment Amount Issue', 'worker', 'high', 8),
    ('false_review', 'False Negative Review', 'worker', 'medium', 48);
  END IF;
END
$$;
