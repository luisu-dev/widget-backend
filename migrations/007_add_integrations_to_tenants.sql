-- Add integration fields to tenants table
-- This allows each tenant/brand to have independent integrations

-- Stripe integration
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS stripe_acct VARCHAR(255);

-- Catalog URL
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS catalog_url TEXT;

-- Web domains (JSON array)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS web_domains JSONB DEFAULT '[]'::jsonb;

-- Owner user (to support multi-tenant per user)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_acct ON tenants(stripe_acct);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_user_id ON tenants(owner_user_id);
