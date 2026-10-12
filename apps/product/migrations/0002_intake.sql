-- Milestone 2: document intake (upload + email), screening, quarantine, retention.

-- Local part of the tenant's intake address: <intake_address>@in.stratosopx.com
ALTER TABLE tenants ADD COLUMN intake_address TEXT;
CREATE UNIQUE INDEX tenants_intake_address ON tenants(intake_address);

-- Trading-partner allowlist for email intake: an exact address or "@domain.com".
CREATE TABLE intake_senders (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  pattern TEXT NOT NULL COLLATE NOCASE,
  added_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tenant_id, pattern)
);

-- Document lifecycle beyond the screening outcome.
ALTER TABLE documents ADD COLUMN state TEXT NOT NULL DEFAULT 'stored'
  CHECK (state IN ('stored', 'quarantined', 'rejected', 'released', 'deleted', 'expired'));
ALTER TABLE documents ADD COLUMN content_type TEXT;
ALTER TABLE documents ADD COLUMN message_id TEXT;
ALTER TABLE documents ADD COLUMN subject TEXT;
ALTER TABLE documents ADD COLUMN uploaded_by TEXT;
ALTER TABLE documents ADD COLUMN decided_by TEXT;
ALTER TABLE documents ADD COLUMN decided_at TEXT;
ALTER TABLE documents ADD COLUMN expires_at TEXT;

UPDATE documents SET state = CASE outcome WHEN 'reject' THEN 'rejected' WHEN 'quarantine' THEN 'quarantined' ELSE 'stored' END;

CREATE INDEX documents_sha ON documents(tenant_id, sha256);
CREATE INDEX documents_expiry ON documents(state, expires_at);
