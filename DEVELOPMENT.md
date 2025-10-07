# Guía de Desarrollo - ZIA

Esta guía te ayudará a configurar tu entorno de desarrollo local con el backend y frontend integrados en un solo repositorio.

## Estructura del Proyecto

```
widget-backend/
├── main.py                     # Backend FastAPI
├── frontend/                   # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx            # Componente principal
│   │   ├── components/        # Componentes reutilizables
│   │   │   └── FacebookConnect.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── public/                     # Assets estáticos
├── requirements.txt           # Dependencias Python
├── .env                       # Variables de entorno (no subir a git)
├── .env.example              # Plantilla de variables de entorno
└── FACEBOOK_OAUTH_SETUP.md   # Guía de configuración de Facebook
```

## Requisitos Previos

- **Python 3.9+**
- **Node.js 18+** y **npm**
- **PostgreSQL** (local o remoto)
- Cuentas en:
  - OpenAI (para el chatbot)
  - Facebook Developers (para Meta/Instagram)
  - Twilio (para WhatsApp, opcional)
  - Stripe (para pagos, opcional)

## Configuración Inicial

### 1. Clonar y configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales
nano .env  # o usa tu editor favorito
```

Variables mínimas requeridas:

```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/zia_db
AUTH_SECRET=un-secreto-muy-seguro-cambiar-en-produccion
OPENAI_API_KEY=sk-...
META_APP_ID=tu-facebook-app-id
META_APP_SECRET=tu-facebook-app-secret
META_VERIFY_TOKEN=un-token-secreto-que-elijas
FACEBOOK_REDIRECT_URI=http://localhost:8000/auth/facebook/callback
FRONTEND_URL=http://localhost:5173
```

### 2. Configurar la base de datos

```bash
# Crear la base de datos (si no existe)
createdb zia_db

# El backend creará las tablas automáticamente al iniciar
```

### 3. Instalar dependencias del backend

```bash
# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# En Windows:
venv\Scripts\activate
# En Mac/Linux:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
```

### 4. Instalar dependencias del frontend

```bash
cd frontend
npm install
cd ..
```

## Desarrollo Local

### Opción 1: Ejecutar Backend y Frontend por separado (Recomendado)

En una terminal, ejecuta el backend:

```bash
# Activar entorno virtual si no está activado
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# Ejecutar backend en modo desarrollo
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

En otra terminal, ejecuta el frontend:

```bash
cd frontend
npm run dev
```

El frontend estará disponible en: http://localhost:5173
El backend estará disponible en: http://localhost:8000

### Opción 2: Script de desarrollo (Windows)

Crea un archivo `dev.bat`:

```batch
@echo off
start "Backend" cmd /k "venv\Scripts\activate && uvicorn main:app --reload"
start "Frontend" cmd /k "cd frontend && npm run dev"
```

Luego ejecuta: `dev.bat`

### Opción 3: Script de desarrollo (Mac/Linux)

Crea un archivo `dev.sh`:

```bash
#!/bin/bash
uvicorn main:app --reload &
cd frontend && npm run dev
```

Luego ejecuta: `chmod +x dev.sh && ./dev.sh`

## Configurar Facebook OAuth

Para conectar páginas de Facebook e Instagram, sigue la guía completa en:
- [FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md)

Pasos rápidos:

1. Crear app en Facebook Developers
2. Configurar productos: Facebook Login, Messenger, Instagram
3. Configurar webhooks apuntando a tu servidor
4. Copiar credenciales al `.env`
5. Probar la conexión desde el dashboard

## Webhooks en Desarrollo Local

Para recibir webhooks de Facebook/Meta en desarrollo local necesitas exponer tu servidor:

### Usando ngrok (Recomendado)

```bash
# Instalar ngrok: https://ngrok.com/download

# Exponer puerto 8000
ngrok http 8000

# Copiar la URL (ej: https://abc123.ngrok.io)
# Actualizar en Facebook App:
#   - Webhook URL: https://abc123.ngrok.io/v1/meta/webhook
#   - OAuth Redirect: https://abc123.ngrok.io/auth/facebook/callback
```

