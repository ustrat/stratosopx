-- StratosOpx product schema. Every row belongs to a tenant; every query filters by tenant_id.

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  order_plan TEXT NOT NULL DEFAULT 'essentials' CHECK (order_plan IN ('essentials', 'growth', 'scale')),
  automation_mode TEXT NOT NULL DEFAULT 'assist' CHECK (automation_mode IN ('assist', 'rule-based', 'policy')),
  writes_paused INTEGER NOT NULL DEFAULT 0,
  erp_format TEXT NOT NULL DEFAULT 'NetSuite' CHECK (erp_format IN ('NetSuite', 'SAP B1')),
  erp_connection TEXT NOT NULL DEFAULT 'mock' CHECK (erp_connection IN ('mock')),
  launch_criteria TEXT NOT NULL DEFAULT '[]', -- JSON [{label, done}]
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'approver', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX users_tenant ON users(tenant_id);

-- ---- Mock ERP (stands in for NetSuite / SAP B1 until a sandbox is connected) ----

CREATE TABLE erp_customers (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  credit_limit REAL NOT NULL DEFAULT 0,
  open_balance REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE erp_items (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  sku TEXT NOT NULL,
  description TEXT NOT NULL,
  sell_uom TEXT NOT NULL,
  uom_options TEXT NOT NULL, -- JSON [{code, factor}]
  tier_price REAL NOT NULL,
  stock REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, sku)
);

CREATE TABLE erp_customer_parts (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  customer_id TEXT NOT NULL,
  customer_part TEXT NOT NULL,
  sku TEXT NOT NULL,
  PRIMARY KEY (tenant_id, customer_id, customer_part)
);

CREATE TABLE erp_sales_orders (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  idempotency_key TEXT NOT NULL,
  order_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tenant_id, idempotency_key)
);

-- ---- Intake and orders ----

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  filename TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('order', 'bid')),
  size_bytes INTEGER NOT NULL,
  pages INTEGER,
  sender TEXT,
  channel TEXT NOT NULL, -- upload | email | api
  r2_key TEXT,
  sha256 TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('accept', 'quarantine', 'reject')),
  reasons TEXT NOT NULL DEFAULT '[]', -- JSON
  billable INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX documents_tenant ON documents(tenant_id, received_at);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  document_id TEXT REFERENCES documents(id),
  kind TEXT NOT NULL CHECK (kind IN ('po', 'change-order')),
  title TEXT NOT NULL,
  po_number TEXT NOT NULL,
  sales_order TEXT, -- existing ERP order a change order revises
  customer_id TEXT NOT NULL,
  ship_date TEXT NOT NULL,
  prev_ship_date TEXT,
  status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review', 'approved', 'rejected', 'written', 'failed')),
  initial_issue_count INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_at TEXT
);
CREATE INDEX orders_tenant_status ON orders(tenant_id, status, received_at);

-- Snapshot of each line as extracted, with the ERP data it was checked against.
CREATE TABLE order_lines (
  order_id TEXT NOT NULL REFERENCES orders(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  n INTEGER NOT NULL,
  customer_part TEXT NOT NULL,
  sku TEXT NOT NULL,
  description TEXT NOT NULL,
  match_confidence REAL NOT NULL,
  qty REAL NOT NULL,
  uom TEXT NOT NULL,
  unit_price REAL NOT NULL,
  sell_uom TEXT NOT NULL,
  uom_options TEXT NOT NULL, -- JSON
  tier_price REAL NOT NULL,
  stock REAL NOT NULL,
  prev_qty REAL,
  prev_unit_price REAL,
  PRIMARY KEY (order_id, n)
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  user_id TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  fingerprint TEXT,
  payload TEXT, -- JSON, the exact approved payload
  accepted_issues TEXT NOT NULL DEFAULT '[]', -- JSON issue keys
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX approvals_order ON approvals(tenant_id, order_id);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  actor TEXT NOT NULL, -- user email or agent:<name>
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT NOT NULL DEFAULT '{}', -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX audit_tenant ON audit_log(tenant_id, created_at);
