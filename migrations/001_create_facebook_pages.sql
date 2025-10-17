-- Migration: Create facebook_pages table for multi-page support
-- Date: 2025-10-16
-- Description: Allow tenants to connect and manage multiple Facebook pages

-- Create facebook_pages table
CREATE TABLE IF NOT EXISTS facebook_pages (
    id SERIAL PRIMARY KEY,
    tenant_slug VARCHAR(100) NOT NULL,

    -- Facebook Page info
    page_id VARCHAR(100) NOT NULL,
    page_name VARCHAR(255),
    page_token TEXT NOT NULL,

    -- Instagram info (optional)
    ig_user_id VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_tenant
        FOREIGN KEY (tenant_slug)
        REFERENCES tenants(slug)
        ON DELETE CASCADE,

    CONSTRAINT unique_page_per_tenant
        UNIQUE (tenant_slug, page_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_facebook_pages_tenant
    ON facebook_pages(tenant_slug);

CREATE INDEX IF NOT EXISTS idx_facebook_pages_page_id
    ON facebook_pages(page_id);

CREATE INDEX IF NOT EXISTS idx_facebook_pages_active
    ON facebook_pages(tenant_slug, is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_facebook_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_facebook_pages_updated_at
    BEFORE UPDATE ON facebook_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_facebook_pages_updated_at();

-- Comments for documentation
COMMENT ON TABLE facebook_pages IS 'Stores Facebook pages connected to tenants';
COMMENT ON COLUMN facebook_pages.tenant_slug IS 'Reference to tenant that owns this page';
COMMENT ON COLUMN facebook_pages.page_id IS 'Facebook Page ID';
COMMENT ON COLUMN facebook_pages.page_token IS 'Facebook Page Access Token (long-lived)';
COMMENT ON COLUMN facebook_pages.ig_user_id IS 'Instagram Business Account ID (if connected)';
COMMENT ON COLUMN facebook_pages.is_active IS 'Whether this page is active for bot responses';
