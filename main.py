import os, uuid, time, asyncio, json, logging, re, secrets, hashlib, base64
from collections import OrderedDict
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Request, Header, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import StreamingResponse, Response
from dotenv import load_dotenv
from pydantic import BaseModel, Field, EmailStr
from openai import OpenAI, OpenAIError
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy import text
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse, quote_plus
import csv, io
from twilio.rest import Client as TwilioClient
from twilio.twiml.messaging_response import MessagingResponse
from twilio.request_validator import RequestValidator
import httpx
import jwt
import hmac, hashlib
import stripe
from io import BytesIO
import qrcode
from fastapi.responses import StreamingResponse
import mimetypes



# ── Setup ──────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("zia")
log.setLevel(logging.INFO)

app = FastAPI(title="ZIA Backend", version="1.1")
client = OpenAI()  # usa OPENAI_API_KEY del entorno

# Ensure correct MIME types for static assets on some platforms
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")

# ── Config ─────────────────────────────────────────────────────────────
# ── Config ─────────────────────────────────────────────────────────────
def as_bool(val: Optional[str], default: bool = False) -> bool:
    if val is None:
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "y", "on")


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    raw = raw.strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        log.warning(f"[config] {name} inválido='{raw}', usando {default}")
        return default


def _pbkdf2(password: str, salt: bytes) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return base64.urlsafe_b64encode(dk).decode("utf-8")


def hash_password(password: str, salt: Optional[str] = None) -> str:
    if not password:
        raise ValueError("password vacío")
    if salt is None:
        salt_bytes = secrets.token_bytes(16)
        salt_str = base64.urlsafe_b64encode(salt_bytes).decode("utf-8")
    else:
        salt_str = salt
        salt_bytes = base64.urlsafe_b64decode(salt.encode("utf-8"))
    hashed = _pbkdf2(password, salt_bytes)
    return f"{salt_str}:{hashed}"


def verify_password(password: str, stored: str) -> bool:
    if not stored or ":" not in stored:
        return False
    salt_str, hashed = stored.split(":", 1)
    try:
        salt_bytes = base64.urlsafe_b64decode(salt_str.encode("utf-8"))
    except Exception:
        return False
    calc = _pbkdf2(password, salt_bytes)
    return secrets.compare_digest(calc, hashed)


