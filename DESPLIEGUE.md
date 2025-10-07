# 🚀 Guía de Despliegue

## 📦 Repositorio Único

Todo el proyecto está en: **widget-backend** (https://github.com/luisu-dev/widget-backend)

```
widget-backend/
├── main.py              # Backend FastAPI
├── frontend/            # Frontend React + TypeScript
├── requirements.txt
└── .env.example
```

## 🎯 Estrategia: Frontend (Vercel) + Backend (Render)

### 1️⃣ Preparar el Repositorio

```bash
cd /c/Users/id_lu/widget-backend

# Agregar todos los cambios
git add .

# Commit
git commit -m "feat: Integración completa frontend (AcidIA) + backend + OAuth Facebook multi-tenant"

# Push a GitHub
git push origin main
```

### 2️⃣ Desplegar Frontend en Vercel

#### A. Importar Proyecto

1. Ve a [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Selecciona tu repositorio: `widget-backend`
4. Click "Import"

#### B. Configuración

```yaml
Project Name: acidia-frontend (o el nombre que quieras)
Framework Preset: Vite
Root Directory: frontend       # ← IMPORTANTE
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

#### C. Variables de Entorno

En Vercel → Settings → Environment Variables:

```bash
VITE_API_BASE=https://tu-backend.onrender.com
```

**⚠️ IMPORTANTE**: Después de desplegar el backend, regresa aquí y actualiza esta URL.

#### D. Desplegar

Click "Deploy" y espera ~2 minutos.

Tu frontend estará en: `https://tu-proyecto.vercel.app`

### 3️⃣ Desplegar Backend en Render

#### A. Crear Web Service

1. Ve a [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Conecta tu repositorio GitHub: `widget-backend`

#### B. Configuración

```yaml
Name: zia-backend (o el nombre que quieras)
Region: Oregon (US West)
Branch: main
Root Directory: .              # ← Raíz del proyecto
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
Instance Type: Free (para empezar)
```

#### C. Variables de Entorno

En Render → Environment → Add Environment Variable:

```bash
# Database (usa Render PostgreSQL o tu propio DB)
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db

# Auth
AUTH_SECRET=tu-secreto-muy-seguro-cambiar
AUTH_TOKEN_TTL=60

# OpenAI
OPENAI_API_KEY=sk-...

# Facebook OAuth
META_APP_ID=tu-facebook-app-id
META_APP_SECRET=tu-facebook-app-secret
META_VERIFY_TOKEN=tu-verify-token
FACEBOOK_REDIRECT_URI=https://tu-backend.onrender.com/auth/facebook/callback
FRONTEND_URL=https://tu-proyecto.vercel.app

# CORS
ALLOWED_ORIGINS=https://tu-proyecto.vercel.app,http://localhost:5173

# Stripe (si usas)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=https://tu-proyecto.vercel.app

# Twilio (si usas)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx

# General
PORT=10000
PYTHON_VERSION=3.11.0
```

#### D. Crear Base de Datos PostgreSQL (Render)

1. En Render Dashboard → "New +" → "PostgreSQL"
2. Nombre: `zia-db`
3. Una vez creado, copia la "Internal Database URL"
4. Pégala en `DATABASE_URL` del Web Service

#### E. Desplegar

Click "Create Web Service" y espera ~5 minutos.

Tu backend estará en: `https://tu-backend.onrender.com`

### 4️⃣ Actualizar URLs Cruzadas

#### A. Actualizar Frontend (Vercel)

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Edita `VITE_API_BASE`:
   ```
   VITE_API_BASE=https://tu-backend.onrender.com
   ```
4. Redeploy: Deployments → Latest → ⋯ → Redeploy

#### B. Actualizar Backend (Render)

1. Ve a tu servicio en Render
2. Environment → Edita:
   ```
   FRONTEND_URL=https://tu-proyecto.vercel.app
   ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
   ```
3. Guarda (auto-redeploy)

### 5️⃣ Configurar Facebook App (Producción)

1. Ve a [developers.facebook.com](https://developers.facebook.com)
2. Tu App → Settings → Basic
3. App Domains: `tu-proyecto.vercel.app`
4. Facebook Login → Settings:
   - Valid OAuth Redirect URIs:
     ```
     https://tu-backend.onrender.com/auth/facebook/callback
     ```
5. Webhooks:
   - Callback URL: `https://tu-backend.onrender.com/v1/meta/webhook`
   - Verify Token: (el mismo de `META_VERIFY_TOKEN`)

### 6️⃣ Configurar Stripe Webhooks (Opcional)

1. Ve a [dashboard.stripe.com](https://dashboard.stripe.com)
2. Developers → Webhooks → Add endpoint
3. Endpoint URL: `https://tu-backend.onrender.com/v1/stripe/webhook`
4. Events: `checkout.session.completed`, `invoice.paid`
5. Copia el "Signing secret" → `STRIPE_WEBHOOK_SECRET` en Render

## 🧪 Probar en Producción

### 1. Verificar Backend

```bash
curl https://tu-backend.onrender.com/
# Debe responder con info del API
```

### 2. Verificar Frontend

Abre: `https://tu-proyecto.vercel.app`
- Debería cargar el landing page
- Navega a `/login`
- Intenta login

### 3. Probar OAuth Facebook

1. Login en dashboard
2. Ve a Integraciones
3. Click "Conectar con Facebook"
4. Autoriza
5. Debería redirigir al dashboard con éxito

## 🐛 Troubleshooting

### Error: CORS blocked

**Problema**: Frontend no puede conectar con backend

**Solución**:
```bash
# En Render, verifica que ALLOWED_ORIGINS incluya tu URL de Vercel
ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
```

### Error: Invalid OAuth redirect URI

**Problema**: Facebook rechaza el callback

**Solución**:
- Verifica que la URL en Facebook App coincida EXACTAMENTE con:
  ```
  https://tu-backend.onrender.com/auth/facebook/callback
  ```

### Error: Database connection failed

**Problema**: Backend no puede conectar a PostgreSQL

**Solución**:
- Usa la "Internal Database URL" de Render
- Formato: `postgresql+asyncpg://user:pass@host:5432/db`

### Backend tarda en responder (Cold Start)

**Problema**: Render Free tier duerme después de inactividad

**Solución**:
- Upgrade a paid tier ($7/mo)
- O acepta los ~30s de cold start inicial

## 📊 Monitoreo

### Logs del Backend (Render)

1. Ve a tu servicio en Render
2. Tab "Logs"
3. Verás todos los logs en tiempo real

### Logs del Frontend (Vercel)

1. Ve a tu proyecto en Vercel
2. Deployments → Latest deployment
3. Tab "Functions" (si usas serverless functions)

### Métricas

- **Render**: Dashboard → Service → Metrics
- **Vercel**: Analytics (disponible en planes pagos)

## 🔄 Actualizaciones Futuras

### Actualizar Código

```bash
# Hacer cambios
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main

# Auto-deploy en ambos servicios
# Vercel: ~2 min
# Render: ~5 min
```

### Actualizar Solo Frontend

```bash
cd frontend
# hacer cambios
cd ..
git add frontend/
git commit -m "fix: corregir UI"
git push

# Solo Vercel redeploya
```

### Actualizar Solo Backend

```bash
# hacer cambios en main.py
git add main.py
git commit -m "fix: corregir endpoint"
git push

# Solo Render redeploya
```

## 💰 Costos Estimados

### Gratis (para empezar)
- **Vercel**: Free tier (100GB bandwidth/mes)
- **Render**: Free tier (750 hrs/mes, cold start)
- **PostgreSQL**: Free tier (90 días, luego $7/mo)

### Producción
- **Vercel Pro**: $20/mo (más bandwidth, analytics)
- **Render Starter**: $7/mo (sin cold start)
- **PostgreSQL**: $7/mo
- **Total**: ~$34/mo

## ✅ Checklist de Despliegue

- [ ] Push código a GitHub
- [ ] Desplegar frontend en Vercel
- [ ] Desplegar backend en Render
- [ ] Crear base de datos PostgreSQL
- [ ] Configurar variables de entorno (ambos)
- [ ] Actualizar URLs cruzadas
- [ ] Configurar Facebook App para producción
- [ ] Configurar Stripe webhooks
- [ ] Crear usuario admin en DB
- [ ] Probar login
- [ ] Probar OAuth Facebook
- [ ] Probar checkout Stripe (si aplica)

---

¡Listo para producción! 🚀
