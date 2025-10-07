# ✅ Integración Final: widget-backend + AcidIA

## 🎉 Se integró exitosamente

- ✅ Backend widget-backend + Frontend AcidIA
- ✅ Landing page de AcidIA (React + TypeScript + Tailwind)
- ✅ Dashboard administrativo con autenticación  
- ✅ Sistema OAuth completo para Facebook/Instagram
- ✅ Todo en un solo monorepo

## 📂 Estructura

```
widget-backend/
├── main.py                              # Backend FastAPI con OAuth
├── frontend/                            # Frontend integrado
│   ├── src/
│   │   ├── App.tsx                     # Router
│   │   ├── pages/
│   │   │   ├── Landing.tsx             # Landing AcidIA
│   │   │   ├── Login.tsx               # Login
│   │   │   └── Dashboard.tsx           # Dashboard
│   │   └── components/dashboard/
│   │       └── FacebookConnect.tsx     # OAuth FB
│   └── .env
└── .env
```

## 🚀 Ejecutar

**Terminal 1 - Backend:**
```bash
venv\Scripts\activate
uvicorn main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install  # primera vez
npm run dev
```

Acceder a:
- Landing: http://localhost:5173
- Login: http://localhost:5173/login
- Dashboard: http://localhost:5173/dashboard

## 🔑 Variables de Entorno

**Backend (.env en raíz):**
```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost/zia_db
AUTH_SECRET=tu-secreto
OPENAI_API_KEY=sk-...
META_APP_ID=tu-facebook-app-id
META_APP_SECRET=tu-facebook-app-secret
META_VERIFY_TOKEN=token-para-webhooks
FACEBOOK_REDIRECT_URI=http://localhost:8000/auth/facebook/callback
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Frontend (frontend/.env):**
```bash
VITE_API_BASE=http://localhost:8000
```

## 👤 Crear Usuario Admin

```python
python
from main import hash_password
import asyncpg, asyncio

async def create_user():
    conn = await asyncpg.connect("postgresql://user:password@localhost/zia_db")
    await conn.execute(
        "INSERT INTO tenants (slug, name) VALUES ($1, $2)",
        "acidia", "Acid IA"
    )
    password_hash = hash_password("tu-password")
    await conn.execute(
        "INSERT INTO users (email, password_hash, tenant_slug, role) VALUES ($1, $2, $3, $4)",
        "admin@acidia.com", password_hash, "acidia", "admin"
    )
    await conn.close()
    print("✅ Usuario creado")

asyncio.run(create_user())
```

## 📋 Rutas

- `/` - Landing
- `/login` - Login
- `/dashboard` - Dashboard (requiere auth)
- `/privacy`, `/terms`, `/data-deletion` - Legales

## 🔧 Configurar Facebook

Ver: [FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md)

1. Crear app en developers.facebook.com
2. Configurar productos: Facebook Login, Messenger, Instagram
3. Configurar OAuth Redirect: http://localhost:8000/auth/facebook/callback
4. Configurar Webhooks: https://tu-dominio.com/v1/meta/webhook
5. Copiar credenciales al .env

## 📚 Más Info

- [FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md) - Guía Facebook
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Desarrollo completo
- [.env.example](./.env.example) - Variables

¡Todo listo! 🎉
