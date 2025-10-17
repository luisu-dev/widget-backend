-- Migration: Migrate existing Facebook data from tenants.settings to facebook_pages
-- Date: 2025-10-16
-- Description: Move existing Facebook page configurations to new table

-- Insert existing Facebook pages from settings into facebook_pages table
INSERT INTO facebook_pages (
    tenant_slug,
    page_id,
    page_name,
    page_token,
    ig_user_id,
    is_active,
    created_at
)
SELECT
    slug as tenant_slug,
    settings->>'fb_page_id' as page_id,
    settings->>'fb_page_name' as page_name,
    settings->>'fb_page_token' as page_token,
    settings->>'ig_user_id' as ig_user_id,
    true as is_active,
    created_at
FROM tenants
WHERE
    settings IS NOT NULL
    AND settings->>'fb_page_id' IS NOT NULL
    AND settings->>'fb_page_token' IS NOT NULL
ON CONFLICT (tenant_slug, page_id) DO UPDATE SET
    page_name = EXCLUDED.page_name,
    page_token = EXCLUDED.page_token,
    ig_user_id = EXCLUDED.ig_user_id,
    updated_at = NOW();

-- Show what was migrated
SELECT
    tenant_slug,
    page_id,
    page_name,
    CASE
        WHEN page_token IS NOT NULL THEN '***' || RIGHT(page_token, 10)
        ELSE NULL
    END as token_preview,
    ig_user_id,
    is_active,
    created_at
FROM facebook_pages
ORDER BY created_at DESC;
