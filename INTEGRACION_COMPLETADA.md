# ✅ Integración Backend + Frontend Completada

## Resumen de Cambios

Se ha integrado exitosamente el backend (FastAPI) y frontend (React + Vite) en un solo repositorio monorepo, con soporte completo para autenticación OAuth de Facebook.

## Estructura Nueva del Proyecto

```
widget-backend/  (ahora es un monorepo completo)
├── main.py                          # ✅ Backend FastAPI con endpoints OAuth
├── frontend/                        # ✅ Frontend React (antes era "dashboard")
│   ├── src/
│   │   ├── App.jsx                 # ✅ Actualizado con tab de Integraciones
│   │   ├── components/
│   │   │   └── FacebookConnect.jsx # 🆕 Componente de conexión FB
│   │   ├── main.jsx
│   │   └── styles.css              # ✅ Estilos actualizados
│   ├── package.json
│   └── vite.config.js
├── .env.example                     # 🆕 Plantilla completa de variables
├── FACEBOOK_OAUTH_SETUP.md          # 🆕 Guía de configuración FB
├── DEVELOPMENT.md                   # 🆕 Guía de desarrollo
└── INTEGRACION_COMPLETADA.md        # 🆕 Este archivo
```

## Nuevas Funcionalidades

### Backend (main.py)

1. **Endpoints OAuth de Facebook** (líneas 2263-2438):
   - `GET /auth/facebook/connect` - Inicia flujo OAuth
   - `GET /auth/facebook/callback` - Maneja callback de Facebook
   - `POST /auth/facebook/disconnect` - Desconecta Facebook

2. **Flujo OAuth completo**:
   - Generación de state JWT con seguridad
   - Intercambio de código por access token
   - Conversión a long-lived token
   - Obtención automática de páginas de Facebook
   - Detección de Instagram Business Account asociado
   - Almacenamiento seguro en base de datos

3. **Permisos solicitados**:
   - `pages_show_list` - Ver páginas
   - `pages_read_engagement` - Leer engagement
   - `pages_manage_metadata` - Gestionar metadata
   - `pages_messaging` - Mensajes de Facebook
   - `instagram_basic` - Instagram básico
   - `instagram_manage_messages` - Mensajes de Instagram
   - `instagram_manage_comments` - Comentarios de Instagram

### Frontend (React)

1. **Nuevo componente FacebookConnect.jsx**:
   - Botón de conexión con Facebook
   - Estado visual de conexión (conectado/desconectado)
   - Información de la página conectada
   - Indicador de Instagram Business
   - Botón de desconexión
   - Manejo de errores y mensajes de éxito

2. **Nueva pestaña "Integraciones"** en App.jsx:
   - Vista dedicada para integraciones
   - Fácilmente extensible para otras plataformas

3. **Estilos mejorados** en styles.css:
   - Diseño moderno para cards de integración
   - Estados visuales claros
   - Botones con gradientes de Facebook
   - Responsive design

## Variables de Entorno Nuevas

Agregar al archivo `.env`:

```bash
# Facebook/Meta OAuth
META_APP_ID=tu-app-id
META_APP_SECRET=tu-app-secret
META_VERIFY_TOKEN=token-para-webhooks
FACEBOOK_REDIRECT_URI=http://localhost:8000/auth/facebook/callback
FRONTEND_URL=http://localhost:5173

# CORS (ya existía, pero ahora documentado)
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Cómo Usar

### 1. Desarrollo Local

```bash
# Terminal 1: Backend
venv\Scripts\activate  # Windows
uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

Accede a:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

### 2. Conectar Facebook

1. Ir a http://localhost:5173 e iniciar sesión
2. Click en "Integraciones" en el menú
3. Click en "Conectar con Facebook"
4. Autorizar los permisos en Facebook
5. ¡Listo! Tu bot responderá automáticamente

### 3. Configurar Facebook App

Sigue la guía detallada en [FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md)

Pasos básicos:
1. Crear app en developers.facebook.com
2. Configurar productos: Facebook Login, Messenger, Instagram
3. Configurar webhooks (requiere servidor público)
4. Copiar App ID y App Secret al `.env`

## Flujo Completo de OAuth

