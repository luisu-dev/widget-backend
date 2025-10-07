# 🏗️ Arquitectura Multi-Tenant

## ✅ Correcciones Aplicadas

El sistema es **multi-tenant**, lo que significa que múltiples clientes (tenants) comparten la misma infraestructura pero con datos completamente aislados.

### ❌ Problema Inicial

La primera implementación OAuth guardaba los tokens de Facebook en columnas separadas:
```sql
-- ❌ INCORRECTO (columnas dedicadas)
ALTER TABLE tenants ADD COLUMN meta_page_id TEXT;
ALTER TABLE tenants ADD COLUMN meta_page_token TEXT;
ALTER TABLE tenants ADD COLUMN meta_page_name TEXT;
```

### ✅ Solución Multi-Tenant

Los tokens se guardan en el campo `settings` (JSONB), manteniendo la flexibilidad multi-tenant:

```sql
-- ✅ CORRECTO (dentro de settings JSONB)
UPDATE tenants 
SET settings = settings || '{"fb_page_id": "...", "fb_page_token": "..."}'::jsonb
WHERE slug = 'tenant-slug';
```

## 📊 Estructura de Datos

### Tabla `tenants`

```sql
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    whatsapp TEXT,
    settings JSONB DEFAULT '{}'::jsonb,  -- ← Aquí van los tokens
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Campo `settings` (JSONB)

```json
{
  // Configuración del bot
  "bot_enabled": true,
  "bot_off_message": "El asistente está temporalmente fuera de línea",
  "whatsapp_link": "https://wa.me/...",
  
  // Facebook/Instagram (multi-tenant)
  "fb_page_id": "123456789",
  "fb_page_token": "EAAxxxxx...",
  "fb_page_name": "Mi Página de Facebook",
  "ig_user_id": "987654321",
  "ig_user_ids": ["987654321"],
  
  // Otras configuraciones específicas del tenant
  "custom_prompt": "...",
  "timezone": "America/Mexico_City"
}
```

## 🔄 Flujo OAuth Multi-Tenant

### 1. Usuario inicia sesión
```
Usuario (tenant: acidia) → /login → Token JWT con tenant_slug
```

### 2. Conectar Facebook
```
Usuario → Dashboard → "Conectar Facebook"
↓
Backend genera auth_url con state JWT:
{
  "tenant_slug": "acidia",  ← Identifica al tenant
  "user_id": 123,
  "exp": ...
}
```

### 3. Callback de Facebook
```
Facebook → /auth/facebook/callback?code=xxx&state=yyy
↓
Backend valida state y extrae tenant_slug
↓
Guarda tokens EN EL TENANT CORRECTO:
UPDATE tenants 
SET settings = settings || '{"fb_page_id": "...", ...}'::jsonb
WHERE slug = 'acidia'  ← Aislamiento por tenant
```

### 4. Bot responde mensajes
```
Webhook de Facebook → /v1/meta/webhook
↓
Identifica tenant por fb_page_id o sender_id
↓
Busca credenciales: fb_tokens_from_tenant(tenant)
↓
Lee desde tenant.settings (JSONB)
↓
Responde usando el token del TENANT CORRECTO
```

## 🔐 Aislamiento de Datos

Cada tenant tiene sus propios tokens completamente aislados:

```python
# Función existente en main.py (línea 980)
def fb_tokens_from_tenant(t: dict | None) -> tuple[str, str, str]:
    """Obtiene credenciales de Meta para el tenant exclusivamente desde DB."""
    s = (t or {}).get("settings", {}) or {}
    
    page_id = s.get("fb_page_id")      # ← Por tenant
    page_token = s.get("fb_page_token")  # ← Por tenant
    ig_user_id = s.get("ig_user_id")    # ← Por tenant
    
    return page_id, page_token, ig_user_id
```

## 🎯 Beneficios Multi-Tenant

### 1. **Escalabilidad**
- Un solo servidor maneja múltiples clientes
- No necesitas deployar por cliente

### 2. **Flexibilidad**
- Cada tenant puede tener configuración única
- Agregar nuevos campos es trivial (JSONB)

### 3. **Seguridad**
- Tokens aislados por tenant
- JWT incluye tenant_slug para validación

### 4. **Mantenimiento**
- Una sola base de código
- Actualizaciones para todos los tenants

## 📝 Ejemplos de Uso

### Agregar nuevo tenant

```python
import asyncpg
from main import hash_password

conn = await asyncpg.connect(DATABASE_URL)

# Crear tenant
await conn.execute(
    "INSERT INTO tenants (slug, name, settings) VALUES ($1, $2, $3)",
    "nuevo-cliente", 
    "Nuevo Cliente S.A.",
    '{"bot_enabled": true}'  # Settings iniciales
)

# Crear usuario admin para ese tenant
pwd = hash_password("password123")
await conn.execute(
    "INSERT INTO users (email, password_hash, tenant_slug, role) VALUES ($1, $2, $3, $4)",
    "admin@nuevo-cliente.com", pwd, "nuevo-cliente", "admin"
)
```

### Conectar Facebook para un tenant

1. Login como usuario del tenant
2. Dashboard → Integraciones → Conectar Facebook
3. Los tokens se guardan automáticamente en `tenants.settings` del tenant correcto

### Ver configuración de un tenant

```sql
SELECT slug, name, settings 
FROM tenants 
WHERE slug = 'acidia';
```

```json
{
  "slug": "acidia",
  "name": "Acid IA",
  "settings": {
    "bot_enabled": true,
    "fb_page_id": "123456",
    "fb_page_token": "EAAxxxx",
    "fb_page_name": "Acid IA",
    "ig_user_id": "789012"
  }
}
```

## 🔧 Código Actualizado

### Backend (main.py)

**OAuth Callback** (línea ~2388):
```python
# Guardar en settings (multi-tenant)
current_settings = tenant["settings"] or {}
current_settings.update({
    "fb_page_id": page_id,
    "fb_page_token": page_token,
    "fb_page_name": page_name,
    "ig_user_id": ig_account_id
})

await conn.execute(
    text("UPDATE tenants SET settings = CAST(:settings AS JSONB) WHERE slug = :slug"),
    {"settings": json.dumps(current_settings), "slug": tenant_slug}
)
```

### Frontend (FacebookConnect.tsx)

```typescript
// Leer desde settings (multi-tenant)
const settings = tenant.settings || {}
const isConnected = settings.fb_page_id && settings.fb_page_token

{settings.fb_page_name && (
  <div>Página: {settings.fb_page_name}</div>
)}

{settings.ig_user_id && (
  <div>Instagram conectado</div>
)}
```

## 🚀 Mejoras Futuras

1. **Múltiples páginas por tenant**
   - Array de páginas en settings
   - Selector de página activa

2. **Rotación automática de tokens**
   - Job que refresca tokens cada 50 días
   - Notificación si falla

3. **Métricas por tenant**
   - Dashboard con analytics específicos
   - Comparativas entre tenants (admin)

4. **Rate limiting por tenant**
   - Límites configurables en settings
   - Quotas de mensajes

---

✅ **Arquitectura multi-tenant correctamente implementada**