### Usando localtunnel

```bash
npm install -g localtunnel
lt --port 8000
```

## Testing

### Test del backend

```bash
# Verificar que el servidor esté corriendo
curl http://localhost:8000/

# Test de salud
curl http://localhost:8000/health

# Test de diagnóstico Meta (requiere autenticación)
curl -H "Authorization: Bearer TU_TOKEN" \
  http://localhost:8000/v1/admin/meta/diagnostics
```

### Test del frontend

```bash
cd frontend
npm run build  # Construir para producción
npm run preview  # Preview de la build
```

## Crear un Usuario Admin

Para acceder al dashboard necesitas crear un usuario:

```python
# Ejecutar en consola Python
python
```

```python
from main import hash_password
import asyncpg
import asyncio

async def create_user():
    conn = await asyncpg.connect("postgresql://user:password@localhost/zia_db")

    # Crear tenant
    tenant = await conn.fetchrow(
        "INSERT INTO tenants (slug, name) VALUES ($1, $2) RETURNING id",
        "demo", "Demo Company"
    )

    # Crear usuario admin
    password_hash = hash_password("tu-password-aqui")
    await conn.execute(
        "INSERT INTO users (email, password_hash, tenant_slug, role) VALUES ($1, $2, $3, $4)",
        "admin@demo.com", password_hash, "demo", "admin"
    )

    await conn.close()
    print("Usuario creado: admin@demo.com")

asyncio.run(create_user())
```

## Deployment

### Frontend

El frontend se puede deployar en:
- **Vercel** (Recomendado para Vite)
- **Netlify**
- **Cloudflare Pages**

```bash
cd frontend
npm run build

# El directorio dist/ contiene los archivos estáticos
```

Configurar variable de entorno en Vercel:
```
VITE_API_BASE=https://tu-backend.com
```

### Backend

El backend se puede deployar en:
- **Railway**
- **Render**
- **Fly.io**
- **Google Cloud Run**
- **AWS ECS/Lambda**

Asegúrate de configurar todas las variables de entorno en tu plataforma.

### Deployment conjunto (Monorepo)

Si prefieres deployar todo junto:

1. Construir el frontend:
```bash
cd frontend && npm run build && cd ..
```

2. Servir el frontend desde FastAPI:
```python
# En main.py, después de los otros mounts
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

3. Deploy como una sola aplicación

## Troubleshooting

### Error: "Database not configured"

- Verifica que `DATABASE_URL` esté correcta en `.env`
- Asegúrate de que PostgreSQL esté corriendo
- Verifica la conexión: `psql $DATABASE_URL`

### Error: "CORS policy"

- Verifica que `ALLOWED_ORIGINS` incluya tu URL del frontend
- En desarrollo: `http://localhost:5173,http://127.0.0.1:5173`

### Error: "Invalid OAuth redirect URI"

- La URL debe coincidir EXACTAMENTE con la configurada en Facebook
- Incluye el protocolo: `http://` o `https://`
- No incluyas slash al final

### Frontend no se conecta al backend

1. Verifica que el backend esté corriendo
2. Verifica la variable `VITE_API_BASE` en el frontend
3. Checa la consola del navegador para errores CORS

## Recursos

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [Facebook Developer Docs](https://developers.facebook.com/docs/)
- [Stripe API Docs](https://stripe.com/docs/api)

## Scripts Útiles

```bash
# Ver logs de PostgreSQL
tail -f /var/log/postgresql/postgresql-*.log

# Resetear base de datos (CUIDADO: borra todo)
dropdb zia_db && createdb zia_db

# Exportar leads a CSV
curl -H "X-Api-Key: TU_ADMIN_KEY" \
  http://localhost:8000/v1/admin/leads/export > leads.csv

# Ver webhooks de Meta en tiempo real
tail -f logs/app.log | grep META
```
