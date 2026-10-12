-- Milestone 3: AI extraction of orders from accepted documents.

ALTER TABLE documents ADD COLUMN extraction_state TEXT NOT NULL DEFAULT 'none'
  CHECK (extraction_state IN ('none', 'queued', 'running', 'done', 'not_order', 'skipped', 'needs_attention', 'failed'));
ALTER TABLE documents ADD COLUMN extraction_note TEXT;      -- why it needs attention / failed / was skipped
ALTER TABLE documents ADD COLUMN extraction TEXT;           -- JSON: the model's structured output, kept for audit
ALTER TABLE documents ADD COLUMN extraction_usage TEXT;     -- JSON: model, tokens
ALTER TABLE documents ADD COLUMN order_id TEXT;
ALTER TABLE documents ADD COLUMN extracted_at TEXT;

-- Notes from extraction shown to the reviewer (defaults applied, units normalized, ...).
ALTER TABLE orders ADD COLUMN extraction_warnings TEXT NOT NULL DEFAULT '[]';

-- Seeded and earlier documents that already have an order count as extracted.
UPDATE documents
SET extraction_state = 'done',
    order_id = (SELECT o.id FROM orders o WHERE o.document_id = documents.id LIMIT 1)
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.document_id = documents.id);

CREATE INDEX orders_po ON orders(tenant_id, customer_id, po_number);