def create_access_token(user_id: int, tenant_slug: str, ttl_minutes: Optional[int] = None) -> str:
    if not AUTH_SECRET:
        raise RuntimeError("AUTH_SECRET no configurado")
    ttl = ttl_minutes if ttl_minutes is not None else AUTH_TOKEN_TTL_MINUTES
    exp = datetime.now(timezone.utc) + timedelta(minutes=max(5, ttl))
    payload = {
        "sub": str(user_id),
        "tenant": tenant_slug,
        "exp": exp,
    }
    return jwt.encode(payload, AUTH_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    if not AUTH_SECRET:
        raise RuntimeError("AUTH_SECRET no configurado")
    try:
        payload = jwt.decode(token, AUTH_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
ALLOWED_ORIGIN_REGEX = (os.getenv("ALLOWED_ORIGIN_REGEX", "") or "").strip()

DATABASE_URL   = os.getenv("DATABASE_URL", "")
DB_DRIVER      = (os.getenv("DB_DRIVER", "asyncpg") or "").strip().lower()  # 'asyncpg' | 'psycopg'
USE_MOCK       = as_bool(os.getenv("USE_MOCK"), False)
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
RATE_LIMIT     = env_int("RATE_LIMIT", 20)
RATE_WINDOW_SECONDS = env_int("RATE_WINDOW_SECONDS", 10)
ADMIN_KEY      = os.getenv("ADMIN_KEY", "")
PROXY_IP_HEADER = os.getenv("PROXY_IP_HEADER", "").lower()
AUTH_SECRET    = os.getenv("AUTH_SECRET", "").strip()
AUTH_TOKEN_TTL_MINUTES = env_int("AUTH_TOKEN_TTL", 60)

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN  = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")
TWILIO_SMS_FROM       = os.getenv("TWILIO_SMS_FROM", "")
TWILIO_VALIDATE_SIGNATURE = as_bool(os.getenv("TWILIO_VALIDATE_SIGNATURE"), False)

# ← NUEVO: evita NameError en el webhook
META_DRY_RUN = as_bool(os.getenv("META_DRY_RUN"), False)
META_DEFAULT_TENANT = os.getenv("META_DEFAULT_TENANT", "").strip()
META_SEEN_TTL = env_int("META_SEEN_TTL_SECONDS", 300)
META_SEEN_MAX = env_int("META_SEEN_MAX", 500)
#stripe keys 
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
SITE_URL = os.getenv("SITE_URL", "https://web-zia.vercel.app")
GRAPH = "https://graph.facebook.com/v20.0"

stripe.api_key = STRIPE_SECRET_KEY

# ── Constantes de la aplicación ───────────────────────────────────────────
MAX_TEXT_LENGTH = 2000  # Longitud máxima de texto en respuestas
MAX_MESSAGE_CONTENT_LENGTH = 4000  # Longitud máxima de contenido de mensaje en DB
CATALOG_MAX_ITEMS = 14  # Máximo de productos en catálogo
CATALOG_MAX_DESC_LENGTH = 120  # Máximo de caracteres en descripción de producto
CHAT_MAX_HISTORY_PAIRS = 8  # Máximo de pares de mensajes en historial de chat
OPENAI_RETRY_DELAY = 0.7  # Segundos de espera entre reintentos de OpenAI
CATALOG_FETCH_TIMEOUT = 6  # Timeout en segundos para fetch de catálogo
DB_CONNECT_TIMEOUT = 5  # Timeout en segundos para conexión a DB

ZIA_SYSTEM_PROMPT = (
    "Eres el asistente de {brand}. "
    "Objetivo: resolver dudas frecuentes, sugerir soluciones y guiar al usuario a la siguiente acción. "
    "Tono: cálido y directo. Español por defecto; si el usuario cambia de idioma, adáptate. "
    "Políticas: no inventes precios ni promesas; si faltan datos, dilo y ofrece agendar demo o cotización. "
    "No pidas datos sensibles; para contacto, solo nombre y email o WhatsApp cuando el usuario acepte. "
    "Interpreta con base en los últimos 5 pasos de la conversación. "
    "Acciones (menciónalas cuando encajen): • Agendar demo • Cotizar proyecto • Automatizar WhatsApp/Meta • Hablar por WhatsApp. "
    "Reglas de contacto: No prometas seguimiento proactivo; pide que la persona inicie el contacto por WhatsApp o propón agenda. "
    "Si el usuario expresa intención de comprar/suscribirse, ofrece enlace de pago directo (Stripe Checkout) y confirma."
)


# ── CORS ───────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_origin_regex=ALLOWED_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static assets for the embeddable widget - with custom MIME types
@app.get("/widget/{file_path:path}")
async def serve_widget_file(file_path: str):
    """Serve widget static files with correct MIME types"""
    from pathlib import Path
    import os

    # Use absolute path relative to main.py location
    base_dir = Path(__file__).parent
    widget_dir = base_dir / "public" / "widget"
    file_full_path = widget_dir / file_path

    # Security: prevent directory traversal
    try:
        file_full_path = file_full_path.resolve()
        widget_dir = widget_dir.resolve()

        # Debug logging
        log.info(f"[widget] Requested: {file_path}")
        log.info(f"[widget] Base dir: {base_dir}")
        log.info(f"[widget] Widget dir: {widget_dir}")
        log.info(f"[widget] Full path: {file_full_path}")
        log.info(f"[widget] Exists: {file_full_path.is_file()}")

        if not str(file_full_path).startswith(str(widget_dir)):
            log.warning(f"[widget] Directory traversal attempt: {file_path}")
            raise HTTPException(403, "Access denied")
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"[widget] Path resolution error: {e}")
        raise HTTPException(403, "Access denied")

    if not file_full_path.is_file():
        log.warning(f"[widget] File not found: {file_full_path}")
        raise HTTPException(404, "File not found")

    # Determine MIME type
    ext = file_full_path.suffix.lower()
    mime_types_map = {
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
    }
    content_type = mime_types_map.get(ext, 'application/octet-stream')

    # Read and serve file
    with open(file_full_path, 'rb') as f:
        content = f.read()

    # Ensure correct Content-Type header
    response_headers = {
        'Cache-Control': 'public, max-age=31536000',
        'X-Content-Type-Options': 'nosniff',
        'Content-Type': content_type,  # Explicitly set Content-Type
    }

    return Response(
        content=content,
        media_type=content_type,
        headers=response_headers
    )

# Admin dashboard frontend (React/Vue/etc compilado)
try:
    app.mount("/admin", StaticFiles(directory="public/admin", html=True), name="admin")
except Exception as _e:
    # En desarrollo puede no existir todavía
    pass

# ── Auth util ──────────────────────────────────────────────────────────
async def require_admin(x_api_key: str = Header(default="")):
    if not ADMIN_KEY or x_api_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


async def require_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization")
    payload = decode_access_token(token)
    user = await fetch_user_by_id(int(payload.get("sub", 0)))
    if not user or user.get("tenant_slug") != payload.get("tenant"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    request.state.user = user
    return user

# ── Network helpers ────────────────────────────────────────────────────
def get_client_ip(request: Request) -> str:
    if PROXY_IP_HEADER and PROXY_IP_HEADER in request.headers:
        return request.headers[PROXY_IP_HEADER].split(",")[0].strip()
    return request.client.host

def sse_event(data: str, event: Optional[str] = None) -> str:
    if event:
        return f"event: {event}\ndata: {data}\n\n"
    return f"data: {data}\n\n"

# ── Rate limit (en memoria) ────────────────────────────────────────────
RATELIMIT: Dict[str, list[float]] = {}
def is_rate_limited(key: str, limit: int = RATE_LIMIT, window: int = RATE_WINDOW_SECONDS) -> bool:
    now = time.time()
    bucket = [ts for ts in RATELIMIT.get(key, []) if ts > now - window]
    if len(bucket) >= limit:
        RATELIMIT[key] = bucket
        return True
    bucket.append(now)
    if bucket:
        RATELIMIT[key] = bucket
    else:
        RATELIMIT.pop(key, None)
    return False

# ── Token rough count (opcional) ───────────────────────────────────────
def rough_token_count(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)

# ── Utils de contacto ──────────────────────────────────────────────────
def clean_phone_for_wa(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits or None


def tenant_whatsapp_url(tenant: Optional[dict], prefill: Optional[str] = None) -> Optional[str]:
    s = (tenant or {}).get("settings", {}) or {}
    candidates = [
        (tenant or {}).get("whatsapp"),
        s.get("whatsapp_number"),
        s.get("whatsapp"),
    ]
    for candidate in candidates:
        num = clean_phone_for_wa(candidate)
        if num:
            if prefill:
                return f"https://wa.me/{num}?text={quote_plus(prefill)}"
            return f"https://wa.me/{num}"

    link_candidates = [
        s.get("whatsapp_link"),
        s.get("whatsapp_url"),
        s.get("whatsapp_href"),
    ]
    for link in link_candidates:
        if isinstance(link, str) and link.strip():
            return link.strip()
    return None

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
def is_email(s: str) -> bool:
    return bool(EMAIL_RE.match((s or "").strip().lower()))

def is_phone(s: str) -> bool:
    digits = "".join(ch for ch in (s or "") if ch.isdigit())
    return 8 <= len(digits) <= 15

def norm_phone(s: str) -> str:
    return "".join(ch for ch in (s or "") if ch.isdigit())

def wants_quote(text: str) -> bool:
    t = (text or "").lower()
    keys = ["cotiza", "cotización", "cotizar", "presupuesto", "precio", "quote"]
    return any(k in t for k in keys)

def valid_slug(slug: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9\-]{1,40}", (slug or "")))

#---- Modelos de Checkout 

class CheckoutItemIn(BaseModel):
    price_id: Optional[str] = None
    product_id: Optional[str] = None
    quantity: int = 1
    mode: Optional[str] = None  # "payment" | "subscription" | None (auto)

#Modelo de chekout para whatsapp

class SendWaCheckoutIn(BaseModel):
    to: str                         # E.164 o con lada; ej. 52155...
    price_id: Optional[str] = None
    product_id: Optional[str] = None
    plan: Optional[str] = None      # "starter" | "meta"
    quantity: int = 1
    mode: Optional[str] = None     


# ── DB helpers ─────────────────────────────────────────────────────────
def to_sqlalchemy_url(url: str, driver: str = "asyncpg") -> str:
    """Normaliza una URL de Postgres al esquema correcto para SQLAlchemy.

    driver: 'asyncpg' (por defecto) o 'psycopg'.
    """
    if not url:
        return ""
    # Normaliza prefijo básico
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    # Elimina sufijos de driver previos si existen
    url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    url = url.replace("postgresql+psycopg://", "postgresql://", 1)

    p = urlparse(url)
    q = dict(parse_qsl(p.query, keep_blank_values=True))
    # Normaliza parámetros SSL comunes
    if "sslmode" in q:
        val = (q.pop("sslmode") or "").lower()
        if val in ("disable", "allow", "prefer", "require", "verify-ca", "verify-full"):
            q["ssl"] = val
    if "ssl" in q:
        v = (q["ssl"] or "").lower()
        if v in ("true", "1", "yes"):
            q["ssl"] = "require"
        elif v in ("false", "0", "no"):
            q["ssl"] = "disable"
    if "ssl" not in q:
        q["ssl"] = "require"
    new_query = urlencode(q)
    # Selecciona esquema según driver deseado
    scheme = "postgresql+psycopg" if driver == "psycopg" else "postgresql+asyncpg"
    return urlunparse((scheme, p.netloc, p.path, p.params, new_query, p.fragment))

async def update_tenant_settings(slug: str, patch: dict):
    if not db_engine:
        raise HTTPException(503, "Database not configured")
    async with db_engine.begin() as conn:
        await conn.execute(
            text("""
                UPDATE tenants
                SET settings = COALESCE(settings,'{}'::jsonb) || CAST(:patch AS JSONB),
                    updated_at = NOW()
                WHERE slug = :slug
            """),
            {"slug": slug, "patch": json.dumps(patch)}
        )

async def find_tenant_by_acct(acct_id: str) -> Optional[str]:
    if not (db_engine and acct_id):
        return None
    async with db_engine.connect() as conn:
        row = (await conn.execute(
            text("SELECT slug FROM tenants WHERE settings->>'stripe_acct' = :acct LIMIT 1"),
            {"acct": acct_id}
        )).first()
    return row[0] if row else None

def _tenant_stripe_acct(t: Optional[dict]) -> str:
    return str(((t or {}).get("settings") or {}).get("stripe_acct") or "")

def _tenant_stripe_prices(t: Optional[dict]) -> dict:
    return ((t or {}).get("settings") or {}).get("stripe_prices") or {}

async def ensure_prices_for_tenant(t: dict, mxn_starter_cents: int = 150000, mxn_meta_cents: int = 100000) -> dict:
    acct = _tenant_stripe_acct(t)
    if not acct:
        raise HTTPException(400, "Tenant sin stripe_acct (conecta Stripe primero)")

    prices = _tenant_stripe_prices(t).copy()
    changed = False

    if "starter" not in prices:
        p = stripe.Price.create(
            currency="mxn",
            unit_amount=mxn_starter_cents,
            recurring={"interval": "month"},
            product_data={"name": "ZIA Starter"},
            stripe_account=acct,
        )
        prices["starter"] = p.id
        changed = True

    if "meta" not in prices:
        p = stripe.Price.create(
            currency="mxn",
            unit_amount=mxn_meta_cents,
            recurring={"interval": "month"},
            product_data={"name": "ZIA Meta"},
            stripe_account=acct,
        )
        prices["meta"] = p.id
        changed = True

    if changed:
        await update_tenant_settings(t["slug"], {"stripe_prices": prices})

    return prices


async def _create_checkout_for_any(
    t: Optional[dict],
    price_id: Optional[str] = None,
    product_id: Optional[str] = None,
    qty: int = 1,
    mode: Optional[str] = None
) -> dict:
    acct = _tenant_stripe_acct(t)
    if not acct:
        raise HTTPException(400, "Tenant no tiene Stripe conectado (stripe_acct)")

    if not price_id and product_id:
        try:
            prod = stripe.Product.retrieve(product_id, expand=["default_price"], stripe_account=acct)
            dp = getattr(prod, "default_price", None)
            price_id = getattr(dp, "id", "") if dp else ""
        except Exception as e:
            log.error(f"Stripe Product.retrieve error: {e}")
            raise HTTPException(400, "Producto sin price válido")

    if not price_id:
        raise HTTPException(400, "Falta price_id o product_id con default_price")

    if mode is None:
        try:
            price = stripe.Price.retrieve(price_id, stripe_account=acct)
            mode = "subscription" if getattr(price, "recurring", None) else "payment"
        except Exception as e:
            log.warning(f"No se pudo leer Price para autodetección, fallback a 'payment': {e}")
            mode = "payment"

    if mode not in {"payment", "subscription"}:
        raise HTTPException(400, "mode inválido (usa 'payment' o 'subscription')")

    try:
        kwargs = dict(
            mode=mode,
            line_items=[{"price": price_id, "quantity": max(1, int(qty))}],
            success_url=f"{SITE_URL}/pago-exitoso?sid={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{SITE_URL}/pago-cancelado",
            metadata={
                "tenant": (t or {}).get("slug", "public"),
                "source": "catalog",
                "price_id": price_id,
                "product_id": product_id or None,
            },
            stripe_account=acct,
        )
        if mode == "payment":
            kwargs["customer_creation"] = "always"

        session = stripe.checkout.Session.create(**kwargs)

    except Exception as e:
        log.error(f"Stripe checkout.Session.create error: {e}")
        raise HTTPException(502, "No se pudo crear la sesión de pago")

    return {"id": session.id, "url": session.url, "mode": mode}



ASYNC_DB_URL = to_sqlalchemy_url(DATABASE_URL, DB_DRIVER)
db_engine: Optional[AsyncEngine] = None

@app.on_event("startup")
async def on_startup():
    global db_engine

    # Validar secretos críticos
    required_secrets = {
        "AUTH_SECRET": AUTH_SECRET,
        "ADMIN_KEY": ADMIN_KEY,
    }
    missing = [k for k, v in required_secrets.items() if not v or not v.strip()]
    if missing:
        raise RuntimeError(f"❌ Secretos requeridos no configurados: {', '.join(missing)}")

    # Validar secretos de servicios si están en uso
    if STRIPE_SECRET_KEY and not STRIPE_WEBHOOK_SECRET:
        log.warning("⚠️  STRIPE_SECRET_KEY configurado pero falta STRIPE_WEBHOOK_SECRET")

    if (TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN) and not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN):
        log.warning("⚠️  Credenciales de Twilio incompletas")

    log.info("✅ Validación de secretos completada")

    # DB: si no hay URL, seguimos sin persistencia
    if not ASYNC_DB_URL:
        log.warning("DATABASE_URL no seteado: corriendo sin persistencia")
        db_engine = None
    else:
        db_engine = create_async_engine(
            ASYNC_DB_URL,
            echo=False,
            pool_pre_ping=True,
        )

        try:
            async with db_engine.begin() as conn:
                # Evita que Render se “cuelgue” si la DB tarda
                await asyncio.wait_for(conn.execute(text("SELECT 1")), timeout=5.0)

                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS tenants (
                        id SERIAL PRIMARY KEY,
                        slug TEXT UNIQUE NOT NULL,
                        name TEXT NOT NULL,
                        whatsapp TEXT,
                        settings JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """))
                await conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS leads (
                        id SERIAL PRIMARY KEY,
                        tenant_slug TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        name TEXT,
                        method TEXT CHECK (method IN ('whatsapp','email','llamada')),
                        contact TEXT,
                        meta JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_slug)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS events (
                        id SERIAL PRIMARY KEY,
                        tenant_slug TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        type TEXT NOT NULL,
                        payload JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_slug, type, created_at DESC)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        tenant_slug TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role TEXT DEFAULT 'tenant_admin',
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_slug)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS messages (
                        id BIGSERIAL PRIMARY KEY,
                        tenant_slug TEXT NOT NULL,
                        session_id TEXT,
                        channel TEXT,
                        direction TEXT CHECK (direction IN ('in','out')),
                        author TEXT,
                        content TEXT,
                        payload JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_slug, created_at DESC)"
                ))

            log.info("Postgres listo ✅")

        except Exception as e:
            # No bloquees el arranque si la DB falla/tarda
            log.error(f"DB startup check failed, continuo sin persistencia: {e}")
            db_engine = None

    # Twilio: inicializa si hay credenciales
    app.state.twilio = None
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        try:
            app.state.twilio = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            log.info("Twilio listo ✅")
        except Exception as e:
            log.warning(f"Twilio no inicializado: {e}")

    # Iniciar tarea de limpieza de sesiones en background
    asyncio.create_task(cleanup_old_sessions())
    log.info("🧹 Tarea de limpieza de sesiones iniciada")


async def store_event(tenant_slug: str, sid: str, etype: str, payload: dict | None = None):
    if not db_engine:
        return
    async with db_engine.begin() as conn:
        await conn.execute(
            text("""INSERT INTO events (tenant_slug, session_id, type, payload)
                    VALUES (:tenant, :sid, :type, CAST(:payload AS JSONB))"""),
            {"tenant": tenant_slug or "public", "sid": sid, "type": etype, "payload": json.dumps(payload or {})}
        )


async def log_message(tenant_slug: str, sid: str, channel: str, direction: str, content: str, author: Optional[str] = None, payload: Optional[dict] = None):
    if not db_engine:
        return
    async with db_engine.begin() as conn:
        await conn.execute(
            text("""INSERT INTO messages (tenant_slug, session_id, channel, direction, author, content, payload)
                    VALUES (:tenant, :sid, :channel, :direction, :author, :content, CAST(:payload AS JSONB))"""),
            {
                "tenant": tenant_slug or "public",
                "sid": sid,
                "channel": channel,
                "direction": direction,
                "author": author,
                "content": content[:MAX_MESSAGE_CONTENT_LENGTH] if content else None,
                "payload": json.dumps(payload or {}),
            }
        )

def _twilio_req_is_valid(request: Request, auth_token: str) -> bool:
    """Valida la firma de Twilio en webhooks para prevenir solicitudes falsificadas."""
    if not TWILIO_VALIDATE_SIGNATURE:
        return True

    if not auth_token:
        log.warning("TWILIO_VALIDATE_SIGNATURE activado pero auth_token vacío")
        return False

    try:
        sig = request.headers.get("X-Twilio-Signature", "")
        if not sig:
            log.warning("Solicitud Twilio sin X-Twilio-Signature header")
            return False

        # Construir URL completa
        url = str(request.url)

        # Obtener parámetros del form body
        validator = RequestValidator(auth_token)

        # Para validación, necesitamos los parámetros del POST como dict
        # RequestValidator espera un dict de strings
        params = {}
        if request.method == "POST":
            # Los parámetros ya están en request.form pero necesitamos convertirlos
            # Twilio envía application/x-www-form-urlencoded
            body = getattr(request.state, "_twilio_body", {})
            params = {k: v for k, v in body.items()}

        is_valid = validator.validate(url, params, sig)
        if not is_valid:
            log.warning(f"Firma Twilio inválida para URL: {url}")

        return is_valid
    except Exception as e:
        log.error(f"Error validando firma Twilio: {e}")
        return False

async def twilio_send_whatsapp(tenant_slug: str, to_e164: str, text: str) -> dict:
    t = await fetch_tenant(tenant_slug)
    client_t = get_twilio_client_for_tenant(t) or getattr(app.state, "twilio", None)
    if not client_t:
        raise RuntimeError("Twilio no configurado para el tenant")
    _, _, wa_from, _ = twilio_cfg_from_tenant(t)
    msg = await asyncio.to_thread(
        client_t.messages.create,
        from_=wa_from,
        to=f"whatsapp:{to_e164}" if not to_e164.startswith("whatsapp:") else to_e164,
        body=text
    )
    return {"sid": msg.sid}

async def twilio_send_sms(tenant_slug: str, to_e164: str, text: str) -> dict:
    t = await fetch_tenant(tenant_slug)
    client_t = get_twilio_client_for_tenant(t) or getattr(app.state, "twilio", None)
    if not client_t:
        raise RuntimeError("Twilio no configurado para el tenant")
    _, _, _, sms_from = twilio_cfg_from_tenant(t)
    msg = await asyncio.to_thread(
        client_t.messages.create,
        from_=sms_from,
        to=to_e164,
        body=text
    )
    return {"sid": msg.sid}


#helpers for meta tokens
def _graph_params(access_token: str) -> dict:
    """
    Genera parámetros para llamadas a la Graph API de Meta.
    Incluye el access_token y opcionalmente appsecret_proof para mayor seguridad.
    """
    params = {"access_token": access_token}
    app_secret = os.getenv("META_APP_SECRET", "")
    if app_secret:
        proof = hmac.new(
            app_secret.encode("utf-8"),
            msg=access_token.encode("utf-8"),
            digestmod=hashlib.sha256
        ).hexdigest()
        params["appsecret_proof"] = proof
    return params

async def _http_get(url, params):
    async with httpx.AsyncClient(timeout=12) as cx:
        r = await cx.get(url, params=params)
        r.raise_for_status()
        return r.json()

async def refresh_page_token_for_tenant(slug: str) -> dict:
    # Lee tenant
    async with db_engine.connect() as conn:
        row = (await conn.execute(
            text("SELECT settings FROM tenants WHERE slug=:slug"),
            {"slug": slug}
        )).first()
    if not row:
        raise RuntimeError("Tenant no encontrado")

    s = dict(row._mapping)["settings"] or {}
    user_token = (s.get("fb_user_token") or "").strip()
    page_id    = (s.get("fb_page_id") or "").strip()
    if not user_token or not page_id:
        raise RuntimeError("Faltan fb_user_token o fb_page_id en settings")

    # Opción A: volver a pedir /me/accounts (recomendada)
    data = await _http_get(f"{GRAPH}/me/accounts", {"access_token": user_token})
    page_token = None
    for p in data.get("data", []):
        if str(p.get("id")) == page_id:
            page_token = p.get("access_token")
            break
    if not page_token:
        raise RuntimeError("No pude obtener page access token para esa Page")

    patch = {"fb_page_token": page_token, "fb_page_refreshed_at": int(time.time())}
    async with db_engine.begin() as conn:
        await conn.execute(
            text("""
                UPDATE tenants
                SET settings = COALESCE(settings,'{}'::jsonb) || CAST(:p AS JSONB),
                    updated_at = NOW()
                WHERE slug = :slug
            """),
            {"slug": slug, "p": json.dumps(patch)}
        )
    return {"ok": True, "page_id": page_id}

# ── Modelos ────────────────────────────────────────────────────────────
class TenantIn(BaseModel):
    slug: str
    name: str
    whatsapp: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)

class ChatIn(BaseModel):
    message: str
    sessionId: Optional[str] = None

class ChatOut(BaseModel):
    sessionId: str
    answer: str

class EventIn(BaseModel):
    type: str
    sessionId: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)

class MetaTestReplyIn(BaseModel):
    tenant: str
    platform: str  # 'facebook'|'instagram' (alias: 'page'|'fb'|'ig')
    commentId: str
    text: Optional[str] = None
    mode: Optional[str] = "both"  # 'public'|'private'|'both'


#modelos para qr
class CheckoutQrIn(BaseModel):
    price_id: Optional[str] = None
    product_id: Optional[str] = None
    plan: Optional[str] = None
    quantity: int = 1
    mode: Optional[str] = None


class LoginIn(BaseModel):
    email: str
    password: str


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TenantSettingsUpdate(BaseModel):
    whatsapp: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)


class TenantSettingsOut(BaseModel):
    slug: str
    name: str
    whatsapp: Optional[str]
    settings: Dict[str, Any]


class UserCreateIn(BaseModel):
    tenant: str
    email: EmailStr
    password: str


class MessageQuery(BaseModel):
    id: int
    tenant_slug: str
    session_id: Optional[str]
    channel: Optional[str]
    direction: Optional[str]
    author: Optional[str]
    content: Optional[str]
    payload: Dict[str, Any]
    created_at: datetime


def _mask(value: Optional[str], show: int = 4) -> Optional[str]:
    if not value:
        return None
    s = str(value)
    if len(s) <= show:
        return "*" * len(s)
    return "*" * (len(s) - show) + s[-show:]

# ── Sesiones en memoria ────────────────────────────────────────────────
SESSIONS: Dict[str, dict] = {}
MESSAGES: Dict[str, list[dict]] = {}

# Constantes para cleanup de sesiones
SESSION_MAX_AGE_HOURS = 24
SESSION_CLEANUP_INTERVAL_SECONDS = 3600  # 1 hora

now_ms = lambda: int(time.time() * 1000)

async def cleanup_old_sessions():
    """Limpia sesiones antiguas de la memoria para prevenir memory leaks."""
    while True:
        try:
            await asyncio.sleep(SESSION_CLEANUP_INTERVAL_SECONDS)

            cutoff_ms = now_ms() - (SESSION_MAX_AGE_HOURS * 3600 * 1000)
            to_delete = [
                sid for sid, session in SESSIONS.items()
                if session.get("startedAt", 0) < cutoff_ms
            ]

            for sid in to_delete:
                SESSIONS.pop(sid, None)
                MESSAGES.pop(sid, None)

            if to_delete:
                log.info(f"🧹 Limpiadas {len(to_delete)} sesiones antiguas (>{SESSION_MAX_AGE_HOURS}h)")
        except Exception as e:
            log.error(f"Error en cleanup de sesiones: {e}")

def new_session_id() -> str:
    return f"sess_{uuid.uuid4().hex}"

def ensure_session(session_id: Optional[str]) -> str:
    sid = session_id or new_session_id()
    if sid not in SESSIONS:
        SESSIONS[sid] = {"startedAt": now_ms(), "status": "active"}
        MESSAGES[sid] = []
    return sid

def add_message(sid: str, role: str, content: str):
    MESSAGES[sid].append({"role": role, "content": content, "ts": now_ms()})

def get_flow(sid: str) -> dict:
    return SESSIONS.setdefault(sid, {}).setdefault(
        "contact_flow",
        {"stage": None, "name": None, "method": None, "contact": None}
    )

async def save_lead(tenant_slug: str, sid: str, name: str, method: str, contact: str, meta: dict | None = None) -> dict:
    if not db_engine:
        log.warning("DB no configurada: lead no persistido")
        return {"id": None, "tenant_slug": tenant_slug, "session_id": sid, "name": name, "method": method, "contact": contact}
    async with db_engine.begin() as conn:
        row = (await conn.execute(
            text("""INSERT INTO leads (tenant_slug, session_id, name, method, contact, meta)
                    VALUES (:tenant_slug, :sid, :name, :method, :contact, CAST(:meta AS JSONB))
                    RETURNING id, tenant_slug, session_id, name, method, contact, meta, created_at"""),
            {"tenant_slug": tenant_slug, "sid": sid, "name": name, "method": method, "contact": contact, "meta": json.dumps(meta or {})}
        )).first()
    return dict(row._mapping)

# ── Tenant + prompts ───────────────────────────────────────────────────
async def fetch_tenant(slug: str) -> Optional[dict]:
    if not db_engine or not slug:
        return None
    async with db_engine.connect() as conn:
        row = (await conn.execute(
            text("SELECT slug, name, whatsapp, settings FROM tenants WHERE slug=:slug"),
            {"slug": slug}
        )).first()
    return dict(row._mapping) if row else None

async def resolve_tenant_by_page_or_ig_id(page_or_ig_id: str) -> str:
    if not db_engine or not page_or_ig_id:
        return ""
    async with db_engine.connect() as conn:
        row = (await conn.execute(
            text("""
              SELECT slug
              FROM tenants
              WHERE settings->>'fb_page_id' = :x
                 OR settings->>'ig_user_id' = :x
                 OR EXISTS (
                      SELECT 1
                      FROM jsonb_array_elements_text(COALESCE(settings->'ig_user_ids', '[]'::jsonb)) AS elem(val)
                      WHERE elem.val = :x
                 )
              LIMIT 1
            """),
            {"x": str(page_or_ig_id)}
        )).first()
    return row[0] if row else ""


async def fetch_user_by_email(email: str) -> Optional[dict]:
    if not db_engine or not email:
        return None
    async with db_engine.connect() as conn:
        row = (await conn.execute(
            text("SELECT id, tenant_slug, email, password_hash, role FROM users WHERE email = :email"),
            {"email": email.strip().lower()}
        )).first()
    return dict(row._mapping) if row else None


async def fetch_user_by_id(user_id: int) -> Optional[dict]:
    if not db_engine or not user_id:
        return None
    async with db_engine.connect() as conn:
        row = (await conn.execute(
            text("SELECT id, tenant_slug, email, password_hash, role FROM users WHERE id = :id"),
            {"id": int(user_id)}
        )).first()
    return dict(row._mapping) if row else None


def tenant_bot_enabled(tenant: Optional[dict]) -> bool:
    settings = (tenant or {}).get("settings", {}) or {}
    return bool(settings.get("bot_enabled", True))


def fb_tokens_from_tenant(t: dict | None) -> tuple[str, str, str]:
    """Obtiene credenciales de Meta para el tenant exclusivamente desde DB.

    Producción: ya no se usa fallback por variables de entorno para tokens/IDs.
    """
    s = (t or {}).get("settings", {}) or {}

    def _clean(val: Any) -> str:
        """Normalize token/id values coming from the DB."""
        raw = str(val or "").strip()
        if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
            raw = raw[1:-1].strip()
        return raw

    page_id = _clean(s.get("fb_page_id"))
    page_token = _clean(s.get("fb_page_token"))
    ig_user_id = _clean(s.get("ig_user_id"))
    ig_user_ids = []
    raw_list = s.get("ig_user_ids")
    if isinstance(raw_list, (list, tuple)):
        ig_user_ids = [_clean(v) for v in raw_list if _clean(v)]
    if not ig_user_id and ig_user_ids:
        ig_user_id = ig_user_ids[0]
    return page_id, page_token, ig_user_id

async def meta_send_text(page_token: str, recipient_id: str, text: str, platform: str = "facebook") -> dict:
    if not page_token:
        raise RuntimeError("Falta fb_page_token")
    safe_text = (text or "").strip()
    if not safe_text:
        raise RuntimeError("Falta texto para enviar a Meta")
    if len(safe_text) > 2000:
        safe_text = safe_text[:1997].rstrip() + "..."
    url = "https://graph.facebook.com/v20.0/me/messages"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": safe_text}
    }
    payload["messaging_type"] = "RESPONSE"
    async with httpx.AsyncClient(timeout=10.0) as cx:
        r = await cx.post(url, params=_graph_params(page_token), json=payload)
        if r.status_code >= 400:
            log.error(
                "[META][SEND][%s] response=%s payload=%s",
                r.status_code,
                (r.text or "").strip(),
                json.dumps(payload, ensure_ascii=False)
            )
        r.raise_for_status()
        return r.json()


SEEN_META_EVENTS: "OrderedDict[str, dict]" = OrderedDict()
SEEN_META_MSGS: "OrderedDict[str, dict]" = OrderedDict()


def _seen_key(obj: str, owner: str, field: str, verb: str, cid: str) -> str:
    return "|".join([obj or "", owner or "", field or "", verb or "", cid or ""])


def meta_event_seen(key: str) -> bool:
    now = time.time()
    # Purga eventos caducos
    drop: list[str] = []
    for k, v in SEEN_META_EVENTS.items():
        if now - v["at"] > META_SEEN_TTL:
            drop.append(k)
    for k in drop:
        SEEN_META_EVENTS.pop(k, None)

    if key in SEEN_META_EVENTS:
        return True

    while len(SEEN_META_EVENTS) >= META_SEEN_MAX > 0:
        SEEN_META_EVENTS.popitem(last=False)

    SEEN_META_EVENTS[key] = {"at": now}
    return False


def meta_message_seen(mid: str) -> bool:
    if not mid:
        return False
    now = time.time()
    drop: list[str] = []
    for k, v in SEEN_META_MSGS.items():
        if now - v["at"] > META_SEEN_TTL:
            drop.append(k)
    for k in drop:
        SEEN_META_MSGS.pop(k, None)
    if mid in SEEN_META_MSGS:
        return True
    while len(SEEN_META_MSGS) >= META_SEEN_MAX > 0:
        SEEN_META_MSGS.popitem(last=False)
    SEEN_META_MSGS[mid] = {"at": now}
    return False


async def fb_reply_comment(page_token: str, comment_id: str, message: str) -> dict:
    if not (page_token and comment_id and message):
        raise RuntimeError("Faltan datos para reply FB")
    url = f"https://graph.facebook.com/v20.0/{comment_id}/comments"
    async with httpx.AsyncClient(timeout=10.0) as cx:
        r = await cx.post(url, params=_graph_params(page_token), data={"message": message})
        if r.status_code >= 400:
            log.error(f"[META][FEED] fb_reply_comment body: {r.text}")
            r.raise_for_status()
        return r.json()

async def ig_reply_comment(page_token: str, ig_comment_id: str, message: str) -> dict:
    if not (page_token and ig_comment_id and message):
        raise RuntimeError("Faltan datos para reply IG")
    url = f"https://graph.facebook.com/v20.0/{ig_comment_id}/replies"
    async with httpx.AsyncClient(timeout=10.0) as cx:
        r = await cx.post(url, params=_graph_params(page_token), data={"message": message})
        if r.status_code >= 400:
            log.error(f"[META][IG] ig_reply_comment body: {r.text}")
            r.raise_for_status()
        return r.json()

async def meta_private_reply_to_comment(page_id: str, page_token: str, comment_id: str, text: str) -> dict:
    if not (page_id and page_token and comment_id and text):
        raise RuntimeError("Faltan datos para private reply")
    url = f"https://graph.facebook.com/v20.0/{page_id}/messages"
    payload = {"recipient": {"comment_id": comment_id}, "message": {"text": text}}
    async with httpx.AsyncClient(timeout=10.0) as cx:
        r = await cx.post(url, params=_graph_params(page_token), json=payload)
        r.raise_for_status()
        return r.json()

def twilio_cfg_from_tenant(t: dict | None):
    s = (t or {}).get("settings", {}) or {}
    sid = s.get("twilio_account_sid") or TWILIO_ACCOUNT_SID
    tok = s.get("twilio_auth_token") or TWILIO_AUTH_TOKEN
    wa_from = s.get("twilio_whatsapp_from") or TWILIO_WHATSAPP_FROM
    sms_from = s.get("twilio_sms_from") or TWILIO_SMS_FROM
    return sid, tok, wa_from, sms_from

def get_twilio_client_for_tenant(t: dict | None):
    sid, tok, _, _ = twilio_cfg_from_tenant(t)
    if not sid or not tok:
        return None
    return TwilioClient(sid, tok)

def build_system_for_tenant(tenant: Optional[dict]) -> str:
    """Construye el prompt del sistema personalizado para un tenant."""
    s = (tenant or {}).get("settings", {}) or {}
    brand = s.get("brand_name") or (tenant or {}).get("name") or "esta marca"
    tone = s.get("tone", "cálido y directo")

    # Extraer configuraciones del tenant
    policies = s.get("policies", "")
    hours = s.get("business_hours", "")
    products = s.get("products_description", "")
    prices = s.get("prices", {})
    faq = s.get("faq", [])

    # Construir prompt base
    base = ZIA_SYSTEM_PROMPT.format(brand=brand)
    extras = [f"Contexto de negocio: {brand}. Tono: {tone}."]

    # Agregar información adicional si está disponible
    if policies:
        extras.append(f"Políticas: {policies}.")
    if hours:
        extras.append(f"Horarios: {hours}.")
    if products:
        extras.append(f"Oferta/servicios: {products}.")
    if prices and isinstance(prices, dict):
        price_txt = "; ".join(f"{k}: {v}" for k, v in prices.items())
        extras.append(f"Precios conocidos (orientativos): {price_txt}.")
    if faq:
        def fmt(item):
            if isinstance(item, dict):
                q = item.get("q", "")
                a = item.get("a", "")
                return f"Q: {q} | A: {a}"
            return str(item)
        faq_txt = " | ".join(fmt(x) for x in faq[:8])
        extras.append(f"FAQ internas (usa si aplica, concisas): {faq_txt}.")

    return (base + "\n" + " ".join(extras)).strip()

# ── Catálogo externo (por tenant) ─────────────────────────────────────
CATALOG_CACHE: Dict[str, dict] = {}
CATALOG_TTL_SECONDS = 300  # 5 minutos

async def fetch_catalog_for_tenant(t: dict | None) -> list[dict]:
    s = (t or {}).get("settings", {}) or {}
    url = s.get("catalog_url")
    slug = (t or {}).get("slug", "")
    if not url or not slug:
        return []
    now = time.time()
    cached = CATALOG_CACHE.get(slug)
    if cached and (now - cached.get("at", 0)) < CATALOG_TTL_SECONDS:
        return cached.get("items", []) or []
    try:
        async with httpx.AsyncClient(timeout=6.0) as cx:
            r = await cx.get(str(url))
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        log.warning(f"catalog fetch failed for {slug}: {e}")
        return cached.get("items", []) if cached else []

    items: list[dict] = []
    if isinstance(data, list):
        items = [x for x in data if isinstance(x, dict)]
    elif isinstance(data, dict):
        for key in ("items", "products", "catalog", "data", "plans"):
            v = data.get(key)
            if isinstance(v, list):
                items = [x for x in v if isinstance(x, dict)]
                break

    # normalizar campos más comunes
    normd: list[dict] = []
    for it in items[:200]:
        # Nombre: acepta title, name, Nombre
        name = str(it.get("title") or it.get("name") or it.get("Nombre") or "").strip()

        # Descripción: primero intenta description, luego construye desde features o price
        desc = str(it.get("description") or it.get("Descripcion") or it.get("Descripción") or "").strip()
        if not desc:
            # Construir descripción desde features (primeras 3)
            if "features" in it and isinstance(it.get("features"), list):
                features_list = [str(f).strip() for f in it["features"][:3] if f]
                desc = " • ".join(features_list)
            # Si tampoco hay features, usar el campo price si existe
            elif "price" in it:
                desc = str(it.get("price", "")).strip()

        # ID del producto: key, product_id, stripe_product_id, stripe_id, id
        pid = str(it.get("key") or it.get("product_id") or it.get("stripe_product_id") or it.get("stripe_id") or it.get("id") or "").strip()

        # ID del precio: priceId (camelCase), price_id (snake_case), stripe_price_id, default_price
        prc = str(it.get("priceId") or it.get("price_id") or it.get("stripe_price_id") or it.get("default_price") or "").strip()

        # Metadata
        meta = it.get("metadata") if isinstance(it.get("metadata"), dict) else {}

        # Preservar campos adicionales útiles del JSON original
        extra_fields = {}
        if "image" in it:
            extra_fields["image"] = it["image"]
        if "price" in it:
            extra_fields["price_display"] = it["price"]
        if "sections" in it:
            extra_fields["sections"] = it["sections"]

        normd.append({
            "name": name,
            "description": desc,
            "product_id": pid,
            "price_id": prc,
            "metadata": meta,
            **extra_fields,  # Agregar campos extra
            "raw": it
        })

    CATALOG_CACHE[slug] = {"at": now, "items": normd}
    return normd

def summarize_catalog_for_prompt(items: list[dict], max_items: int = 14, max_desc: int = 120) -> str:
    if not items:
        return ""
    parts: list[str] = []
    for it in items[:max_items]:
        name = (it.get("name") or "").strip()
        pid  = (it.get("product_id") or "").strip()
        desc = (it.get("description") or "").strip()
        if len(desc) > max_desc:
            desc = desc[:max_desc - 1].rstrip() + "…"
        label = f"• {name} — {desc} ({pid})" if pid else f"• {name} — {desc}"
        parts.append(label)
    return ("Catálogo del cliente (resumen, usa como base para respuestas y links):\n" + "\n".join(parts)).strip()

def _match_catalog_item(user_text: str, items: list[dict]) -> dict | None:
    t = (user_text or "").lower()
    best = None
    best_score = 0.0
    for it in items or []:
        name = (it.get("name") or "").lower()
        desc = (it.get("description") or "").lower()
        pid  = (it.get("product_id") or "").lower()
        score = 0.0
        # coincidencias fuertes en nombre / id
        if name and name in t: score += 3.0
        if pid and pid in t: score += 2.5
        # coincidencias sueltas por palabras
        for w in filter(None, re.split(r"[^a-z0-9ñáéíóúü]+", name)[:6]):
            if len(w) >= 4 and w in t:
                score += 0.8
        if desc:
            for w in filter(None, re.split(r"[^a-z0-9ñáéíóúü]+", desc)[:6]):
                if len(w) >= 5 and w in t:
                    score += 0.4
        if score > best_score:
            best_score = score
            best = it
    return best if best_score >= 1.2 else None

async def _create_checkout_for_item(t: dict | None, item: dict, qty: int = 1, mode: str = "payment") -> dict:
    acct = _tenant_stripe_acct(t)
    if not acct:
        raise HTTPException(400, "Tenant no tiene Stripe conectado (stripe_acct)")
    price_id = (item.get("price_id") or "").strip()
    product_id = (item.get("product_id") or "").strip()
    if not price_id and product_id:
        try:
            prod = stripe.Product.retrieve(product_id, expand=["default_price"], stripe_account=acct)
            dp = getattr(prod, "default_price", None)
            price_id = getattr(dp, "id", "") if dp else ""
        except Exception as e:
            log.error(f"Stripe Product.retrieve error: {e}")
            raise HTTPException(400, "Producto sin price válido")
    if not price_id:
        raise HTTPException(400, "No hay price_id para el producto")
    try:
        kwargs = dict(
            mode=mode,
            line_items=[{"price": price_id, "quantity": max(1, int(qty))}],
            success_url=f"{SITE_URL}/pago-exitoso?sid={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{SITE_URL}/pago-cancelado",
            metadata={"tenant": (t or {}).get("slug", "public"), "product_id": product_id or None},
            stripe_account=acct,
        )
        if mode == "payment":
            kwargs["customer_creation"] = "always"

        session = stripe.checkout.Session.create(**kwargs)


    except Exception as e:
        log.error(f"Stripe checkout.Session.create error: {e}")
        raise HTTPException(502, "No se pudo crear la sesión de pago")
    return {"id": session.id, "url": session.url}

def build_messages_with_history(sid: str, system_prompt: str, max_pairs: int = CHAT_MAX_HISTORY_PAIRS) -> list[dict]:
    convo = MESSAGES.get(sid, [])
    recent = convo[-2*max_pairs:]
    history = [{"role": m["role"], "content": m["content"]} for m in recent]
    return [{"role": "system", "content": system_prompt}] + history

def suggest_ui_for_text(user_text: str, tenant: Optional[dict]) -> dict:
    text_ = (user_text or "").lower()
    chips = []
    if any(w in text_ for w in ["reserva", "reservar", "booking"]):
        chips += ["Hacer reserva"]
    if any(w in text_ for w in ["precio", "tarifa", "cotiza", "costo"]):
        chips += ["Ver tarifas", "Solicitar cotización"]
    if not chips:
        chips = ["Solicitar cotización", "Ver tarifas", "Contactar por WhatsApp"]
    wa_num = clean_phone_for_wa((tenant or {}).get("whatsapp"))
    wa_link = f"https://wa.me/{wa_num}" if wa_num else None
    show_bubble = any(w in text_ for w in ["whatsapp", "wasap", "contacto", "contact"])
    if show_bubble:
        chips = [c for c in chips if "whats" not in c.lower()]
    return {
        "chips": chips,
        "whatsapp": wa_link if show_bubble and wa_link else None,
        "showWhatsAppBubble": bool(show_bubble and wa_link),
    }

# ── Endpoints utilitarios ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"ok": True, "mode": "mock" if USE_MOCK else "real"}

# DB healthcheck (admin-only)
@app.get("/db/health", dependencies=[Depends(require_admin)])
async def db_health():
    if not db_engine:
        return {"ok": False, "configured": False, "message": "DATABASE_URL no configurado o DB no inicializada"}
    try:
        async with db_engine.connect() as conn:
            # ping
            pong = (await conn.execute(text("SELECT 1"))).scalar_one()
            # check tables existence
            row = (await conn.execute(text(
                "SELECT "
                "  to_regclass('public.tenants') IS NOT NULL AS tenants, "
                "  to_regclass('public.leads')   IS NOT NULL AS leads, "
                "  to_regclass('public.events')  IS NOT NULL AS events"
            ))).first()
        return {
            "ok": True,
            "configured": True,
            "ping": (pong == 1),
            "tables": {"tenants": bool(row.tenants), "leads": bool(row.leads), "events": bool(row.events)}
        }
    except Exception as e:
        log.error(f"DB healthcheck failed: {e}")
        return {"ok": False, "configured": True, "error": str(e)}

@app.post("/v1/tenants", dependencies=[Depends(require_admin)])
async def upsert_tenant(body: TenantIn):
    if not db_engine:
        raise HTTPException(503, "Database not configured")
    async with db_engine.begin() as conn:
        row = (await conn.execute(
            text("""
                INSERT INTO tenants (slug, name, whatsapp, settings)
                VALUES (:slug, :name, :whatsapp, CAST(:settings AS JSONB))
                ON CONFLICT (slug) DO UPDATE
                  SET name = EXCLUDED.name,
                      whatsapp = EXCLUDED.whatsapp,
                      settings = EXCLUDED.settings,
                      updated_at = NOW()
                RETURNING id, slug, name, whatsapp, settings
            """),
            {"slug": body.slug, "name": body.name, "whatsapp": body.whatsapp, "settings": json.dumps(body.settings)}
        )).first()
    return dict(row._mapping)

@app.get("/v1/widget/bootstrap")
async def widget_bootstrap(tenant: str):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    if not db_engine:
        # Modo sin DB: entregar algo básico
        return {
            "tenant": {"slug": tenant, "name": tenant or "zIA", "whatsapp": None, "settings": {}},
            "ui": {"suggestions": ["Solicitar cotización","Ver tarifas","Contactar por WhatsApp"]}
        }
    async with db_engine.connect() as conn:
        t = (await conn.execute(
            text("SELECT id, slug, name, whatsapp, settings FROM tenants WHERE slug=:slug"),
            {"slug": tenant}
        )).first()
    if not t:
        raise HTTPException(404, f"Tenant '{tenant}' no encontrado")
    tenant_obj = dict(t._mapping)
    # Pre-carga de catálogo para que el frontend pueda mostrar chips/estado si quiere
    try:
        items = await fetch_catalog_for_tenant(tenant_obj)
        has_catalog = bool(items)
    except Exception:
        has_catalog = False
    return {
        "tenant": tenant_obj,
        "ui": {
            "suggestions": ["Solicitar cotización","Ver tarifas","Contactar por WhatsApp"]
        },
        "catalog": {"present": has_catalog}
    }

@app.options("/v1/chat/stream")
async def options_stream():
    return Response(status_code=204)

@app.options("/v1/widget/bootstrap")
async def options_bootstrap():
    return Response(status_code=204)

@app.options("/v1/events")
async def options_events():
    return Response(status_code=204)

# ── Chat sin streaming ─────────────────────────────────────────────────
def generate_answer(messages: list[dict]) -> str:
    if USE_MOCK:
        last = next((m for m in reversed(messages) if m["role"] == "user"), {"content": ""})
        return f"(mock) Recibí: {last['content']}"
    try:
        resp = client.chat.completions.create(model=OPENAI_MODEL, messages=messages)
        return resp.choices[0].message.content
    except OpenAIError as e:
        log.error(f"OpenAI error: {e}")
        raise HTTPException(status_code=502, detail="AI service error")

@app.post("/v1/chat", response_model=ChatOut)
async def chat(input: ChatIn, request: Request, tenant: str = Query(default="")):
    key = input.sessionId or get_client_ip(request)
    if is_rate_limited(key):
        raise HTTPException(status_code=429, detail="Too many requests")
    sid = ensure_session(input.sessionId)
    add_message(sid, "user", input.message)
    t = await fetch_tenant(tenant)
    asyncio.create_task(store_event(tenant or "public", sid, "msg_in", {"text": (input.message or "")[:MAX_TEXT_LENGTH]}))
    asyncio.create_task(log_message(tenant or "public", sid, "web", "in", input.message or "", author="user"))
    if t and not tenant_bot_enabled(t):
        off_msg = ((t.get("settings") or {}).get("bot_off_message") or "El asistente está en pausa. Escríbenos por WhatsApp o email y te respondemos.")
        add_message(sid, "assistant", off_msg)
        asyncio.create_task(log_message(tenant or "public", sid, "web", "out", off_msg, author="assistant"))
        return ChatOut(sessionId=sid, answer=off_msg)
    catalog_items = await fetch_catalog_for_tenant(t)
    catalog_summary = summarize_catalog_for_prompt(catalog_items)
    system_prompt = build_system_for_tenant(t)
    if catalog_summary:
        system_prompt = f"{system_prompt}\n\n{catalog_summary}"
    messages = build_messages_with_history(sid, system_prompt)
    answer = generate_answer(messages)
    add_message(sid, "assistant", answer)
    asyncio.create_task(store_event(tenant or "public", sid, "msg_out", {"text": answer[:MAX_TEXT_LENGTH]}))
    asyncio.create_task(log_message(tenant or "public", sid, "web", "out", answer, author="assistant"))
    return ChatOut(sessionId=sid, answer=answer)

# ── Eventos (analytics) ────────────────────────────────────────────────
@app.post("/v1/events")
async def track_event(body: EventIn, request: Request, tenant: str = Query(default="")):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    etype = (body.type or "").strip().lower()
    if not etype:
        raise HTTPException(400, "Missing event type")
    sid = ensure_session(body.sessionId)
    if not db_engine:
        log.info(f"[event][no-db] tenant={tenant} sid={sid} type={etype} payload={body.payload}")
        return {"ok": True, "stored": False}
    async with db_engine.begin() as conn:
        await conn.execute(
            text("""INSERT INTO events (tenant_slug, session_id, type, payload)
                    VALUES (:tenant, :sid, :type, CAST(:payload AS JSONB))"""),
            {"tenant": tenant or "public", "sid": sid, "type": etype, "payload": json.dumps(body.payload or {})}
        )
    return {"ok": True, "stored": True}

# ── Meta Webhooks: GET verify + POST events ────────────────────────────

@app.get("/v1/meta/webhook")
async def meta_webhook_verify(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default="")
):
    """Verifica el webhook de Meta durante la configuración."""
    token = os.getenv("META_VERIFY_TOKEN", "")

    if not token:
        log.error("META_VERIFY_TOKEN no configurado")
        raise HTTPException(status_code=500, detail="Server misconfiguration")

    if hub_mode == "subscribe" and hub_verify_token and hub_verify_token == token:
        log.info("✅ Meta webhook verificado exitosamente")
        return Response(hub_challenge, media_type="text/plain")

    log.warning(f"❌ Verificación de Meta fallida: mode={hub_mode}, token_match={hub_verify_token == token}")
    raise HTTPException(status_code=403, detail="Verification failed")

def _validate_meta_signature(request: Request, body: bytes) -> bool:
    """Valida la firma X-Hub-Signature-256 de Meta para webhooks."""
    app_secret = os.getenv("META_APP_SECRET", "").strip()
    if not app_secret:
        log.warning("META_APP_SECRET no configurado, saltando validación de firma")
        return True  # En desarrollo puede no estar configurado

    signature = request.headers.get("X-Hub-Signature-256", "")
    if not signature:
        log.warning("Webhook de Meta sin X-Hub-Signature-256")
        return False

    try:
        # La firma viene como "sha256=<hash>"
        if not signature.startswith("sha256="):
            return False

        expected_hash = signature[7:]  # Remueve "sha256="
        computed_hash = hmac.new(
            app_secret.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()

        is_valid = hmac.compare_digest(expected_hash, computed_hash)
        if not is_valid:
            log.warning("❌ Firma de Meta inválida")
        return is_valid
    except Exception as e:
        log.error(f"Error validando firma de Meta: {e}")
        return False

@app.post("/v1/meta/webhook")
async def meta_webhook_events(request: Request, payload: Dict[str, Any] = Body(...)):
    rid = f"meta-{uuid.uuid4().hex[:8]}"

    # Validar firma de Meta
    body = await request.body()
    if not _validate_meta_signature(request, body):
        raise HTTPException(403, "Invalid signature")

    try:
        obj = payload.get("object")
        if obj not in {"page", "instagram"}:
            log.debug(f"[{rid}] object no soportado: {obj}")
            return {"ok": True}

        for entry in payload.get("entry", []):
            owner_id = str(entry.get("id", ""))  # page_id o ig_user_id
            log.info(
                f"[{rid}] obj={obj} owner={owner_id} changes={len(entry.get('changes', []) or [])} "
                f"msgs={len(entry.get('messaging', []) or [])}"
            )

            candidate_ids: list[str] = [owner_id]
            # Para DMs, intentar también con el ID del destinatario/remitente (IG usa recipient como business ID)
            for msg in entry.get("messaging", []) or []:
                for key in ("recipient", "sender"):
                    cid = str((msg.get(key) or {}).get("id", ""))
                    if cid:
                        candidate_ids.append(cid)

            # Para cambios (comentarios), revisar page_id e instagram_business_account.id
            for ch in entry.get("changes", []) or []:
                value = (ch.get("value") or {}) if isinstance(ch.get("value"), dict) else {}
                page_id_from_value = str(value.get("page_id", ""))
                if page_id_from_value:
                    candidate_ids.append(page_id_from_value)
                ig_biz = value.get("instagram_business_account")
                if isinstance(ig_biz, dict):
                    ig_id = str(ig_biz.get("id", ""))
                    if ig_id:
                        candidate_ids.append(ig_id)
                author = value.get("from")
                if isinstance(author, dict):
                    author_id = str(author.get("id", ""))
                    if author_id:
                        candidate_ids.append(author_id)

            tenant_slug = ""
            for cid in dict.fromkeys(filter(None, candidate_ids)):
                tenant_slug = await resolve_tenant_by_page_or_ig_id(cid)
                if tenant_slug:
                    break

            if not tenant_slug:
                fallback_slug = META_DEFAULT_TENANT
                tenant_slug = fallback_slug or "public"
                log.warning(
                    f"[{rid}] owner_id {owner_id} no mapea a tenant; fallback={tenant_slug}; "
                    f"candidates={','.join(dict.fromkeys(filter(None, candidate_ids))).strip() or '-'}"
                )

            t = await fetch_tenant(tenant_slug)
            page_id, page_token, ig_user_id = fb_tokens_from_tenant(t)
            # Fallback: si no hay page_id en settings/env, usar owner_id
            if not page_id and owner_id:
                page_id = owner_id
            bot_active = tenant_bot_enabled(t)

            # Messenger / IG DMs (igual a como lo tenías)
            for m in entry.get("messaging", []):
                sender_id = str(m.get("sender", {}).get("id", ""))
                recipient_id_event = str(m.get("recipient", {}).get("id", ""))
                msg = m.get("message", {})
                business_ids = {x for x in (page_id, ig_user_id) if x}
                mid = str(msg.get("mid", ""))
                if meta_message_seen(mid):
                    log.debug(f"[{rid}] DM dedupe mid={mid}")
                    continue
                if msg.get("is_echo"):
                    continue
                if sender_id and sender_id in business_ids:
                    log.debug(
                        f"[{rid}] DM skip: mensaje propio sender={sender_id} recipient={recipient_id_event}"
                    )
                    continue
                text_in = (msg.get("text") or "").strip()
                if not text_in:
                    continue
                participant_id = sender_id or recipient_id_event
                if participant_id in business_ids and recipient_id_event and recipient_id_event not in business_ids:
                    participant_id = recipient_id_event
                if participant_id in business_ids and sender_id and sender_id not in business_ids:
                    participant_id = sender_id
                if not participant_id or participant_id in business_ids:
                    log.warning(
                        f"[{rid}] DM skip: sin recipient id slug={tenant_slug} owner={owner_id} "
                        f"obj={obj} sender={sender_id} recipient={recipient_id_event}"
                    )
                    continue
                sid = ensure_session(f"fb:{tenant_slug}:{participant_id}")
                add_message(sid, "user", text_in)
                asyncio.create_task(store_event(tenant_slug, sid, f"{obj}_in", {"from": sender_id, "text": text_in}))
                channel_label = "instagram_dm" if obj == "instagram" else "facebook_dm"
                asyncio.create_task(log_message(tenant_slug, sid, channel_label, "in", text_in, author=sender_id))

                if not bot_active:
                    log.debug(f"[{rid}] bot off, no auto-reply slug={tenant_slug}")
                    continue

                system_prompt = build_system_for_tenant(t)
                messages = build_messages_with_history(sid, system_prompt)
                answer = "Gracias por escribir. Te atiendo enseguida."
                wa_url = tenant_whatsapp_url(t)
                text_dm = text_in.lower()
                phone_in_msg = None
                digits_in = norm_phone(text_in)
                if digits_in and 8 <= len(digits_in) <= 15:
                    phone_in_msg = digits_in
                want_wa = any(k in text_dm for k in ["whats", "whatsapp", "contact", "hablar", "vende", "comunicar", "cotiza"])
                if phone_in_msg:
                    want_wa = True
                try:
                    if want_wa and wa_url:
                        if phone_in_msg:
                            answer = (
                                "Gracias por compartir tus datos. Para resguardar tu privacidad, "
                                f"tú inicias la conversación desde aquí 👉 {wa_url} y seguimos por WhatsApp cuando nos escribas."
                            )
                        else:
                            answer = (
                                "Claro. Aquí tienes el enlace directo para hablar con nosotros por WhatsApp: "
                                f"{wa_url}. Escríbenos ahí y seguimos la conversación."
                            )
                    else:
                        client_rt = client.with_options(timeout=12.0)
                        resp = client_rt.chat.completions.create(model=OPENAI_MODEL, messages=messages)
                        answer = resp.choices[0].message.content or answer
                        if want_wa and wa_url and "whats" in text_dm:
                            answer += (
                                " Recuerda que para avanzar debes iniciar tú la conversación en "
                                f"WhatsApp desde este enlace 👉 {wa_url}."
                            )
                except Exception as e:
                    log.warning(f"[{rid}] meta fallback LLM: {e}")
                    if want_wa and wa_url:
                        if phone_in_msg:
                            answer = (
                                "Para continuar, inicia tú la conversación por WhatsApp en este enlace: "
                                f"{wa_url}. Cuando nos escribas podremos darte seguimiento al instante."
                            )
                        else:
                            answer = (
                                "Aquí tienes el enlace directo a nuestro WhatsApp: "
                                f"{wa_url}. Escríbenos y seguimos por ahí."
                            )

                add_message(sid, "assistant", answer)
                asyncio.create_task(store_event(tenant_slug, sid, f"{obj}_out", {"to": sender_id, "text": answer[:MAX_TEXT_LENGTH]}))
                asyncio.create_task(log_message(tenant_slug, sid, channel_label, "out", answer, author="bot"))
                # Enviar respuesta solo si tenemos token (desde DB)
                if not page_token:
                    log.warning(
                        f"[{rid}] DM skip: falta page_token slug={tenant_slug} owner={owner_id} obj={obj}"
                    )
                else:
                    try:
                        platform = "instagram" if obj == "instagram" else "facebook"
                        await meta_send_text(page_token, participant_id, answer, platform=platform)
                    except Exception as e:
                        log.error(f"[{rid}] meta send error: {e}")

            # Feed / Comments
            for ch in entry.get("changes", []):
                field = ch.get("field")
                value = ch.get("value", {}) or {}

                dedupe_key = _seen_key(
                    obj,
                    owner_id,
                    str(field or ""),
                    str(value.get("verb", "")),
                    str(value.get("comment_id") or value.get("id") or "")
                )
                if meta_event_seen(dedupe_key):
                    log.debug(f"[{rid}] dedupe skip {dedupe_key}")
                    continue

                log.debug(
                    f"[{rid}] change field={field} obj={obj} owner={owner_id} value={json.dumps(value)[:400]}"
                )
                # Facebook Page comments (feed)
                if obj == "page" and field == "feed" and value.get("item") == "comment" and value.get("verb") == "add":
                    comment_id = str(value.get("comment_id", ""))
                    author_id = str(value.get("from", {}).get("id", ""))
                    text_in = (value.get("message") or "").strip()
                    log.debug(f"[{rid}] feed comment={comment_id} author={author_id} text={text_in!r}")

                    if not comment_id:
                        log.warning(f"[{rid}] feed skip: falta comment_id")
                        continue
                    if not page_token:
                        log.warning(f"[{rid}] feed skip: falta page_token en DB")
                        continue
                    if author_id and page_id and author_id == page_id:
                        log.info(f"[{rid}] feed skip: comentario propio (loop guard)")
                        continue

                    if not bot_active:
                        log.debug(f"[{rid}] bot off, comentario sin respuesta slug={tenant_slug}")
                        continue

                    public_reply = "Gracias por tu comentario. Te escribo por DM para más detalles."
                    if text_in:
                        brand_prompt = build_system_for_tenant(t)
                        reply_messages = [
                            {"role": "system", "content": brand_prompt},
                            {
                                "role": "user",
                                "content": (
                                    "Comentario público: "
                                    + text_in
                                    + "\n\nResponde en 1–2 oraciones, útil y concreta. "
                                      "Evita pedir datos sensibles. Cierra con: 'Te escribo por DM para más detalles.'"
                                ),
                            },
                        ]
                        try:
                            client_reply = client.with_options(timeout=10.0)
                            resp = client_reply.chat.completions.create(
                                model=OPENAI_MODEL,
                                messages=reply_messages,
                            )
                            candidate = (resp.choices[0].message.content or "").strip()
                            if candidate:
                                public_reply = candidate
                        except Exception as e:
                            log.warning(f"[{rid}] feed reply LLM fallback: {e}")
                    if "Te escribo por DM para más detalles." not in public_reply:
                        public_reply = public_reply.rstrip() + " Te escribo por DM para más detalles."

                    sid = ensure_session(f"fb:{tenant_slug}:comment:{comment_id}")

                    if META_DRY_RUN:
                        log.debug(f"[{rid}] feed DRY_RUN omitido comment={comment_id}")
                    else:
                        try:
                            await fb_reply_comment(page_token, comment_id, public_reply)
                            asyncio.create_task(log_message(tenant_slug, sid, "facebook_comment", "out", public_reply, author="bot"))
                        except Exception as e:
                            log.error(f"[{rid}] fb_reply_comment error: {e}")

                        try:
                            await meta_private_reply_to_comment(page_id, page_token, comment_id,
                                "Hola, seguimos por mensaje para darte soporte rápido. ¿Qué necesitas lograr?")
                        except Exception as e:
                            log.error(f"[{rid}] private reply error: {e}")

                    asyncio.create_task(store_event(
                        tenant_slug, sid, "page_comment_in",
                        {"comment_id": comment_id, "author_id": author_id, "text": text_in}
                    ))
                    asyncio.create_task(log_message(tenant_slug, sid, "facebook_comment", "in", text_in, author=author_id))

                # Instagram comments
                if obj == "instagram" and field == "comments":
                    ig_comment_id = str(value.get("id", "")) or str(value.get("comment_id", ""))
                    author_id = str(value.get("from", {}).get("id", ""))
                    text_in = (value.get("text") or "").strip()
                    log.debug(f"[{rid}] IG comment={ig_comment_id} author={author_id} text={text_in!r}")

                    if not ig_comment_id:
                        log.warning(f"[{rid}] IG skip: falta ig_comment_id")
                        continue
                    if not page_token:
                        log.warning(f"[{rid}] IG skip: falta page_token en DB")
                        continue
                    if author_id and ig_user_id and author_id == ig_user_id:
                        log.info(f"[{rid}] IG skip: comentario propio (loop guard)")
                        continue

                    if not bot_active:
                        log.debug(f"[{rid}] bot off IG comment slug={tenant_slug}")
                        continue

                    public_reply = "Gracias por tu comentario. Te escribo por DM para más detalles."
                    if text_in:
                        brand_prompt = build_system_for_tenant(t)
                        reply_messages = [
                            {"role": "system", "content": brand_prompt},
                            {
                                "role": "user",
                                "content": (
                                    "Comentario público: "
                                    + text_in
                                    + "\n\nResponde en 1–2 oraciones, útil y concreta. "
                                      "Evita pedir datos sensibles. Cierra con: 'Te escribo por DM para más detalles.'"
                                ),
                            },
                        ]
                        try:
                            client_reply = client.with_options(timeout=10.0)
                            resp = client_reply.chat.completions.create(
                                model=OPENAI_MODEL,
                                messages=reply_messages,
                            )
                            candidate = (resp.choices[0].message.content or "").strip()
                            if candidate:
                                public_reply = candidate
                        except Exception as e:
                            log.warning(f"[{rid}] IG reply LLM fallback: {e}")
                    if "Te escribo por DM para más detalles." not in public_reply:
                        public_reply = public_reply.rstrip() + " Te escribo por DM para más detalles."

                    sid = ensure_session(f"ig:{tenant_slug}:comment:{ig_comment_id}")

                    if META_DRY_RUN:
                        log.debug(f"[{rid}] IG DRY_RUN omitido comment={ig_comment_id}")
                    else:
                        try:
                            await ig_reply_comment(page_token, ig_comment_id, public_reply)
                            asyncio.create_task(log_message(tenant_slug, sid, "instagram_comment", "out", public_reply, author="bot"))
                        except Exception as e:
                            log.error(f"[{rid}] ig_reply_comment error: {e}")

                        try:
                            await meta_private_reply_to_comment(page_id, page_token, ig_comment_id,
                                "Hola, seguimos por mensaje para resolverlo contigo. ¿Puedes contarme un poco más?")
                        except Exception as e:
                            log.error(f"[{rid}] IG private reply error: {e}")

                    asyncio.create_task(store_event(
                        tenant_slug, sid, "instagram_comment_in",
                        {"comment_id": ig_comment_id, "author_id": author_id, "text": text_in}
                    ))
                    asyncio.create_task(log_message(tenant_slug, sid, "instagram_comment", "in", text_in, author=author_id))

        return {"ok": True}
    except Exception as e:
        log.error(f"[{rid}] webhook error: {e}")
        return {"ok": False}


#rotacion de tokens de meta 
@app.post("/v1/admin/meta/rotate-page-token", dependencies=[Depends(require_admin)])
async def rotate_page_token(tenant: str = Query(...)):
    try:
        res = await refresh_page_token_for_tenant(tenant)
        return {"ok": True, **res}
    except Exception as e:
        raise HTTPException(400, str(e))
    
async def meta_send_text_with_refresh(tenant_slug: str, recipient_id: str, text: str, platform: str):
    t = await fetch_tenant(tenant_slug)
    _, page_token, _ = fb_tokens_from_tenant(t)
    try:
        return await meta_send_text(page_token, recipient_id, text, platform=platform)
    except httpx.HTTPStatusError as e:
        body = e.response.text or ""
        should_refresh = '"code":190' in body and ('"error_subcode":463' in body or "Session has expired" in body)
        if not should_refresh:
            raise
        await refresh_page_token_for_tenant(tenant_slug)
        # reintento
        t2 = await fetch_tenant(tenant_slug)
        _, page_token2, _ = fb_tokens_from_tenant(t2)
        return await meta_send_text(page_token2, recipient_id, text, platform=platform)


# ── Streaming SSE con flujo de contacto ────────────────────────────────
@app.post("/v1/chat/stream")
async def chat_stream(input: ChatIn, request: Request, tenant: str = Query(default="")):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    key = input.sessionId or get_client_ip(request)
    if is_rate_limited(key):
        raise HTTPException(status_code=429, detail="Too many requests")

    sid = ensure_session(input.sessionId)
    add_message(sid, "user", input.message)
    asyncio.create_task(store_event(tenant or "public", sid, "msg_in", {"text": (input.message or "")[:MAX_TEXT_LENGTH]}))
    asyncio.create_task(log_message(tenant or "public", sid, "web", "in", input.message or "", author="user"))

    t = await fetch_tenant(tenant)
    catalog_items = await fetch_catalog_for_tenant(t)
    catalog_summary = summarize_catalog_for_prompt(catalog_items)
    system_prompt = build_system_for_tenant(t)
    if catalog_summary:
        system_prompt = f"{system_prompt}\n\n{catalog_summary}"
    messages = build_messages_with_history(sid, system_prompt)

    async def event_generator():
        try:
            yield sse_event("ok", event="ping")

            text_lc = (input.message or "").lower()
            purchase_intent = any(k in text_lc for k in [
                "compr", "compra", "adquir", "pagar", "pago", "orden", "checkout", "suscrib"
            ])
            flow = get_flow(sid)
            if flow.get("stage"):
                reset_keys = ["precio", "cost", "cotiza", "catalog", "catalogo", "producto", "plan", "gracias", "otra", "cancel"]
                if purchase_intent or any(k in text_lc for k in reset_keys) or text_lc.endswith("?"):
                    log.debug(f"[chat][flow] reset sid={sid}")
                    flow.update({"stage": None, "name": None, "method": None, "contact": None})

            if t and not tenant_bot_enabled(t):
                off_msg = ((t.get("settings") or {}).get("bot_off_message") or "El asistente está en pausa. Escríbenos por WhatsApp o envíanos un correo y te respondemos enseguida.")
                add_message(sid, "assistant", off_msg)
                asyncio.create_task(log_message(tenant or "public", sid, "web", "out", off_msg, author="assistant"))
                yield sse_event(json.dumps({"content": off_msg}), event="delta")
                yield sse_event(json.dumps({"done": True, "sessionId": sid}), event="done")
                return

            # Atajo: checklist explícito
            if "checklist" in text_lc or text_lc.strip() in {"ver checklist"}:
                checklist = (
                    "Checklist para cotización:\n"
                    "• Objetivo del proyecto (qué problema resolvemos)\n"
                    "• Alcance (módulos/funciones, canales: web/WhatsApp/IG)\n"
                    "• Integraciones (Meta/WhatsApp Business, pasarelas, CRM)\n"
                    "• Volumen estimado (mensajes/mes, usuarios, cargas)\n"
                    "• Datos necesarios (catálogos, FAQs, políticas)\n"
                    "• Tiempos deseados (MVP, go-live)\n"
                    "• Presupuesto/techo y prioridad de features"
                )
                yield sse_event(json.dumps({"content": checklist}), event="delta")
                yield sse_event(json.dumps({}), event="done")
                return

            # ——— PRIORIDAD: intención de compra/suscripción ———
            # 1) Disparo directo por plan (starter/meta) → suscripción
            if purchase_intent and ("starter" in text_lc or "meta" in text_lc):
                plan = "starter" if "starter" in text_lc else "meta"
                try:
                    prices = _tenant_stripe_prices(t)
                    if plan not in prices:
                        prices = await ensure_prices_for_tenant(t)
                    price_id = prices[plan]

                    session = await _create_checkout_for_any(
                        t, price_id=price_id, qty=1, mode="subscription"
                    )
                    yield sse_event(json.dumps({
                        "content": f"Perfecto. Te dejo el enlace para suscribirte al plan {plan.title()}."
                    }), event="delta")
                    yield sse_event(json.dumps({
                        "checkout_url": session["url"],
                        "label": "Pagar suscripción"
                    }), event="ui")
                    yield sse_event(json.dumps({}), event="done")
                    asyncio.create_task(store_event(
                        tenant or "public", sid, "checkout_link_out",
                        {"plan": plan, "url": session["url"]}
                    ))
                    return
                except Exception as e:
                    log.warning(f"checkout por plan falló: {e}")
                    # si falla, continuamos al intento por catálogo

            # 2) Compra por catálogo (pago único)
            if purchase_intent and catalog_items:
                item = _match_catalog_item(text_lc, catalog_items)
                if item:
                    try:
                        session = await _create_checkout_for_item(t, item, qty=1, mode="payment")
                        name = (item.get("name") or "este producto")
                        yield sse_event(json.dumps({"content": f"Perfecto. Te dejo el enlace para completar la compra de {name}."}), event="delta")
                        yield sse_event(json.dumps({"checkout_url": session.get("url"), "label": "Comprar ahora"}), event="ui")
                        yield sse_event(json.dumps({}), event="done")
                        asyncio.create_task(store_event(tenant or "public", sid, "checkout_link_out", {"product": item.get("product_id"), "url": session.get("url")}))
                        return
                    except Exception as e:
                        log.warning(f"no se pudo crear checkout por intent: {e}")
                else:
                    # Sin match específico: si solo hay 1, compra directa; si no, ofrecer top 3
                    safe_items = [x for x in catalog_items if (x.get("price_id") or x.get("product_id"))]
                    if len(safe_items) == 1:
                        try:
                            session = await _create_checkout_for_item(t, safe_items[0], qty=1, mode="payment")
                            name = (safe_items[0].get("name") or "este producto")
                            yield sse_event(json.dumps({"content": f"Puedo procesarlo ya. Aquí tienes el enlace para {name}."}), event="delta")
                            yield sse_event(json.dumps({"checkout_url": session.get("url"), "label": "Comprar ahora"}), event="ui")
                            yield sse_event(json.dumps({}), event="done")
                            asyncio.create_task(store_event(tenant or "public", sid, "checkout_link_out", {"product": safe_items[0].get("product_id"), "url": session.get("url")}))
                            return
                        except Exception as e:
                            log.warning(f"checkout directo (1 item) falló: {e}")
                    # Mostrar chips de selección
                    names = [x.get("name") for x in safe_items[:3] if x.get("name")]
                    if names:
                        yield sse_event(json.dumps({"content": "¿Cuál quieres comprar?"}), event="delta")
                        yield sse_event(json.dumps({"chips": names}), event="ui")
                        yield sse_event(json.dumps({}), event="done")
                        return

            # ——— SOLO si no hubo compra, corren los flows de contacto/cotización ———
            if flow["stage"] is None and wants_quote(input.message):
                flow.update({"stage": "ask_name"})
                yield sse_event(json.dumps({"content": "Genial, te ayudo con la cotización. ¿Cuál es tu nombre completo?"}), event="delta")
                yield sse_event(json.dumps({}), event="done")
                return

            if flow["stage"] == "ask_name":
                name = (input.message or "").strip()
                if not name:
                    yield sse_event(json.dumps({"content": "¿Me compartes tu nombre, por favor?"}), event="delta")
                    yield sse_event(json.dumps({}), event="done")
                    return
                flow["name"] = name.title()
                flow["stage"] = "ask_method"
                yield sse_event(json.dumps({"content": f"Gracias, {flow['name']}. ¿Cómo prefieres que te contactemos?"}), event="delta")
                yield sse_event(json.dumps({"chips": ["WhatsApp","Email","Llamada"]}), event="ui")
                yield sse_event(json.dumps({}), event="done")
                return

            if flow["stage"] == "ask_method":
                m = (input.message or "").strip().lower()
                if "whats" in m:
                    m = "whatsapp"
                if m not in {"whatsapp","email","llamada"}:
                    yield sse_event(json.dumps({"content":"Elige una opción: WhatsApp, Email o Llamada."}), event="delta")
                    yield sse_event(json.dumps({"chips": ["WhatsApp","Email","Llamada"]}), event="ui")
                    yield sse_event(json.dumps({}), event="done")
                    return
                flow["method"] = m
                flow["stage"] = "ask_value"
                q = "Perfecto. ¿Cuál es tu número con lada?" if m=="llamada" else \
                    "Perfecto. ¿Cuál es tu WhatsApp (con lada)?" if m=="whatsapp" else \
                    "Perfecto. ¿Cuál es tu correo electrónico?"
                yield sse_event(json.dumps({"content": q}), event="delta")
                yield sse_event(json.dumps({}), event="done")
                return

            if flow["stage"] == "ask_value":
                value = (input.message or "").strip()
                ok = (is_phone(value) if flow["method"] in {"whatsapp","llamada"} else is_email(value))
                if not ok:
                    msg_bad = "Parece que no es un teléfono válido. Intenta con lada." if flow["method"] in {"whatsapp","llamada"} \
                              else "Mmh, ese correo no se ve válido. ¿Lo revisas?"
                    yield sse_event(json.dumps({"content": msg_bad}), event="delta")
                    yield sse_event(json.dumps({}), event="done")
                    return

                contact = norm_phone(value) if flow["method"] in {"whatsapp","llamada"} else value.strip().lower()
                lead = await save_lead(tenant or "public", sid, flow["name"], flow["method"], contact, meta={"source":"widget"})

                try:
                    if db_engine:
                        async with db_engine.begin() as conn:
                            await conn.execute(
                                text("""INSERT INTO events (tenant_slug, session_id, type, payload)
                                        VALUES (:tenant, :sid, 'lead_saved', CAST(:payload AS JSONB))"""),
                                {"tenant": tenant or "public", "sid": sid, "payload": json.dumps({"lead_id": lead.get("id")})}
                            )
                except Exception as e:
                    log.warning(f"event lead_saved not stored: {e}")

                base = f"Listo, registré tus datos: {flow['name']} · {flow['method']}."
                if flow["method"] == "whatsapp":
                    wa_url = tenant_whatsapp_url(t, prefill=f"Hola, soy {flow['name']} y vengo del asistente")
                    msg_text = base + (f" Puedes escribirnos por WhatsApp aquí: 👉 {wa_url}" if wa_url else " Puedes escribirnos por WhatsApp en el botón de abajo.")
                    yield sse_event(json.dumps({"content": msg_text}), event="delta")
                    if wa_url:
                        yield sse_event(json.dumps({"whatsapp": wa_url, "whatsappLabel": "Abrir WhatsApp"}), event="ui")
                    yield sse_event(json.dumps({"lead":{"id": lead.get("id"), "status":"saved"}}), event="ui")
                    yield sse_event(json.dumps({}), event="done")
                    SESSIONS[sid]["contact_flow"] = {"stage": None, "name": None, "method": None, "contact": None}
                    return

                elif flow["method"] == "email":
                    yield sse_event(json.dumps({"content": base + " Puedo compartir aquí un checklist breve para definir el alcance. ¿Quieres verlo?"}), event="delta")
                    yield sse_event(json.dumps({"chips": ["Ver checklist"]}), event="ui")
                    yield sse_event(json.dumps({"lead":{"id": lead.get("id"), "status":"saved"}}), event="ui")
                    yield sse_event(json.dumps({}), event="done")
                    SESSIONS[sid]["contact_flow"] = {"stage": None, "name": None, "method": None, "contact": None}
                    return

                else:
                    yield sse_event(json.dumps({"content": base + " Para agendar, comparte 2–3 opciones con día y hora (ej.: mié 10:00–10:30; jue 16:00–16:30)."}), event="delta")
                    try:
                        SESSIONS[sid]["last_lead_id"] = lead.get("id")
                    except Exception:
                        pass
                    flow["stage"] = "ask_slot"
                    yield sse_event(json.dumps({"lead":{"id": lead.get("id"), "status":"saved"}}), event="ui")
                    yield sse_event(json.dumps({}), event="done")
                    return

            if flow["stage"] == "ask_slot":
                slot_text = (input.message or "").strip()
                if len(slot_text) < 5 or slot_text.lower() in {"cualquier hora","a cualquier hora","cuando sea","si","sí"}:
                    yield sse_event(json.dumps({"content":"¿Puedes darme 2–3 opciones concretas con día y hora? (ej.: mié 10:00–10:30; jue 16:00–16:30)"}), event="delta")
                    yield sse_event(json.dumps({}), event="done")
                    return
                try:
                    lead_id = SESSIONS[sid].get("last_lead_id")
                    if db_engine and lead_id:
                        async with db_engine.begin() as conn:
                            await conn.execute(
                                text("UPDATE leads SET meta = COALESCE(meta,'{}'::jsonb) || CAST(:add AS JSONB) WHERE id = :id"),
                                {"add": json.dumps({"preferred_slot": slot_text}), "id": lead_id}
                            )
                        async with db_engine.begin() as conn:
                            await conn.execute(
                                text("""INSERT INTO events (tenant_slug, session_id, type, payload)
                                        VALUES (:tenant, :sid, 'lead_slot', CAST(:payload AS JSONB))"""),
                                {"tenant": tenant or "public", "sid": sid, "payload": json.dumps({"lead_id": lead_id, "slot": slot_text})}
                            )
                except Exception as e:
                    log.warning(f"no se pudo guardar preferred_slot: {e}")
                yield sse_event(json.dumps({"content": f"Perfecto, anoté: {slot_text}. Cuando gustes podemos confirmar por aquí o por WhatsApp."}), event="delta")
                yield sse_event(json.dumps({}), event="done")
                SESSIONS[sid]["contact_flow"] = {"stage": None, "name": None, "method": None, "contact": None}
                SESSIONS[sid].pop("last_lead_id", None)
                return

            # ——— Respuesta del LLM si no hubo ninguna de las rutas anteriores ———
            if USE_MOCK:
                full = f"(mock) Recibí: {input.message}"
                for ch in full:
                    yield sse_event(json.dumps({"content": ch}), event="delta")
                    await asyncio.sleep(0)
                add_message(sid, "assistant", full)
                asyncio.create_task(log_message(tenant or "public", sid, "web", "out", full, author="assistant"))
                ui = suggest_ui_for_text(input.message, t)
                yield sse_event(json.dumps(ui), event="ui")
                yield sse_event(json.dumps({"done": True, "sessionId": sid}), event="done")
                return

            final_text = ""
            client_rt = client.with_options(timeout=60.0)
            stream = None
            for attempt in range(2):
                try:
                    stream = client_rt.chat.completions.create(
                        model=OPENAI_MODEL,
                        messages=messages,
                        stream=True
                    )
                    break
                except Exception as e:
                    if attempt == 1:
                        raise
                    await asyncio.sleep(0.7)

            if stream is None:
                raise RuntimeError("No se pudo iniciar stream")

            for chunk in stream:
                piece = getattr(chunk.choices[0].delta, "content", None)
                if piece:
                    final_text += piece
                    yield sse_event(json.dumps({"content": piece}), event="delta")
                    await asyncio.sleep(0)
                if await request.is_disconnected():
                    add_message(sid, "assistant", final_text)
                    asyncio.create_task(log_message(tenant or "public", sid, "web", "out", final_text, author="assistant"))
                    return

            add_message(sid, "assistant", final_text)
            asyncio.create_task(store_event(tenant or "public", sid, "msg_out", {"text": final_text[:MAX_TEXT_LENGTH]}))
            asyncio.create_task(log_message(tenant or "public", sid, "web", "out", final_text, author="assistant"))
            ui = suggest_ui_for_text(input.message, t)
            yield sse_event(json.dumps(ui), event="ui")
            yield sse_event(json.dumps({"done": True, "sessionId": sid}), event="done")

        except Exception as e:
            log.error(f"SSE ERROR: {e}")
            yield sse_event(json.dumps({"error": str(e)}), event="error")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","Connection":"keep-alive","X-Accel-Buffering":"no"}
    )


# ── Auth endpoints ─────────────────────────────────────────────────────
@app.post("/auth/login", response_model=AuthTokenOut)
async def auth_login(body: LoginIn):
    user = await fetch_user_by_email(body.email)
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_access_token(user["id"], user["tenant_slug"])
    if db_engine:
        try:
            async with db_engine.begin() as conn:
                await conn.execute(
                    text("UPDATE users SET updated_at = NOW() WHERE id = :id"),
                    {"id": user["id"]}
                )
        except Exception as e:
            log.debug(f"auth login update failed: {e}")
    return AuthTokenOut(access_token=token)


@app.get("/auth/me")
async def auth_me(current = Depends(require_user)):
    tenant = await fetch_tenant(current["tenant_slug"])
    return {
        "user": {
            "id": current["id"],
            "email": current["email"],
            "tenant": current["tenant_slug"],
            "role": current.get("role"),
        },
        "tenant": tenant,
    }


# ── Facebook OAuth endpoints ───────────────────────────────────────────
@app.get("/auth/facebook/connect")
async def facebook_oauth_connect(current = Depends(require_user)):
    """Inicia el flujo OAuth de Facebook para conectar una página."""
    app_id = os.getenv("META_APP_ID", "").strip()
    redirect_uri = os.getenv("FACEBOOK_REDIRECT_URI", "").strip()

    if not app_id:
        raise HTTPException(500, "META_APP_ID no configurado")
    if not redirect_uri:
        raise HTTPException(500, "FACEBOOK_REDIRECT_URI no configurado")

    # Generar state con tenant_slug para validación en callback
    state = jwt.encode(
        {
            "tenant_slug": current["tenant_slug"],
            "user_id": current["id"],
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
        },
        AUTH_SECRET,
        algorithm="HS256"
    )

    # Permisos necesarios para pages, Instagram, y mensajería
    scope = "pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages,instagram_manage_comments"

    auth_url = (
        f"https://www.facebook.com/v20.0/dialog/oauth?"
        f"client_id={app_id}&"
        f"redirect_uri={quote_plus(redirect_uri)}&"
        f"state={state}&"
        f"scope={scope}"
    )

    return {"auth_url": auth_url}


@app.get("/auth/facebook/callback")
async def facebook_oauth_callback(
    code: str = Query(...),
    state: str = Query(...)
):
    """Maneja el callback de Facebook OAuth y guarda los tokens."""
    # Validar state
    try:
        state_data = jwt.decode(state, AUTH_SECRET, algorithms=["HS256"])
        tenant_slug = state_data["tenant_slug"]
        user_id = state_data["user_id"]
    except Exception as e:
        log.error(f"Invalid OAuth state: {e}")
        raise HTTPException(400, "Estado OAuth inválido o expirado")

    app_id = os.getenv("META_APP_ID", "").strip()
    app_secret = os.getenv("META_APP_SECRET", "").strip()
    redirect_uri = os.getenv("FACEBOOK_REDIRECT_URI", "").strip()

    if not app_id or not app_secret:
        raise HTTPException(500, "META_APP_ID o META_APP_SECRET no configurados")

    # Intercambiar code por access token
    token_url = (
        f"https://graph.facebook.com/v20.0/oauth/access_token?"
        f"client_id={app_id}&"
        f"redirect_uri={quote_plus(redirect_uri)}&"
        f"client_secret={app_secret}&"
        f"code={code}"
    )

    async with httpx.AsyncClient() as client:
        resp = await client.get(token_url)
        if resp.status_code != 200:
            log.error(f"Facebook token exchange failed: {resp.text}")
            raise HTTPException(400, "Error obteniendo token de Facebook")

        data = resp.json()
        user_access_token = data.get("access_token")

        if not user_access_token:
            raise HTTPException(400, "No se recibió access token")

        # Obtener long-lived token
        long_lived_url = (
            f"https://graph.facebook.com/v20.0/oauth/access_token?"
            f"grant_type=fb_exchange_token&"
            f"client_id={app_id}&"
            f"client_secret={app_secret}&"
            f"fb_exchange_token={user_access_token}"
        )

        resp2 = await client.get(long_lived_url)
        if resp2.status_code == 200:
            long_lived_data = resp2.json()
            user_access_token = long_lived_data.get("access_token", user_access_token)

        # Obtener páginas del usuario
        pages_url = f"https://graph.facebook.com/v20.0/me/accounts?access_token={user_access_token}"
        resp3 = await client.get(pages_url)

        if resp3.status_code != 200:
            log.error(f"Error getting pages: {resp3.text}")
            raise HTTPException(400, "Error obteniendo páginas de Facebook")

        pages_data = resp3.json()
        pages = pages_data.get("data", [])

        if not pages:
            raise HTTPException(400, "No se encontraron páginas asociadas a esta cuenta")

        # Guardar tokens en la base de datos
        # Por simplicidad, guardamos la primera página. Puedes mejorar esto para elegir
        page = pages[0]
        page_id = page.get("id")
        page_token = page.get("access_token")
        page_name = page.get("name")

        # Obtener Instagram Business Account asociado (si existe)
        ig_account_id = None
        ig_url = f"https://graph.facebook.com/v20.0/{page_id}?fields=instagram_business_account&access_token={page_token}"
        resp4 = await client.get(ig_url)
        if resp4.status_code == 200:
            ig_data = resp4.json()
            ig_account = ig_data.get("instagram_business_account")
            if ig_account:
                ig_account_id = ig_account.get("id")

    # Guardar en la base de datos (en settings JSON, multi-tenant)
    if db_engine:
        async with db_engine.begin() as conn:
            # Obtener settings actuales del tenant
            result = await conn.execute(
                text("SELECT settings FROM tenants WHERE slug = :slug"),
                {"slug": tenant_slug}
            )
            row = result.first()
            current_settings = row[0] if row and row[0] else {}

            # Actualizar con nuevos tokens de Facebook
            current_settings.update({
                "fb_page_id": page_id,
                "fb_page_token": page_token,
                "fb_page_name": page_name,
                "ig_user_id": ig_account_id,
                "ig_user_ids": [ig_account_id] if ig_account_id else []
            })

            # Guardar settings actualizados
            await conn.execute(
                text("""
                    UPDATE tenants
                    SET settings = CAST(:settings AS JSONB),
                        updated_at = NOW()
                    WHERE slug = :slug
                """),
                {
                    "settings": json.dumps(current_settings),
                    "slug": tenant_slug
                }
            )

    # Redirigir al dashboard con éxito
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return Response(
        status_code=302,
        headers={"Location": f"{frontend_url}/dashboard?facebook_connected=true"}
    )


@app.post("/auth/facebook/disconnect", dependencies=[Depends(require_admin)])
async def facebook_oauth_disconnect(current = Depends(require_user)):
    """Desconecta la cuenta de Facebook del tenant."""
    tenant_slug = current["tenant_slug"]

    if db_engine:
        async with db_engine.begin() as conn:
            # Obtener settings actuales
            result = await conn.execute(
                text("SELECT settings FROM tenants WHERE slug = :slug"),
                {"slug": tenant_slug}
            )
            row = result.first()
            current_settings = row[0] if row and row[0] else {}

            # Remover credenciales de Facebook/Instagram (multi-tenant)
            current_settings.pop("fb_page_id", None)
            current_settings.pop("fb_page_token", None)
            current_settings.pop("fb_page_name", None)
            current_settings.pop("ig_user_id", None)
            current_settings.pop("ig_user_ids", None)

            # Guardar settings actualizados
            await conn.execute(
                text("""
                    UPDATE tenants
                    SET settings = CAST(:settings AS JSONB),
                        updated_at = NOW()
                    WHERE slug = :slug
                """),
                {
                    "settings": json.dumps(current_settings),
                    "slug": tenant_slug
                }
            )

    return {"success": True, "message": "Facebook desconectado correctamente"}


# ── Admin endpoints ────────────────────────────────────────────────────
@app.get("/v1/admin/leads", dependencies=[Depends(require_admin)])
async def admin_list_leads(limit: int = 50, offset: int = 0, tenant: str = Query(default="")):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    if not db_engine:
        raise HTTPException(503, "Database not configured")
    q = """
        SELECT id, tenant_slug, session_id, name, method, contact, meta, created_at
        FROM leads
        WHERE (:tenant = '' OR tenant_slug = :tenant)
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """
    async with db_engine.connect() as conn:
        rows = (await conn.execute(text(q), {"tenant": tenant, "limit": limit, "offset": offset})).mappings().all()
    return {"items": list(rows)}


@app.post("/v1/admin/users", dependencies=[Depends(require_admin)])
async def admin_create_user(body: UserCreateIn):
    tenant_slug = body.tenant.strip()
    if not valid_slug(tenant_slug):
        raise HTTPException(400, "Invalid tenant slug")
    tenant_obj = await fetch_tenant(tenant_slug)
    if not tenant_obj:
        raise HTTPException(404, "Tenant no encontrado")
    password_hash = hash_password(body.password)
    async with db_engine.begin() as conn:
        await conn.execute(
            text("""
                INSERT INTO users (tenant_slug, email, password_hash)
                VALUES (:tenant, :email, :hash)
                ON CONFLICT (email) DO UPDATE SET
                    tenant_slug = EXCLUDED.tenant_slug,
                    password_hash = EXCLUDED.password_hash,
                    updated_at = NOW()
            """),
            {"tenant": tenant_slug, "email": body.email.strip().lower(), "hash": password_hash}
        )
    return {"ok": True}


# ── Tenant portal endpoints (auth required) ────────────────────────────
@app.get("/v1/admin/tenant/settings", response_model=TenantSettingsOut)
async def tenant_get_settings(current = Depends(require_user)):
    tenant = await fetch_tenant(current["tenant_slug"])
    if not tenant:
        raise HTTPException(404, "Tenant no encontrado")
    return TenantSettingsOut(
        slug=tenant["slug"],
        name=tenant["name"],
        whatsapp=tenant.get("whatsapp"),
        settings=tenant.get("settings") or {}
    )


@app.put("/v1/admin/tenant/settings", response_model=TenantSettingsOut)
async def tenant_update_settings(body: TenantSettingsUpdate, current = Depends(require_user)):
    tenant_slug = current["tenant_slug"]
    tenant = await fetch_tenant(tenant_slug)
    if not tenant:
        raise HTTPException(404, "Tenant no encontrado")

    if body.whatsapp is not None:
        async with db_engine.begin() as conn:
            await conn.execute(
                text("UPDATE tenants SET whatsapp = :wa, updated_at = NOW() WHERE slug = :slug"),
                {"wa": body.whatsapp.strip() if body.whatsapp else None, "slug": tenant_slug}
            )

    if body.settings:
        await update_tenant_settings(tenant_slug, body.settings)

    tenant_updated = await fetch_tenant(tenant_slug)
    return TenantSettingsOut(
        slug=tenant_updated["slug"],
        name=tenant_updated["name"],
        whatsapp=tenant_updated.get("whatsapp"),
        settings=tenant_updated.get("settings") or {}
    )


@app.get("/v1/admin/messages")
async def tenant_list_messages(
    channel: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
    before_id: Optional[int] = Query(default=None),
    current = Depends(require_user)
):
    if not db_engine:
        raise HTTPException(503, "Database not configured")
    clauses = ["tenant_slug = :tenant"]
    params: Dict[str, Any] = {"tenant": current["tenant_slug"], "limit": limit}
    if channel:
        clauses.append("channel = :channel")
        params["channel"] = channel
    if before_id:
        clauses.append("id < :before")
        params["before"] = before_id
    where = " AND ".join(clauses)
    q = f"""
        SELECT id, tenant_slug, session_id, channel, direction, author, content, payload, created_at
        FROM messages
        WHERE {where}
        ORDER BY id DESC
        LIMIT :limit
    """
    async with db_engine.connect() as conn:
        rows = (await conn.execute(text(q), params)).mappings().all()
    return {"items": [dict(row) for row in rows]}


@app.get("/v1/admin/metrics/overview")
async def tenant_metrics_overview(days: int = Query(default=7, ge=1, le=90), current = Depends(require_user)):
    if not db_engine:
        raise HTTPException(503, "Database not configured")
    tenant = current["tenant_slug"]
    async with db_engine.connect() as conn:
        msgs = (await conn.execute(text("""
            SELECT 
                count(*) FILTER (WHERE direction = 'in') AS inbound,
                count(*) FILTER (WHERE direction = 'out') AS outbound,
                count(DISTINCT session_id) AS conversations
            FROM messages
            WHERE tenant_slug = :tenant
              AND created_at >= NOW() - (:days || ' days')::interval
        """), {"tenant": tenant, "days": str(days)})).mappings().first() or {}

        actions = (await conn.execute(text("""
            SELECT type, count(*) AS c
            FROM events
            WHERE tenant_slug = :tenant
              AND created_at >= NOW() - (:days || ' days')::interval
              AND type IN ('lead_saved','wa_out','checkout_link_out','stripe_checkout_completed')
            GROUP BY 1
        """), {"tenant": tenant, "days": str(days)})).mappings().all()

        lead_count = (await conn.execute(text("""
            SELECT count(*) AS leads
            FROM leads
            WHERE tenant_slug = :tenant
              AND created_at >= NOW() - (:days || ' days')::interval
        """), {"tenant": tenant, "days": str(days)})).scalar_one()

        approx_tokens = (await conn.execute(text("""
            SELECT COALESCE(sum(GREATEST(char_length(content) / 4, 1)), 0)::int AS tokens
            FROM messages
            WHERE tenant_slug = :tenant
              AND direction = 'out'
              AND created_at >= NOW() - (:days || ' days')::interval
        """), {"tenant": tenant, "days": str(days)})).scalar_one()

    return {
        "messages": {
            "inbound": int(msgs.get("inbound", 0)),
            "outbound": int(msgs.get("outbound", 0)),
            "conversations": int(msgs.get("conversations", 0)),
        },
        "actions": {row["type"]: int(row["c"]) for row in actions},
        "leads": int(lead_count or 0),
        "approxTokens": int(approx_tokens or 0),
        "rangeDays": days,
    }


@app.get("/v1/admin/metrics/daily", dependencies=[Depends(require_admin)])
async def admin_metrics_daily(tenant: str = Query(default="")):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    if not db_engine:
        raise HTTPException(503, "Database not configured")
    q1 = """
        SELECT date_trunc('day', created_at) AS day, count(*)::int AS leads
        FROM leads
        WHERE (:tenant = '' OR tenant_slug = :tenant)
        GROUP BY 1 ORDER BY 1 DESC LIMIT 30
    """
    q2 = """
        SELECT date_trunc('day', created_at) AS day, 
               sum(CASE WHEN type='opened' THEN 1 ELSE 0 END)::int AS opened,
               sum(CASE WHEN type='first_interaction' THEN 1 ELSE 0 END)::int AS first_interaction,
               sum(CASE WHEN type='message_sent' THEN 1 ELSE 0 END)::int AS message_sent,
               sum(CASE WHEN type='wa_click' THEN 1 ELSE 0 END)::int AS wa_click
        FROM events
        WHERE (:tenant = '' OR tenant_slug = :tenant)
        GROUP BY 1 ORDER BY 1 DESC LIMIT 30
    """
    async with db_engine.connect() as conn:
        leads = (await conn.execute(text(q1), {"tenant": tenant})).mappings().all()
        evs   = (await conn.execute(text(q2), {"tenant": tenant})).mappings().all()
    return {"leads": list(leads), "events": list(evs)}

@app.get("/v1/admin/export/leads.csv", dependencies=[Depends(require_admin)])
async def export_leads_csv(tenant: str = Query(default="")):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    if not db_engine:
        raise HTTPException(503, "Database not configured")
    q = """
      SELECT id, tenant_slug, session_id, name, method, contact,
             COALESCE(meta->>'preferred_slot','') AS preferred_slot,
             created_at
      FROM leads
      WHERE (:tenant = '' OR tenant_slug = :tenant)
      ORDER BY created_at DESC
    """
    async with db_engine.connect() as conn:
        rows = (await conn.execute(text(q), {"tenant": tenant})).mappings().all()
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["id","tenant_slug","session_id","name","method","contact","preferred_slot","created_at"])
    writer.writeheader()
    for r in rows:
        writer.writerow(dict(r))
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=leads.csv"})

@app.get("/v1/admin/export/events.csv", dependencies=[Depends(require_admin)])
async def export_events_csv(tenant: str = Query(default=""), days: int = 30):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    if not db_engine:
        raise HTTPException(503, "Database not configured")
    q = """
      SELECT id, tenant_slug, session_id, type, payload, created_at
      FROM events
      WHERE (:tenant = '' OR tenant_slug = :tenant)
        AND created_at >= now() - (:days || ' days')::interval
      ORDER BY created_at DESC
    """
    async with db_engine.connect() as conn:
        rows = (await conn.execute(text(q), {"tenant": tenant, "days": days})).mappings().all()
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["id","tenant_slug","session_id","type","payload","created_at"])
    writer.writeheader()
    for r in rows:
        row = dict(r)
        row["payload"] = json.dumps(row.get("payload") or {})
        writer.writerow(row)
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=events.csv"})

@app.get("/v1/admin/meta/diagnostics", dependencies=[Depends(require_admin)])
async def admin_meta_diagnostics(tenant: str = Query(default="")):
    """Diagnóstico de configuración Meta por tenant (DB-only), con máscaras.

    Responde si el tenant existe y si tiene presentes:
    - settings.fb_page_id
    - settings.fb_page_token
    - settings.ig_user_id
    Además, muestra máscaras y checks básicos.
    """
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    if not db_engine:
        raise HTTPException(503, "Database not configured")

    t = await fetch_tenant(tenant)
    if not t:
        raise HTTPException(404, f"Tenant '{tenant}' no encontrado")

    s = (t or {}).get("settings", {}) or {}
    fb_page_id = str(s.get("fb_page_id", "") or "")
    fb_page_token = str(s.get("fb_page_token", "") or "")
    ig_user_id = str(s.get("ig_user_id", "") or "")

    warnings: list[str] = []
    if not fb_page_token:
        warnings.append("Falta settings.fb_page_token en DB: no se pueden enviar respuestas")
    if not fb_page_id:
        warnings.append("Falta settings.fb_page_id en DB: private replies podrían fallar")
    if not ig_user_id:
        warnings.append("Falta settings.ig_user_id en DB: IG comments/DM podrían no mapear tenant")

    return {
        "ok": True,
        "tenant": tenant,
        "settings": {
            "fb_page_id_present": bool(fb_page_id),
            "fb_page_token_present": bool(fb_page_token),
            "ig_user_id_present": bool(ig_user_id),
            "fb_page_id_masked": _mask(fb_page_id, 4),
            "fb_page_token_masked": _mask(fb_page_token, 6),
            "ig_user_id_masked": _mask(ig_user_id, 4),
        },
        "capabilities": {
            "can_reply_dms": bool(fb_page_token),
            "can_reply_comments_fb": bool(fb_page_token),
            "can_reply_comments_ig": bool(fb_page_token),
        },
        "webhook": {
            "verify_token_present": bool(os.getenv("META_VERIFY_TOKEN", "")),
        },
        "warnings": warnings,
    }

@app.post("/v1/admin/meta/test-reply", dependencies=[Depends(require_admin)])
async def admin_meta_test_reply(body: MetaTestReplyIn):
    # Validar tenant
    tenant_slug = (body.tenant or "").strip()
    if tenant_slug and not valid_slug(tenant_slug):
        raise HTTPException(400, "Invalid tenant")
    t = await fetch_tenant(tenant_slug)
    if not t:
        raise HTTPException(404, f"Tenant '{tenant_slug}' no encontrado")

    page_id, page_token, ig_user_id = fb_tokens_from_tenant(t)
    if not page_token:
        raise HTTPException(400, "Falta settings.fb_page_token para el tenant")

    platform = (body.platform or "").strip().lower()
    comment_id = (body.commentId or "").strip()
    if not comment_id:
        raise HTTPException(400, "Falta commentId")

    message_public = body.text or "Prueba: respuesta pública desde backend (test)."
    message_private = body.text or "Prueba: mensaje privado desde backend (test)."
    mode = (body.mode or "both").strip().lower()

    results = {"public": None, "private": None}

    # Ejecutar reply público
    if mode in {"public", "both"}:
        try:
            if platform in {"facebook", "page", "fb"}:
                data = await fb_reply_comment(page_token, comment_id, message_public)
            elif platform in {"instagram", "ig"}:
                data = await ig_reply_comment(page_token, comment_id, message_public)
            else:
                raise HTTPException(400, "platform debe ser 'facebook'|'page'|'fb' o 'instagram'|'ig'")
            results["public"] = {"ok": True, "data": data}
        except Exception as e:
            results["public"] = {"ok": False, "error": str(e)}

    # Ejecutar reply privado (FB: private reply via Page Messages). IG puede fallar; se reporta el error.
    if mode in {"private", "both"}:
        try:
            if platform in {"facebook", "page", "fb"}:
                data = await meta_private_reply_to_comment(page_id, page_token, comment_id, message_private)
            elif platform in {"instagram", "ig"}:
                # Para IG, este método puede no estar soportado; intentamos y reportamos
                data = await meta_private_reply_to_comment(page_id, page_token, comment_id, message_private)
            else:
                raise HTTPException(400, "platform debe ser 'facebook'|'page'|'fb' o 'instagram'|'ig'")
            results["private"] = {"ok": True, "data": data}
        except Exception as e:
            results["private"] = {"ok": False, "error": str(e)}

    return {
        "ok": True,
        "tenant": tenant_slug,
        "platform": platform,
        "commentId": comment_id,
        "results": results,
    }

@app.post("/v1/twilio/whatsapp/webhook")
async def twilio_whatsapp_webhook(request: Request, tenant: str = Query(default="")):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")

    form = await request.form()
    # Guardar body para validación de firma
    request.state._twilio_body = {k: str(v) for k, v in form.items()}

    if not _twilio_req_is_valid(request, TWILIO_AUTH_TOKEN):
        raise HTTPException(403, "Invalid Twilio signature")

    from_raw = str(form.get("From", ""))
    body_txt = str(form.get("Body", "")).strip()
    if not from_raw or not body_txt:
        return Response("<Response></Response>", media_type="application/xml")
    
    text_lc = body_txt.lower()
    phone = norm_phone(from_raw)
    sid_session = f"wa:{phone}"
    sid = ensure_session(sid_session)
    add_message(sid, "user", body_txt)
    asyncio.create_task(store_event(tenant or "public", sid, "wa_in", {"from": from_raw, "text": body_txt}))
    asyncio.create_task(log_message(tenant or "public", sid, "whatsapp", "in", body_txt, author=from_raw))

    t = await fetch_tenant(tenant)

    if t and not tenant_bot_enabled(t):
        off_msg = ((t.get("settings") or {}).get("bot_off_message") or "El asistente está en pausa. Escríbenos directamente por WhatsApp al enlace habitual.")
        add_message(sid, "assistant", off_msg)
        asyncio.create_task(store_event(tenant or "public", sid, "wa_out", {"to": from_raw, "text": off_msg[:MAX_TEXT_LENGTH]}))
        asyncio.create_task(log_message(tenant or "public", sid, "whatsapp", "out", off_msg, author="bot"))
        twiml = MessagingResponse()
        twiml.message(off_msg)
        return Response(str(twiml), media_type="application/xml")

    # Fast-path: "quiero suscribirme al plan starter/meta"
    if any(k in text_lc for k in ["compr", "compra", "pagar", "pago", "checkout", "suscrib"]) and ("starter" in text_lc or "meta" in text_lc):
        plan = "starter" if "starter" in text_lc else "meta"
        try:
            prices = _tenant_stripe_prices(t)
            if plan not in prices:
                prices = await ensure_prices_for_tenant(t)
            price_id = prices[plan]
            session = await _create_checkout_for_any(t, price_id=price_id, qty=1, mode="subscription")
            answer = f"Listo ✅ Aquí tienes tu enlace de suscripción al plan {plan.title()}: {session['url']}"
            add_message(sid, "assistant", answer)
            asyncio.create_task(store_event(tenant or "public", sid, "wa_out", {"to": from_raw, "text": answer[:MAX_TEXT_LENGTH]}))
            asyncio.create_task(log_message(tenant or "public", sid, "whatsapp", "out", answer, author="bot"))
            twiml = MessagingResponse()
            twiml.message(answer)
            return Response(str(twiml), media_type="application/xml")
        except Exception as e:
            log.warning(f"WA fast-path checkout falló: {e}")
            # si falla, sigue al comportamiento normal con LLM


    system_prompt = build_system_for_tenant(t)
    messages = build_messages_with_history(sid, system_prompt)
    answer = generate_answer(messages)
    add_message(sid, "assistant", answer)
    asyncio.create_task(store_event(tenant or "public", sid, "wa_out", {"to": from_raw, "text": answer[:MAX_TEXT_LENGTH]}))
    asyncio.create_task(log_message(tenant or "public", sid, "whatsapp", "out", answer, author="bot"))

    twiml = MessagingResponse()
    twiml.message(answer)
    return Response(str(twiml), media_type="application/xml")

@app.options("/v1/admin/export/leads.csv")
async def options_export_leads():
    return Response(status_code=204)

@app.options("/v1/admin/export/events.csv")
async def options_export_events():
    return Response(status_code=204)

#----------Integracion Stripe --------------
#Endpoint para generar link de onboarding
@app.post("/v1/admin/stripe/connect/onboard", dependencies=[Depends(require_admin)])
async def stripe_connect_onboard(tenant: str = Query(...)):
    t = await fetch_tenant(tenant)
    if not t:
        raise HTTPException(404, "Tenant no encontrado")

    acct = _tenant_stripe_acct(t)
    if not acct:
        account = stripe.Account.create(
            type="express",
            country="MX",
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
        )
        acct = account.id
        await update_tenant_settings(tenant, {"stripe_acct": acct})

    link = stripe.AccountLink.create(
        account=acct,
        refresh_url=f"{SITE_URL}/connect/refresh?tenant={tenant}",
        return_url=f"{SITE_URL}/connect/return?tenant={tenant}",
        type="account_onboarding",
    )
    return {"onboarding_url": link.url, "acct": acct}

#Endpoint público que usará tu web/widget:
@app.post("/v1/stripe/checkout/by-plan")
async def stripe_checkout_by_plan(body: dict, tenant: str = Query(...)):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    t = await fetch_tenant(tenant)
    if not t:
        raise HTTPException(404, "Tenant no encontrado")

    acct = _tenant_stripe_acct(t)
    if not acct:
        raise HTTPException(400, "Tenant no tiene Stripe conectado (stripe_acct)")

    plan = (body.get("plan") or "").strip().lower()  # "starter" | "meta"
    qty = max(1, int(body.get("quantity", 1)))
    if plan not in {"starter", "meta"}:
        raise HTTPException(400, "Parámetros inválidos")

    prices = _tenant_stripe_prices(t)
    if plan not in prices:
        prices = await ensure_prices_for_tenant(t)

    price_id = prices[plan]

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": qty}],
        success_url=f"{SITE_URL}/pago-exitoso?sid={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{SITE_URL}/pago-cancelado",
        metadata={"tenant": tenant, "plan": plan},
        stripe_account=acct,
    )
    return {"id": session.id, "url": session.url}


@app.post("/v1/stripe/webhook")
async def stripe_webhook(request: Request):
    """Webhook de Stripe para manejar eventos de pagos y suscripciones."""
    if not STRIPE_WEBHOOK_SECRET:
        log.error("STRIPE_WEBHOOK_SECRET no configurado")
        raise HTTPException(500, "Server misconfiguration")

    raw = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not sig:
        log.warning("Webhook de Stripe sin stripe-signature header")
        raise HTTPException(403, "Missing signature")

    try:
        event = stripe.Webhook.construct_event(raw, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError as e:
        log.warning(f"❌ Firma de Stripe inválida: {e}")
        raise HTTPException(403, "Invalid signature")
    except Exception as e:
        log.error(f"Error procesando webhook de Stripe: {e}")
        return Response(f"Webhook error: {e}", status_code=400)

    acct = event.get("account")  # acct_XXXX de la cuenta conectada
    tenant_slug = await find_tenant_by_acct(acct) or "public"
    etype = event["type"]
    data = event["data"]["object"]

    # Ejemplos mínimos de manejo:
    if etype == "checkout.session.completed":
        sub_id = data.get("subscription")
        cust_id = data.get("customer")
        sid = data.get("id")
        asyncio.create_task(store_event(tenant_slug, sid or "stripe", "stripe_checkout_completed",
                                        {"subscription": sub_id, "customer": cust_id}))

    elif etype == "invoice.paid":
        asyncio.create_task(store_event(tenant_slug, "stripe", "stripe_invoice_paid",
                                        {"invoice": data.get("id")}))
    elif etype.startswith("customer.subscription."):
        asyncio.create_task(store_event(tenant_slug, "stripe", etype.replace(".", "_"),
                                        {"subscription": data.get("id")}))

    return {"ok": True}


@app.post("/v1/stripe/checkout/by-item")
async def stripe_checkout_by_item(body: CheckoutItemIn, tenant: str = Query(...)):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    t = await fetch_tenant(tenant)
    if not t:
        raise HTTPException(404, "Tenant no encontrado")

    price_id = (body.price_id or "").strip()
    product_id = (body.product_id or "").strip()
    qty = max(1, int(body.quantity or 1))
    mode = (body.mode or None)

    if not price_id and not product_id:
        raise HTTPException(400, "Debes enviar price_id o product_id")

    session = await _create_checkout_for_any(
        t, price_id=price_id, product_id=product_id, qty=qty, mode=mode
    )
    return session


# Endpoint público para crear checkout session desde el frontend (acidia.app)
@app.post("/api/create-checkout-session")
async def create_checkout_session_public(body: dict):
    """
    Endpoint público para crear sesiones de Stripe desde el frontend de AcidIA.
    Espera: { lineItems: [{ price: string, quantity: number }, ...] }
    """
    line_items = body.get("lineItems", [])
    if not line_items or not isinstance(line_items, list):
        raise HTTPException(400, "lineItems debe ser un array con al menos un item")

    # Por defecto usar tenant "acidia" (configurable según tu setup)
    tenant_slug = "acidia"
    t = await fetch_tenant(tenant_slug)
    if not t:
        raise HTTPException(404, f"Tenant {tenant_slug} no encontrado")

    acct = _tenant_stripe_acct(t)
    if not acct:
        raise HTTPException(400, "Tenant no tiene Stripe conectado")

    # Preparar line_items para Stripe
    stripe_line_items = []
    for item in line_items:
        price = item.get("price", "").strip()
        quantity = max(1, int(item.get("quantity", 1)))
        if not price:
            continue
        stripe_line_items.append({"price": price, "quantity": quantity})

    if not stripe_line_items:
        raise HTTPException(400, "No hay items válidos en lineItems")

    # Crear sesión de checkout
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=stripe_line_items,
            success_url=f"{SITE_URL}/?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{SITE_URL}/?checkout=cancelled",
            metadata={"tenant": tenant_slug},
            stripe_account=acct,
        )
        return {"id": session.id, "url": session.url}
    except stripe.error.StripeError as e:
        log.error(f"Stripe error: {e}")
        raise HTTPException(400, f"Error creando sesión: {str(e)}")


@app.get("/v1/catalog")
async def get_catalog(tenant: str = Query(...)):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    t = await fetch_tenant(tenant)
    if not t:
        raise HTTPException(404, "Tenant no encontrado")
    items = await fetch_catalog_for_tenant(t)
    for it in items:
        it["can_checkout"] = bool((it.get("price_id") or it.get("product_id")))
    return {"count": len(items), "items": items[:200]}

#checkout para whatsapp 

@app.post("/v1/stripe/checkout/send-wa")
async def stripe_checkout_send_whatsapp(body: SendWaCheckoutIn, tenant: str = Query(...)):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    t = await fetch_tenant(tenant)
    if not t:
        raise HTTPException(404, "Tenant no encontrado")

    # 1) Crear checkout
    session = None
    if body.plan:
        # Reusa tu endpoint/función by-plan si quieres; aquí lo hacemos directo:
        prices = _tenant_stripe_prices(t)
        if body.plan not in prices:
            _ = await ensure_prices_for_tenant(t)
            prices = _tenant_stripe_prices(t)
        price_id = prices[body.plan]
        session = await _create_checkout_for_any(t, price_id=price_id, qty=body.quantity, mode="subscription")
    else:
        session = await _create_checkout_for_any(
            t,
            price_id=(body.price_id or None),
            product_id=(body.product_id or None),
            qty=body.quantity,
            mode=body.mode or None
        )

    url = session["url"]
    # 2) Enviar por WhatsApp
    to = body.to
    if not is_phone(to):
        raise HTTPException(400, "El campo 'to' debe ser un teléfono válido con lada")
    to_e164 = norm_phone(to)
    txt = f"Hola 👋 Aquí tienes tu enlace de pago seguro: {url}\n\nSi necesitas ayuda, responde este WhatsApp."
    try:
        await twilio_send_whatsapp(tenant, to_e164, txt)
    except Exception as e:
        log.error(f"WA send error: {e}")
        raise HTTPException(502, "No se pudo enviar el WhatsApp")

    return {"ok": True, "checkout": session, "to": to_e164}

#qr checkout por whatsapp
@app.post("/v1/stripe/checkout/qr")
async def stripe_checkout_qr(body: CheckoutQrIn, tenant: str = Query(...)):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    t = await fetch_tenant(tenant)
    if not t:
        raise HTTPException(404, "Tenant no encontrado")

    if body.plan:
        prices = _tenant_stripe_prices(t)
        if body.plan not in prices:
            _ = await ensure_prices_for_tenant(t)
            prices = _tenant_stripe_prices(t)
        price_id = prices[body.plan]
        session = await _create_checkout_for_any(t, price_id=price_id, qty=body.quantity, mode="subscription")
    else:
        session = await _create_checkout_for_any(
            t,
            price_id=(body.price_id or None),
            product_id=(body.product_id or None),
            qty=body.quantity,
            mode=body.mode or None
        )

    url = session["url"]

    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    headers = {"Cache-Control": "no-store"}
    return StreamingResponse(buf, media_type="image/png", headers=headers)