```
Usuario                 Frontend              Backend                Facebook
  |                        |                     |                      |
  |--[Click Conectar]----->|                     |                      |
  |                        |--[GET /connect]---->|                      |
  |                        |                     |--[Genera state JWT]->|
  |                        |<---[auth_url]-------|                      |
  |<--[Redirige a FB]------|                     |                      |
  |                        |                     |                      |
  |--[Autoriza permisos]-------------------------------->[Facebook Auth]|
  |                        |                     |                      |
  |<--[Callback con code]--------------------------[Redirect callback]-|
  |                        |                     |                      |
  |------------------------[GET /callback?code=xxx&state=yyy]---------->|
  |                        |                     |--[Valida state]----->|
  |                        |                     |--[Intercambia code]->|
  |                        |                     |<--[access_token]-----|
  |                        |                     |--[Get long token]--->|
  |                        |                     |<--[long token]-------|
  |                        |                     |--[Get pages]-------->|
  |                        |                     |<--[pages data]-------|
  |                        |                     |--[Get IG account]--->|
  |                        |                     |<--[IG data]----------|
  |                        |                     |--[Save to DB]------->|
  |<--[Redirect a dashboard?facebook_connected=true]-------------------|
  |                        |                     |                      |
  |--[Muestra éxito]------>|                     |                      |
```

## Base de Datos

Los tokens se guardan en la tabla `tenants`:

```sql
-- Columnas agregadas (si no existen ya):
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS meta_page_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS meta_page_token TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS meta_page_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS meta_ig_account_id TEXT;
```

## Próximos Pasos Sugeridos

1. **Agregar selector de páginas**:
   - Actualmente se guarda la primera página
   - Mejorar para que el usuario elija qué página conectar

2. **Rotación automática de tokens**:
   - Los page tokens de Facebook duran 60 días
   - Implementar renovación automática

3. **Gestión de múltiples páginas**:
   - Permitir conectar varias páginas por tenant
   - Tabla separada para páginas

4. **Webhooks en UI**:
   - Mostrar estado de webhooks
   - Botón para revalidar suscripciones

5. **Métricas de Facebook**:
   - Gráficas de mensajes por canal
   - Stats de respuesta automática

6. **Testing**:
   - Tests unitarios para endpoints OAuth
   - Tests E2E del flujo completo

## Testing Rápido

### Test manual del flujo:

1. **Backend está corriendo**:
```bash
curl http://localhost:8000/
# Debe responder con info del API
```

2. **Endpoint de conexión funciona**:
```bash
# Requiere token de autenticación
curl -H "Authorization: Bearer TU_TOKEN" \
  http://localhost:8000/auth/facebook/connect
# Debe retornar {"auth_url": "https://facebook.com/..."}
```

3. **Frontend carga**:
```bash
# Abrir http://localhost:5173
# Debe mostrar login
```

4. **Flujo completo**:
- Login → Dashboard → Integraciones → Conectar Facebook
- Autorizar en Facebook
- Regresar al dashboard
- Ver mensaje de éxito

## Archivos de Documentación

- **[FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md)**: Guía paso a paso de configuración de Facebook
- **[DEVELOPMENT.md](./DEVELOPMENT.md)**: Guía completa de desarrollo local y deployment
- **[.env.example](./.env.example)**: Plantilla de todas las variables de entorno

## Troubleshooting

### Error: "Invalid OAuth redirect URI"
✅ Solución: La URL en Facebook App Settings debe coincidir exactamente con `FACEBOOK_REDIRECT_URI`

### Error: "CORS policy blocked"
✅ Solución: Agregar frontend URL a `ALLOWED_ORIGINS`

### Error: "No se encontraron páginas"
✅ Solución: El usuario que autoriza debe ser admin de al menos una página de Facebook

### Frontend no conecta con backend
✅ Solución: Verificar que ambos estén corriendo y que `VITE_API_BASE` esté configurado

## Soporte

Si tienes problemas:

1. Revisa los logs del backend: `uvicorn` mostrará errores en consola
2. Revisa la consola del navegador: Chrome DevTools → Console
3. Verifica las variables de entorno: `echo $META_APP_ID`
4. Consulta los archivos de documentación
5. Revisa los webhooks en Facebook Developers

---

## ✨ ¡Felicitaciones!

Tu aplicación ahora tiene:
- ✅ Backend y Frontend integrados
- ✅ Autenticación OAuth de Facebook completa
- ✅ Conexión automática de Instagram Business
- ✅ UI moderna para gestionar integraciones
- ✅ Documentación completa

Todo listo para desarrollo y producción. 🚀
