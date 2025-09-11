import os, uuid, time, asyncio, json, logging, re
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Header, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import StreamingResponse, Response
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from openai import OpenAI, OpenAIError
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy import text
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
import csv, io
from twilio.rest import Client as TwilioClient
from twilio.twiml.messaging_response import MessagingResponse
from twilio.request_validator import RequestValidator
import httpx
import stripe

# ── Setup ──────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("zia")

app = FastAPI(title="ZIA Backend", version="1.1")
client = OpenAI()  # usa OPENAI_API_KEY del entorno

# ── Config ─────────────────────────────────────────────────────────────
# ── Config ─────────────────────────────────────────────────────────────
def as_bool(val: Optional[str], default: bool = False) -> bool:
    if val is None:
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "y", "on")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

DATABASE_URL   = os.getenv("DATABASE_URL", "")
USE_MOCK       = as_bool(os.getenv("USE_MOCK"), False)
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
RATE_LIMIT     = int(os.getenv("RATE_LIMIT", "20"))
RATE_WINDOW_SECONDS = int(os.getenv("RATE_WINDOW_SECONDS", "10"))
ADMIN_KEY      = os.getenv("ADMIN_KEY", "")
PROXY_IP_HEADER = os.getenv("PROXY_IP_HEADER", "").lower()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN  = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")
TWILIO_SMS_FROM       = os.getenv("TWILIO_SMS_FROM", "")
TWILIO_VALIDATE_SIGNATURE = as_bool(os.getenv("TWILIO_VALIDATE_SIGNATURE"), False)

# ← NUEVO: evita NameError en el webhook
META_DRY_RUN = as_bool(os.getenv("META_DRY_RUN"), False)
#stripe keys 
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
SITE_URL = os.getenv("SITE_URL", "https://web-zia.vercel.app")

stripe.api_key = STRIPE_SECRET_KEY



ZIA_SYSTEM_PROMPT = (
    "Eres el asistente de zIA (automatización con IA). "
    "Objetivo: resolver dudas frecuentes, sugerir soluciones y guiar al usuario a la siguiente acción. "
    "Tono: cálido y directo. Español por defecto; si el usuario cambia de idioma, adáptate. "
    "Políticas: no inventes precios ni promesas; si faltan datos, dilo y ofrece agendar demo o cotización. "
    "No pidas datos sensibles; para contacto, solo nombre y email o WhatsApp cuando el usuario acepte. "
    "Interpreta con base en los últimos 5 pasos de la conversación. "
    "Acciones (menciónalas cuando encajen): • Agendar demo • Cotizar proyecto • Automatizar WhatsApp/Meta • Hablar por WhatsApp. "
    "Reglas de contacto: No prometas que “nos pondremos en contacto”, “te llamamos” ni seguimiento proactivo. "
    "Aunque el usuario comparta su nombre o WhatsApp, pide que INICIE el contacto: usa el botón/enlace de WhatsApp de abajo "
    "o propón agendar pidiendo 2–3 horarios. "
    "Solo ofrece checklist si el cliente lo menciona explícitamente."
)

# ── CORS ───────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static assets for the embeddable widget
try:
    app.mount("/widget", StaticFiles(directory="public/widget"), name="widget")
except Exception as _e:
    # In some environments the folder may not exist; ignore at import time.
    pass

# ── Auth util ──────────────────────────────────────────────────────────
async def require_admin(x_api_key: str = Header(default="")):
    if not ADMIN_KEY or x_api_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

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

# ── DB helpers ─────────────────────────────────────────────────────────
def to_asyncpg(url: str) -> str:
    if not url:
        return ""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    p = urlparse(url)
    q = dict(parse_qsl(p.query, keep_blank_values=True))
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
    scheme = "postgresql+asyncpg"
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


ASYNC_DB_URL = to_asyncpg(DATABASE_URL)
db_engine: Optional[AsyncEngine] = None

