import os, uuid, time, asyncio, json, logging
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Header, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from openai import OpenAI
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy import text
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

# ── Setup ──────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("zia")

app = FastAPI(title="ZIA Backend", version="1.0")
client = OpenAI()  # usa OPENAI_API_KEY del entorno

# ── Config ──────────────────────────────────────────────────────────────
def as_bool(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "y", "on")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
DATABASE_URL   = os.getenv("DATABASE_URL", "")
USE_MOCK       = as_bool(os.getenv("USE_MOCK"), True)
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
RATE_LIMIT     = int(os.getenv("RATE_LIMIT", "5"))
RATE_WINDOW_SECONDS = int(os.getenv("RATE_WINDOW_SECONDS", "10"))
PRICE_IN_PER_1K  = float(os.getenv("PRICE_IN_PER_1K", "0"))
PRICE_OUT_PER_1K = float(os.getenv("PRICE_OUT_PER_1K", "0"))
ADMIN_KEY      = os.getenv("ADMIN_KEY", "")
PROXY_IP_HEADER = os.getenv("PROXY_IP_HEADER", "").lower()

ZIA_SYSTEM_PROMPT = (
    "Eres el asistente de zIA (automatización con IA). "
    "Objetivo: resolver dudas frecuentes, sugerir soluciones y guiar al usuario a la siguiente acción. "
    "Tono: cálido y directo. Español por defecto; si el usuario cambia de idioma, adáptate. "
    "Políticas: no inventes precios ni promesas; si faltan datos, dilo y ofrece agendar demo o cotización. "
    "No pidas datos sensibles; para contacto, solo nombre y email o WhatsApp cuando el usuario acepte. "
    "Interpreta con base en los últimos 5 pasos de la conversación. "
    "Acciones (menciónalas cuando encajen): • Agendar demo • Cotizar proyecto • Automatizar WhatsApp/Meta • Hablar por WhatsApp."
    "Acciones (menciónalas cuando encajen): • Agendar demo • Cotizar proyecto • Automatizar WhatsApp/Meta • Hablar por WhatsApp."
    "\nReglas de contacto: No prometas que “nos pondremos en contacto”, “te llamamos” ni seguimiento proactivo. "
    "Aunque el usuario comparta su nombre o WhatsApp, pídele que INICIE el contacto: usa el botón/enlace de WhatsApp que ve abajo o propón agendar pidiendo 2–3 horarios. "
    "Si mencionas WhatsApp en el texto, di: “usa el botón de WhatsApp de aquí abajo”; evita pegar enlaces manuales o inventar números. "
    "Mantén respuestas en 3–5 líneas y siempre sugiere un siguiente paso claro."
)


# ── CORS ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],  # en prod cierra esta lista
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers generales ──────────────────────────────────────────────────
async def require_admin(x_api_key: str = Header(default="")):
    if not ADMIN_KEY or x_api_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

def get_client_ip(request: Request) -> str:
    if PROXY_IP_HEADER and PROXY_IP_HEADER in request.headers:
        return request.headers[PROXY_IP_HEADER].split(",")[0].strip()
    return request.client.host

def sse_event(data: str, event: str | None = None) -> str:
    if event:
        return f"event: {event}\ndata: {data}\n\n"
    return f"data: {data}\n\n"

RATELIMIT: dict[str, list[float]] = {}
def is_rate_limited(key: str, limit: int = RATE_LIMIT, window: int = RATE_WINDOW_SECONDS) -> bool:
    now = time.time()
    bucket = [ts for ts in RATELIMIT.get(key, []) if ts > now - window]
    if len(bucket) >= limit:
        RATELIMIT[key] = bucket
        return True
    bucket.append(now)
    RATELIMIT[key] = bucket
    return False

def rough_token_count(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)  # cálculo aproximado

# --- mete esto junto a tus helpers ---
def clean_phone_for_wa(phone: str | None) -> str | None:
    if not phone:
        return None
    # wa.me exige E.164 sin '+', solo dígitos.
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits or None


