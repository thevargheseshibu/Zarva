-- ============================================================
--  Zarva Seed Data
--  Safe to re-run (ON DUPLICATE KEY UPDATE)
-- ============================================================



-- ── system_config — runtime overrides for ConfigLoader ───────
INSERT INTO system_config (namespace, "key", "value", description)
VALUES
  ('features', 'notifications.whatsapp_enabled', 'false', 'WhatsApp notifications toggle'),
  ('features', 'notifications.sms_enabled',      'false', 'SMS notifications toggle'),
  ('features', 'payment.enabled',                'true',  'Master payment switch'),
  ('zarva',    'geo.search_radius_km',           '10',    'Default worker search radius'),
  ('pricing',  'platform_commission_percent',    '10',    'Platform commission %')
ON CONFLICT (namespace, "key") DO UPDATE SET
  "value"     = EXCLUDED."value",
  description = EXCLUDED.description,
  updated_at  = CURRENT_TIMESTAMP;

-- ── dispute_categories ───────────────────────────────────────
INSERT INTO dispute_categories (category_key, category_name, who_can_raise, priority_default, sla_hours)
VALUES
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
  ('false_review', 'False Negative Review', 'worker', 'medium', 48)
ON CONFLICT (category_key) DO UPDATE SET
  category_name = EXCLUDED.category_name,
  who_can_raise = EXCLUDED.who_can_raise,
  priority_default = EXCLUDED.priority_default,
  sla_hours = EXCLUDED.sla_hours;
