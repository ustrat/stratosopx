-- Platform administration: StratosOpx staff who can add customer companies.
-- Rows are added by hand (wrangler d1 execute), never through the app.
CREATE TABLE platform_admins (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The Cloudflare Email Routing rule that sends <intake_address>@in.stratosopx.com to the app.
ALTER TABLE tenants ADD COLUMN intake_rule_id TEXT;
ALTER TABLE tenants ADD COLUMN intake_rule_status TEXT NOT NULL DEFAULT 'none'
  CHECK (intake_rule_status IN ('none', 'active', 'failed', 'manual'));
ALTER TABLE tenants ADD COLUMN intake_rule_error TEXT;

-- Rules that existed before this migration were created in the Cloudflare dashboard.
UPDATE tenants SET intake_rule_status = 'manual' WHERE intake_address IS NOT NULL;
