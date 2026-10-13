-- Bid Qualification Agent: capability library, past projects, analyzed bids.

CREATE TABLE capabilities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  kind TEXT NOT NULL CHECK (kind IN ('certification', 'insurance', 'bonding', 'license', 'safety', 'staffing', 'equipment', 'other')),
  name TEXT NOT NULL,
  detail TEXT,
  amount REAL,             -- e.g. insurance per-occurrence limit or bonding capacity, in USD
  expires_on TEXT,         -- YYYY-MM-DD
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX capabilities_tenant ON capabilities(tenant_id, kind);

CREATE TABLE past_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  client TEXT,
  year INTEGER,
  value REAL,
  scope TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'completed', 'in_progress')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX past_projects_tenant ON past_projects(tenant_id);

CREATE TABLE bids (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  document_id TEXT REFERENCES documents(id),
  title TEXT NOT NULL,
  owner TEXT,
  package_name TEXT,
  due_date TEXT,
  pages INTEGER,
  summary TEXT,
  requirements TEXT NOT NULL DEFAULT '[]',   -- JSON
  scope_matches TEXT NOT NULL DEFAULT '[]',  -- JSON
  warnings TEXT NOT NULL DEFAULT '[]',       -- JSON
  recommendation TEXT NOT NULL CHECK (recommendation IN ('go', 'no_go', 'needs_info')),
  recommendation_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_review' CHECK (status IN ('needs_review', 'decided')),
  decision TEXT CHECK (decision IN ('go', 'no_go', 'needs_info')),
  decision_note TEXT,
  decided_by TEXT,
  decided_at TEXT,
  usage TEXT,                                -- JSON: model, tokens
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX bids_tenant ON bids(tenant_id, created_at);

ALTER TABLE documents ADD COLUMN bid_id TEXT;
