-- Agregar fb_user_id para identificar qué usuario de Facebook conectó cada página
-- Esto es crítico para seguridad: cada tenant solo debe ver las páginas de SU cuenta de Facebook

ALTER TABLE facebook_pages
ADD COLUMN IF NOT EXISTS fb_user_id VARCHAR(100);

-- Crear índice para mejorar performance en las búsquedas
CREATE INDEX IF NOT EXISTS idx_facebook_pages_fb_user_id ON facebook_pages(fb_user_id);

-- Índice compuesto para búsquedas por tenant y fb_user_id
CREATE INDEX IF NOT EXISTS idx_facebook_pages_tenant_fb_user ON facebook_pages(tenant_slug, fb_user_id);

COMMENT ON COLUMN facebook_pages.fb_user_id IS 'ID del usuario de Facebook que conectó esta página. Usado para filtrar páginas por cuenta de Facebook.';