@app.on_event("startup")
async def on_startup():
    global db_engine
    if not ASYNC_DB_URL:
        log.warning("DATABASE_URL no seteado: corriendo sin persistencia")
        return
    db_engine = create_async_engine(ASYNC_DB_URL, echo=False, pool_pre_ping=True)
    async with db_engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
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
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)"))
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
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_slug)"))
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
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_slug, type, created_at DESC)"))
    log.info("Postgres listo ✅")
    app.state.twilio = None
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        try:
            app.state.twilio = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            log.info("Twilio listo ✅")
        except Exception as e:
            log.warning(f"Twilio no inicializado: {e}")

async def store_event(tenant_slug: str, sid: str, etype: str, payload: dict | None = None):
    if not db_engine:
        return
    async with db_engine.begin() as conn:
        await conn.execute(
            text("""INSERT INTO events (tenant_slug, session_id, type, payload)
                    VALUES (:tenant, :sid, :type, CAST(:payload AS JSONB))"""),
            {"tenant": tenant_slug or "public", "sid": sid, "type": etype, "payload": json.dumps(payload or {})}
        )

def _twilio_req_is_valid(request: Request, auth_token: str) -> bool:
    if not TWILIO_VALIDATE_SIGNATURE:
        return True
    try:
        sig = request.headers.get("X-Twilio-Signature", "")
        url = str(request.url)
        return bool(sig)
    except Exception:
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

