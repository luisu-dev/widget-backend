-- Agregar page_settings para guardar configuración específica de cada página
-- Cada página (Acidia, Chilangos) tendrá su propia configuración de marca

ALTER TABLE facebook_pages
ADD COLUMN IF NOT EXISTS page_settings JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN facebook_pages.page_settings IS 'Configuración específica de la página (brand, tone, policies, etc.)';