# ── DB ──────────────────────────────────────────────────────────────────
def to_asyncpg(url: str) -> str:
    if not url:
        return ""
    # normaliza esquema base
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    # por si acaso alguien puso ya +asyncpg
    url = url.replace("postgresql+asyncpg://", "postgresql://", 1)

    from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
    p = urlparse(url)
    q = dict(parse_qsl(p.query, keep_blank_values=True))

    # 1) si viene sslmode=..., pásalo a ssl=<valor válido para asyncpg>
    if "sslmode" in q:
        val = (q.pop("sslmode") or "").lower()
        if val in ("disable", "allow", "prefer", "require", "verify-ca", "verify-full"):
            q["ssl"] = val  # asyncpg acepta estos valores en 'ssl' (como string)
    # 2) si ya viene ssl, corrige valores booleanos a modos válidos
    if "ssl" in q:
        v = (q["ssl"] or "").lower()
        if v in ("true", "1", "yes"):
            q["ssl"] = "require"
        elif v in ("false", "0", "no"):
            q["ssl"] = "disable"
        # si ya es uno de los modos válidos, lo dejamos igual

    # 3) si no vino nada, default seguro en Render:
    if "ssl" not in q:
        q["ssl"] = "require"

    new_query = urlencode(q)
    scheme = "postgresql+asyncpg"
    return urlunparse((scheme, p.netloc, p.path, p.params, new_query, p.fragment))


ASYNC_DB_URL = to_asyncpg(DATABASE_URL)
db_engine: AsyncEngine | None = None

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
    log.info("Postgres listo ✅")

# ── Modelos ─────────────────────────────────────────────────────────────
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

# ── Sesiones ────────────────────────────────────────────────────────────
SESSIONS: dict[str, dict] = {}
MESSAGES: dict[str, list[dict]] = {}
USAGE: dict[str, dict] = {}

now_ms = lambda: int(time.time() * 1000)

def new_session_id() -> str:
    return f"sess_{uuid.uuid4().hex}"

def ensure_session(session_id: str | None) -> str:
    sid = session_id or new_session_id()
    if sid not in SESSIONS:
        SESSIONS[sid] = {"startedAt": now_ms(), "status": "active"}
        MESSAGES[sid] = []
    return sid

def add_message(sid: str, role: str, content: str):
    MESSAGES[sid].append({"role": role, "content": content, "ts": now_ms()})

# ── Prompt helpers ─────────────────────────────────────────────────────
async def fetch_tenant(slug: str) -> dict | None:
    if not db_engine or not slug:
        return None
    async with db_engine.connect() as conn:
        row = (await conn.execute(
            text("SELECT slug, name, whatsapp, settings FROM tenants WHERE slug=:slug"),
            {"slug": slug}
        )).first()
    return dict(row._mapping) if row else None

def build_system_for_tenant(tenant: dict | None) -> str:
    s = (tenant or {}).get("settings", {}) or {}
    tone     = s.get("tone", "cálido y directo")
    policies = s.get("policies", "")
    hours    = s.get("opening_hours", "")
    products = s.get("products", "")
    prices   = s.get("prices", {})       # dict opcional {"Paquete 1":"150 USD", ...}
    faq      = s.get("faq", [])          # puede ser lista de strings o de dicts {"q","a"}
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


def build_messages_with_history(sid: str, system_prompt: str, max_pairs: int = 8) -> list[dict]:
    convo = MESSAGES.get(sid, [])
    recent = convo[-2*max_pairs:]
    history = [{"role": m["role"], "content": m["content"]} for m in recent]
    return [{"role": "system", "content": system_prompt}] + history

