-- Migration para agregar tabla de pre-registros
-- Guarda información de clientes antes de completar el pago

CREATE TABLE IF NOT EXISTS pre_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Datos de contacto
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    -- Datos de negocio
    business_name VARCHAR(255) NOT NULL,
    business_slug VARCHAR(100) NOT NULL UNIQUE,
    whatsapp_number VARCHAR(50),
    website VARCHAR(500),
    -- Plan y estado
    plan VARCHAR(50) NOT NULL,  -- 'starter' o 'meta'
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'completed', 'cancelled'
    -- Stripe
    stripe_session_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_registrations_email ON pre_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_slug ON pre_registrations(business_slug);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_stripe_session ON pre_registrations(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_status ON pre_registrations(status);
