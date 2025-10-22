-- Add page_id column to messages table to track which Facebook page each message belongs to
-- This allows filtering messages by specific pages for multi-page accounts

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS page_id VARCHAR(100);

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_messages_page_id ON messages(page_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_page ON messages(tenant_slug, page_id);

COMMENT ON COLUMN messages.page_id IS 'Facebook page_id that this message belongs to (for multi-page filtering)';
