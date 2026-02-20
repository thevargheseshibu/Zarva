-- ============================================================
--  Zarva Seed Data
--  Safe to re-run (ON DUPLICATE KEY UPDATE)
-- ============================================================

USE zarva;

-- ── system_config — runtime overrides for ConfigLoader ───────
INSERT INTO system_config (namespace, `key`, `value`, description)
VALUES
  ('features', 'notifications.whatsapp_enabled', 'false', 'WhatsApp notifications toggle'),
  ('features', 'notifications.sms_enabled',      'false', 'SMS notifications toggle'),
  ('features', 'payment.enabled',                'true',  'Master payment switch'),
  ('zarva',    'geo.search_radius_km',           '10',    'Default worker search radius'),
  ('pricing',  'platform_commission_percent',    '10',    'Platform commission %')
ON DUPLICATE KEY UPDATE
  `value`     = VALUES(`value`),
  description = VALUES(description),
  updated_at  = CURRENT_TIMESTAMP;