def suggest_ui_for_text(user_text: str, tenant: dict | None) -> dict:
    """
    Devuelve chips y, si aplica, un link de WhatsApp.
    Regla: si el user menciona 'whatsapp' o 'contacto', mostramos burbuja
    y quitamos el chip duplicado.
    """
    text_ = (user_text or "").lower()

    # chips base por intención
    chips = []
    if any(w in text_ for w in ["reserva", "reservar", "booking"]):
        chips += ["Hacer reserva"]
    if any(w in text_ for w in ["precio", "tarifa", "cotiza", "costo"]):
        chips += ["Ver tarifas", "Solicitar cotización"]
    if not chips:
        chips = ["Hacer reserva", "Ver tarifas", "Contactar por WhatsApp"]

    # teléfono → wa.me
    def clean_phone_for_wa(phone: str | None) -> str | None:
        if not phone: return None
        d = "".join(ch for ch in phone if ch.isdigit())
        return d or None

    wa_num = clean_phone_for_wa((tenant or {}).get("whatsapp"))
    wa_link = f"https://wa.me/{wa_num}" if wa_num else None

    # ¿mostrar burbuja?
    show_bubble = any(w in text_ for w in ["whatsapp", "wasap", "contacto", "contact"])
    if show_bubble:
        # quita el chip duplicado
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
    if not db_engine:
        raise HTTPException(503, "Database not configured")
    async with db_engine.connect() as conn:
        t = (await conn.execute(
            text("SELECT id, slug, name, whatsapp, settings FROM tenants WHERE slug=:slug"),
            {"slug": tenant}
        )).first()
    if not t:
        raise HTTPException(404, f"Tenant '{tenant}' no encontrado")
    return {"tenant": dict(t._mapping), "ui": {"suggestions": ["Hacer reserva","Ver tarifas","Contactar por WhatsApp"]}}

# ── Chat no streaming ──────────────────────────────────────────────────
def generate_answer(messages: list[dict]) -> str:
    if USE_MOCK:
        last = next((m for m in reversed(messages) if m["role"] == "user"), {"content": ""})
        return f"(mock) Recibí: {last['content']}"
    resp = client.chat.completions.create(model=OPENAI_MODEL, messages=messages)
    return resp.choices[0].message.content

@app.post("/v1/chat", response_model=ChatOut)
async def chat(input: ChatIn, request: Request, tenant: str = Query(default="")):
    key = input.sessionId or get_client_ip(request)
    if is_rate_limited(key):
        raise HTTPException(status_code=429, detail="Too many requests")
    sid = ensure_session(input.sessionId)
    add_message(sid, "user", input.message)
    t = await fetch_tenant(tenant)
    system_prompt = build_system_for_tenant(t)
    messages = build_messages_with_history(sid, system_prompt)
    answer = generate_answer(messages)
    add_message(sid, "assistant", answer)
    return ChatOut(sessionId=sid, answer=answer)

# ── Streaming SSE ──────────────────────────────────────────────────────
@app.post("/v1/chat/stream")
async def chat_stream(input: ChatIn, request: Request, tenant: str = Query(default="")):
    key = input.sessionId or get_client_ip(request)
    if is_rate_limited(key):
        raise HTTPException(status_code=429, detail="Too many requests")
    sid = ensure_session(input.sessionId)
    add_message(sid, "user", input.message)
    t = await fetch_tenant(tenant)
    system_prompt = build_system_for_tenant(t)
    messages = build_messages_with_history(sid, system_prompt)

    async def event_generator():
        try:
            if USE_MOCK:
                full = f"(mock) Recibí: {input.message}"
                partial = ""
                for ch in full:
                    partial += ch
                    yield sse_event(json.dumps({"content": ch}), event="delta")
                    await asyncio.sleep(0.02)
                add_message(sid, "assistant", partial)
                yield sse_event(json.dumps({"done": True, "sessionId": sid}), event="done")
                return

            stream = client.chat.completions.create(model=OPENAI_MODEL, messages=messages, stream=True)
            final_text = ""
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
            ui = suggest_ui_for_text(input.message, t)
            yield sse_event(json.dumps(ui), event="ui")
            yield sse_event(json.dumps({"done": True, "sessionId": sid}), event="done")
        except Exception as e:
            log.error(f"SSE ERROR: {e}")
            yield sse_event(json.dumps({"error": str(e)}), event="error")

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control":"no-cache","Connection":"keep-alive","X-Accel-Buffering":"no"})
