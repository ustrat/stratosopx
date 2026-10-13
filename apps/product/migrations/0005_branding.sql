-- Company branding for order confirmations and the app header.

ALTER TABLE tenants ADD COLUMN logo_key TEXT;          -- R2 key of the uploaded logo
ALTER TABLE tenants ADD COLUMN logo_type TEXT;         -- image/png | image/jpeg | image/webp
ALTER TABLE tenants ADD COLUMN logo_updated_at TEXT;   -- cache-busting
ALTER TABLE tenants ADD COLUMN brand_details TEXT NOT NULL DEFAULT '{}'; -- JSON: displayName, address, phone, email, website