now_ms = lambda: int(time.time() * 1000)

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
              LIMIT 1
            """),
            {"x": str(page_or_ig_id)}
        )).first()
    return row[0] if row else ""

def fb_tokens_from_tenant(t: dict | None) -> tuple[str, str, str]:
    """Obtiene credenciales de Meta para el tenant exclusivamente desde DB.

    Producción: ya no se usa fallback por variables de entorno para tokens/IDs.
    """
    s = (t or {}).get("settings", {}) or {}
    page_id = s.get("fb_page_id", "")
    page_token = s.get("fb_page_token", "")
    ig_user_id = s.get("ig_user_id", "")
    return str(page_id or ""), str(page_token or ""), str(ig_user_id or "")

async def meta_send_text(page_token: str, recipient_id: str, text: str) -> dict:
    if not page_token:
        raise RuntimeError("Falta fb_page_token")
    url = "https://graph.facebook.com/v20.0/me/messages"
    payload = {
        "messaging_type": "RESPONSE",
        "recipient": {"id": recipient_id},
        "message": {"text": text}
    }
    async with httpx.AsyncClient(timeout=10.0) as cx:
        r = await cx.post(url, params={"access_token": page_token}, json=payload)
        if r.status_code >= 400:
            # 👇 NUEVO: logea el cuerpo de Graph para saber la causa exacta
            log.error(f"[META][SEND][{r.status_code}] {r.text}")
        r.raise_for_status()
        return r.json()


async def fb_reply_comment(page_token: str, comment_id: str, message: str) -> dict:
    if not (page_token and comment_id and message):
        raise RuntimeError("Faltan datos para reply FB")
    url = f"https://graph.facebook.com/v20.0/{comment_id}/comments"
    async with httpx.AsyncClient(timeout=10.0) as cx:
        r = await cx.post(url, params={"access_token": page_token}, data={"message": message})
        if r.status_code >= 400:
            log.error(f"[META][FEED] fb_reply_comment body: {r.text}")
            r.raise_for_status()
        return r.json()

async def ig_reply_comment(page_token: str, ig_comment_id: str, message: str) -> dict:
    if not (page_token and ig_comment_id and message):
        raise RuntimeError("Faltan datos para reply IG")
    url = f"https://graph.facebook.com/v20.0/{ig_comment_id}/replies"
    async with httpx.AsyncClient(timeout=10.0) as cx:
        r = await cx.post(url, params={"access_token": page_token}, data={"message": message})
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
        r = await cx.post(url, params={"access_token": page_token}, json=payload)
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
    s = (tenant or {}).get("settings", {}) or {}
    tone     = s.get("tone", "cálido y directo")
    policies = s.get("policies", "")
    hours    = s.get("opening_hours", "")
    products = s.get("products", "")
    prices   = s.get("prices", {})
    faq      = s.get("faq", [])
    brand    = (tenant or {}).get("name", "esta marca")

    extras = [f"Contexto de negocio: {brand}. Tono: {tone}."]
    if policies: extras.append(f"Políticas: {policies}.")
    if hours:    extras.append(f"Horarios: {hours}.")
    if products: extras.append(f"Oferta/servicios: {products}.")
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
    return (ZIA_SYSTEM_PROMPT + "\n" + " ".join(extras)).strip()

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
        for key in ("items", "products", "catalog", "data"):
            v = data.get(key)
            if isinstance(v, list):
                items = [x for x in v if isinstance(x, dict)]
                break

    # normalizar campos más comunes
    normd: list[dict] = []
    for it in items[:200]:
        name = str(it.get("name") or it.get("title") or it.get("Nombre") or "").strip()
        desc = str(it.get("description") or it.get("Descripcion") or it.get("Descripción") or "").strip()
        pid  = str(it.get("product_id") or it.get("stripe_product_id") or it.get("stripe_id") or it.get("id") or "").strip()
        prc  = str(it.get("price_id") or it.get("stripe_price_id") or it.get("default_price") or "").strip()
        meta = it.get("metadata") if isinstance(it.get("metadata"), dict) else {}
        normd.append({"name": name, "description": desc, "product_id": pid, "price_id": prc, "metadata": meta, "raw": it})

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
        session = stripe.checkout.Session.create(
            mode=mode,
            line_items=[{"price": price_id, "quantity": max(1, int(qty))}],
            success_url=f"{SITE_URL}/pago-exitoso?sid={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{SITE_URL}/pago-cancelado",
            metadata={"tenant": (t or {}).get("slug", "public"), "product_id": product_id or None},
            customer_creation="always",
            stripe_account=acct,
        )
    except Exception as e:
        log.error(f"Stripe checkout.Session.create error: {e}")
        raise HTTPException(502, "No se pudo crear la sesión de pago")
    return {"id": session.id, "url": session.url}

def build_messages_with_history(sid: str, system_prompt: str, max_pairs: int = 8) -> list[dict]:
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
    catalog_items = await fetch_catalog_for_tenant(t)
    catalog_summary = summarize_catalog_for_prompt(catalog_items)
    system_prompt = build_system_for_tenant(t)
    if catalog_summary:
        system_prompt = f"{system_prompt}\n\n{catalog_summary}"
    messages = build_messages_with_history(sid, system_prompt)
    answer = generate_answer(messages)
    add_message(sid, "assistant", answer)
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
    token = os.getenv("META_VERIFY_TOKEN", "")
    if hub_mode == "subscribe" and hub_verify_token == token:
        return Response(hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")

@app.post("/v1/meta/webhook")
async def meta_webhook_events(payload: Dict[str, Any] = Body(...)):
    try:
        obj = payload.get("object")
        if obj not in {"page", "instagram"}:
            log.info(f"[META] object no soportado: {obj}")
            return {"ok": True}

        for entry in payload.get("entry", []):
            owner_id = str(entry.get("id", ""))  # page_id o ig_user_id
            tenant_slug = await resolve_tenant_by_page_or_ig_id(owner_id) or "public"
            t = await fetch_tenant(tenant_slug)
            page_id, page_token, ig_user_id = fb_tokens_from_tenant(t)
            # Fallback: si no hay page_id en settings/env, usar owner_id
            if not page_id and owner_id:
                page_id = owner_id

            # Messenger / IG DMs (igual a como lo tenías)
            for m in entry.get("messaging", []):
                sender_id = str(m.get("sender", {}).get("id", ""))
                msg = m.get("message", {})
                text_in = (msg.get("text") or "").strip()
                if not (sender_id and text_in):
                    continue
                sid = ensure_session(f"fb:{tenant_slug}:{sender_id}")
                add_message(sid, "user", text_in)
                asyncio.create_task(store_event(tenant_slug, sid, f"{obj}_in", {"from": sender_id, "text": text_in}))

                system_prompt = build_system_for_tenant(t)
                messages = build_messages_with_history(sid, system_prompt)
                answer = "Gracias por escribir. Te atiendo enseguida."
                try:
                    client_rt = client.with_options(timeout=12.0)
                    resp = client_rt.chat.completions.create(model=OPENAI_MODEL, messages=messages)
                    answer = resp.choices[0].message.content or answer
                except Exception as e:
                    log.warning(f"meta fallback: {e}")

                add_message(sid, "assistant", answer)
                asyncio.create_task(store_event(tenant_slug, sid, f"{obj}_out", {"to": sender_id, "text": answer[:2000]}))
                # Enviar respuesta solo si tenemos token (desde DB)
                if not page_token:
                    log.warning("[META][DM] skip: falta page_token en settings.fb_page_token (DB)")
                else:
                    try:
                        await meta_send_text(page_token, sender_id, answer)
                    except Exception as e:
                        log.error(f"meta send error: {e}")

            # Feed / Comments
            for ch in entry.get("changes", []):
                field = ch.get("field")
                value = ch.get("value", {}) or {}
                log.info(f"[META][CHANGE] field={field} value={json.dumps(value)[:500]}")
                if field == "feed" and value.get("item") == "comment" and value.get("verb") == "add":
                    comment_id = str(value.get("comment_id", ""))
                    author_id  = str(value.get("from", {}).get("id", ""))
                    log.info(f"[META][FEED] comment_id={comment_id} author_id={author_id}")
                    ...



                # Facebook Page comments (feed)
                if obj == "page" and field == "feed" and value.get("item") == "comment" and value.get("verb") == "add":
                    comment_id = str(value.get("comment_id", ""))
                    author_id = str(value.get("from", {}).get("id", ""))
                    text_in = (value.get("message") or "").strip()
                    log.info(f"[META][FEED] comment_id={comment_id} author={author_id} text={text_in!r}")

                    if not comment_id:
                        log.warning("[META][FEED] skip: falta comment_id")
                        continue
                    if not page_token:
                        log.warning("[META][FEED] skip: falta page_token en settings.fb_page_token (DB)")
                        continue
                    if author_id and page_id and author_id == page_id:
                        log.info("[META][FEED] skip: comentario de la propia página (loop guard)")
                        continue

                    if META_DRY_RUN:
                        log.info(f"[META][FEED] DRY_RUN: no se llama Graph para {comment_id}")
                    else:
                        try:
                            await fb_reply_comment(page_token, comment_id,
                                "¡Gracias por tu comentario! Te mando más detalles por DM.")
                        except Exception as e:
                            log.error(f"[META][FEED] fb_reply_comment error: {e}")

                        try:
                            await meta_private_reply_to_comment(page_id, page_token, comment_id,
                                "Hola, seguimos por mensaje para darte soporte rápido. ¿Qué necesitas lograr?")
                        except Exception as e:
                            log.error(f"[META][FEED] private reply error: {e}")

                    sid = ensure_session(f"fb:{tenant_slug}:comment:{comment_id}")
                    asyncio.create_task(store_event(
                        tenant_slug, sid, "page_comment_in",
                        {"comment_id": comment_id, "author_id": author_id, "text": text_in}
                    ))

                # Instagram comments
                if obj == "instagram" and field == "comments":
                    ig_comment_id = str(value.get("id", "")) or str(value.get("comment_id", ""))
                    author_id = str(value.get("from", {}).get("id", ""))
                    text_in = (value.get("text") or "").strip()
                    log.info(f"[META][IG] comment_id={ig_comment_id} author={author_id} text={text_in!r}")

                    if not ig_comment_id:
                        log.warning("[META][IG] skip: falta ig_comment_id")
                        continue
                    if not page_token:
                        log.warning("[META][IG] skip: falta page_token en settings.fb_page_token (DB)")
                        continue

                    if META_DRY_RUN:
                        log.info(f"[META][IG] DRY_RUN: no se llama Graph para {ig_comment_id}")
                    else:
                        try:
                            await ig_reply_comment(page_token, ig_comment_id,
                                "¡Gracias por comentar! Te escribimos por DM para ayudarte.")
                        except Exception as e:
                            log.error(f"[META][IG] ig_reply_comment error: {e}")

                        try:
                            await meta_private_reply_to_comment(page_id, page_token, ig_comment_id,
                                "Hola, seguimos por mensaje para resolverlo contigo. ¿Puedes contarme un poco más?")
                        except Exception as e:
                            log.error(f"[META][IG] private reply error: {e}")

                    sid = ensure_session(f"ig:{tenant_slug}:comment:{ig_comment_id}")
                    asyncio.create_task(store_event(
                        tenant_slug, sid, "instagram_comment_in",
                        {"comment_id": ig_comment_id, "author_id": author_id, "text": text_in}
                    ))

        return {"ok": True}
    except Exception as e:
        log.error(f"/v1/meta/webhook error: {e}")
        return {"ok": False}

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
    asyncio.create_task(store_event(tenant or "public", sid, "msg_in", {"text": (input.message or "")[:2000]}))

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

            flow = get_flow(sid)

            if flow["stage"] is None and wants_quote(input.message):
                flow.update({"stage": "ask_name"})
                yield sse_event(json.dumps({"content": "Genial, te ayudo con la cotización. ¿Cuál es tu nombre completo?"}), event="delta")
                yield sse_event(json.dumps({}), event="done")
                return

            # Intento rápido: si el usuario quiere comprar y el catálogo tiene match, crear link de pago
            purchase_intent = any(k in text_lc for k in ["compr", "compra", "adquir", "pagar", "orden", "checkout", "suscrib"])
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
                    wa_num = clean_phone_for_wa((t or {}).get("whatsapp"))
                    yield sse_event(json.dumps({"content": base + " Para continuar, usa el botón de WhatsApp de aquí abajo para iniciar el chat."}), event="delta")
                    if wa_num:
                        wa_url = f"https://wa.me/{wa_num}?text=Hola%20soy%20{flow['name']}"
                        yield sse_event(json.dumps({"whatsapp": wa_url}), event="ui")
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

            if USE_MOCK:
                full = f"(mock) Recibí: {input.message}"
                for ch in full:
                    yield sse_event(json.dumps({"content": ch}), event="delta")
                    await asyncio.sleep(0)
                add_message(sid, "assistant", full)
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
                    return

            add_message(sid, "assistant", final_text)
            asyncio.create_task(store_event(tenant or "public", sid, "msg_out", {"text": final_text[:2000]}))
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
    if TWILIO_VALIDATE_SIGNATURE:
        validator = RequestValidator(TWILIO_AUTH_TOKEN)
        sig = request.headers.get("X-Twilio-Signature", "")
        params = {k: str(v) for k, v in form.items()}
        url = str(request.url)
        if not validator.validate(url, params, sig):
            raise HTTPException(403, "Invalid Twilio signature")

    from_raw = str(form.get("From", ""))
    body_txt = str(form.get("Body", "")).strip()
    if not from_raw or not body_txt:
        return Response("<Response></Response>", media_type="application/xml")

    phone = norm_phone(from_raw)
    sid_session = f"wa:{phone}"
    sid = ensure_session(sid_session)
    add_message(sid, "user", body_txt)
    asyncio.create_task(store_event(tenant or "public", sid, "wa_in", {"from": from_raw, "text": body_txt}))

    t = await fetch_tenant(tenant)
    system_prompt = build_system_for_tenant(t)
    messages = build_messages_with_history(sid, system_prompt)
    answer = generate_answer(messages)
    add_message(sid, "assistant", answer)
    asyncio.create_task(store_event(tenant or "public", sid, "wa_out", {"to": from_raw, "text": answer[:2000]}))

    twiml = MessagingResponse()
    twiml.message(answer)
    return Response(str(twiml), media_type="application/xml")

@app.get("/v1/catalog")
async def get_catalog(tenant: str = Query(...)):
    if tenant and not valid_slug(tenant):
        raise HTTPException(400, "Invalid tenant")
    t = await fetch_tenant(tenant)
    if not t:
        raise HTTPException(404, "Tenant no encontrado")
    items = await fetch_catalog_for_tenant(t)
    return {"count": len(items), "items": items[:200]}

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
    qty = int(body.get("quantity", 1))
    if plan not in {"starter", "meta"} or qty <= 0:
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
        customer_creation="always",
        stripe_account=acct,
    )
    return {"id": session.id, "url": session.url}

@app.post("/v1/stripe/webhook")
async def stripe_webhook(request: Request):
    raw = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(raw, sig, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
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
