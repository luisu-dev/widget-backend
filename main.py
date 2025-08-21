import os, uuid, time, asyncio, json
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse, JSONResponse
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from pydantic import BaseModel
from openai import OpenAI

from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy import text

load_dotenv()

# ── App & Clients ────────────────────────────────────────────────────────────
app = FastAPI()
client = OpenAI()  # usa OPENAI_API_KEY del entorno

# ── Config ───────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
DATABASE_URL = os.getenv("DATABASE_URL", "")
USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
RATE_LIMIT = int(os.getenv("RATE_LIMIT", "5"))
RATE_WINDOW_SECONDS = int(os.getenv("RATE_WINDOW_SECONDS", "10"))
PRICE_IN_PER_1K = float(os.getenv("PRICE_IN_PER_1K", "0"))
PRICE_OUT_PER_1K = float(os.getenv("PRICE_OUT_PER_1K", "0"))
ADMIN_KEY = os.getenv("ADMIN_KEY", "")
ZIA_SYSTEM_PROMPT = (
    "Eres el asistente de zIA (automatización con IA). "
    "Objetivo: resolver dudas frecuentes, sugerir soluciones y guiar al usuario a la siguiente acción. "
    "Tono: cálido y directo. Español por defecto; si el usuario cambia de idioma, adáptate. "
    "Políticas: no inventes precios ni promesas; si faltan datos, dilo y ofrece agendar demo o cotización. "
    "No pidas datos sensibles; para contacto, solo nombre y email o WhatsApp cuando el usuario acepte. "
    "Acciones disponibles (menciónalas cuando encajen): "
    "• Agendar demo (pide 2–3 franjas horarias y contacto). "
    "• Cotizar proyecto (pide objetivo, canal: web/whatsapp/ig, volumen aproximado y deadline). "
    "• Automatizar WhatsApp/Meta (explica requisitos y pasos). "
    "• Hablar por WhatsApp (ofrece un link). "
    "Si preguntan por precios, di que dependen del alcance y ofrece cotizar. "
    "Responde en 3–5 líneas máximo y sugiere el siguiente paso de forma clara."
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ─────────────────────────────────────────────────────────────────
async def require_admin(x_api_key: str = Header(default="")):
    if not ADMIN_KEY or x_api_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

def sse_event(data: str, event: str | None = None) -> str:
    if event:
        return f"event: {event}\ndata: {data}\n\n"
    return f"data: {data}\n\n"

RATELIMIT: dict[str, list[float]] = {}
def is_rate_limited(key: str, limit: int = RATE_LIMIT, window: int = RATE_WINDOW_SECONDS) -> bool:
    now = time.time()
    bucket = RATELIMIT.get(key, [])
    bucket = [ts for ts in bucket if ts > now - window]
    if len(bucket) >= limit:
        RATELIMIT[key] = bucket
        return True
    bucket.append(now)
    RATELIMIT[key] = bucket
    return False

def to_asyncpg(url: str) -> str:
    if not url:
        return ""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url

ASYNC_DB_URL = to_asyncpg(DATABASE_URL)
db_engine: AsyncEngine | None = None

# ── Startup: crea tablas/índices ─────────────────────────────────────────────
class TenantIn(BaseModel):
    slug: str
    name: str
    whatsapp: Optional[str] = None
    settings: Dict[str, Any] = {}

@app.on_event("startup")
async def on_startup():
    global db_engine
    if not ASYNC_DB_URL:
        print("[USAGE] DATABASE_URL no seteado: corriendo sin persistencia")
        return

    db_engine = create_async_engine(ASYNC_DB_URL, echo=False, pool_pre_ping=True)
    async with db_engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

        # Eventos de uso (tokens por “vueltas”/respuestas)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usage_events (
                id SERIAL PRIMARY KEY,
                ts BIGINT NOT NULL,              -- epoch seconds
                session_id TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL,
                completion_tokens INTEGER NOT NULL
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_events(session_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_events(ts)"))

        # CRM básico: customers y metadatos de sesión
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name  TEXT,
                email TEXT UNIQUE,
                phone TEXT UNIQUE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sessions_metadata (
                session_id TEXT PRIMARY KEY,
                customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
                channel TEXT,                          -- web, whatsapp, ig, etc.
                tags JSONB DEFAULT '[]'::jsonb,        -- ← AQUÍ estaba el bug: faltaba el nombre de columna
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tenants (
                id SERIAL PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                whatsapp TEXT,                       -- número tipo +52...
                settings JSONB DEFAULT '{}'::jsonb,  -- tono, políticas, etc.
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)"))

        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions_metadata(customer_id)"))

    print("[USAGE] Postgres listo ✅")

# ── Medidor simple en memoria + persistencia ─────────────────────────────────
USAGE: dict[str, dict] = {}

def rough_token_count(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)  # aprox

def update_usage(session_id: str, model: str, prompt_tks: int, completion_tks: int):
    u = USAGE.get(session_id) or {"model": model, "prompt_tokens": 0, "completion_tokens": 0}
    u["model"] = model
    u["prompt_tokens"] += int(prompt_tks)
    u["completion_tokens"] += int(completion_tks)
    USAGE[session_id] = u

async def persist_usage_async(session_id: str, model: str, prompt_tks: int, completion_tks: int):
    if not db_engine:
        return
    async with db_engine.begin() as conn:
        await conn.execute(
            text("""INSERT INTO usage_events
                    (ts, session_id, model, prompt_tokens, completion_tokens)
                    VALUES (:ts, :sid, :model, :pt, :ct)"""),
            {"ts": int(time.time()), "sid": session_id, "model": model, "pt": int(prompt_tks), "ct": int(completion_tks)}
        )

# ── Sesiones en memoria ──────────────────────────────────────────────────────
SESSIONS: dict[str, dict] = {}
MESSAGES: dict[str, list[dict]] = {}
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

# ── Rutas utilitarias ────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"ok": True, "mode": "mock" if USE_MOCK else "real"}

@app.get("/v1/sessions/{sid}/messages")
async def get_messages(sid: str):
    if sid not in SESSIONS:
        raise HTTPException(status_code=404, detail="session not found")
    return {"sessionId": sid, "messages": MESSAGES.get(sid, [])}

@app.get("/v1/usage/{sid}", dependencies=[Depends(require_admin)])
async def usage_session(sid: str):
    if db_engine:
        async with db_engine.connect() as conn:
            row = (await conn.execute(
                text("""SELECT
                           COALESCE(SUM(prompt_tokens),0) AS pt,
                           COALESCE(SUM(completion_tokens),0) AS ct,
                           MAX(model) AS model
                        FROM usage_events
                        WHERE session_id = :sid"""),
                {"sid": sid}
            )).first()
        prompt_sum = int(row.pt) if row and row.pt is not None else 0
        completion_sum = int(row.ct) if row and row.ct is not None else 0
        model = row.model if row and row.model else (USAGE.get(sid, {}).get("model"))
    else:
        data = USAGE.get(sid, {"model": None, "prompt_tokens": 0, "completion_tokens": 0})
        prompt_sum = int(data.get("prompt_tokens", 0))
        completion_sum = int(data.get("completion_tokens", 0))
        model = data.get("model")

    cost_usd = (prompt_sum/1000)*PRICE_IN_PER_1K + (completion_sum/1000)*PRICE_OUT_PER_1K
    return {
        "sessionId": sid,
        "model": model,
        "prompt_tokens": prompt_sum,
        "completion_tokens": completion_sum,
        "total_tokens": prompt_sum + completion_sum,
        "estimated_cost_usd": round(cost_usd, 6),
    }

@app.get("/v1/usage", dependencies=[Depends(require_admin)])
async def list_usage(limit: int = 50, offset: int = 0):
    if db_engine:
        async with db_engine.connect() as conn:
            res = await conn.execute(
                text("""
                    SELECT
                        session_id,
                        MAX(model)                          AS model,
                        COALESCE(SUM(prompt_tokens), 0)     AS pt,
                        COALESCE(SUM(completion_tokens), 0) AS ct,
                        MIN(ts)                             AS first_ts,
                        MAX(ts)                             AS last_ts
                    FROM usage_events
                    GROUP BY session_id
                    ORDER BY last_ts DESC
                    LIMIT :limit OFFSET :offset
                """),
                {"limit": limit, "offset": offset},
            )
            rows = res.fetchall()

        items = []
        for r in rows:
            pt = int(r.pt or 0); ct = int(r.ct or 0)
            cost = (pt/1000)*PRICE_IN_PER_1K + (ct/1000)*PRICE_OUT_PER_1K
            items.append({
                "sessionId": r.session_id,
                "model": r.model,
                "prompt_tokens": pt,
                "completion_tokens": ct,
                "total_tokens": pt + ct,
                "estimated_cost_usd": round(cost, 6),
                "first_ts": int(r.first_ts or 0),
                "last_ts": int(r.last_ts or 0),
            })
        return {"items": items, "limit": limit, "offset": offset}

    # Fallback en memoria (dev)
    items = []
    for sid, u in USAGE.items():
        pt = int(u.get("prompt_tokens", 0)); ct = int(u.get("completion_tokens", 0))
        cost = (pt/1000)*PRICE_IN_PER_1K + (ct/1000)*PRICE_OUT_PER_1K
        first_ts = SESSIONS.get(sid, {}).get("startedAt")
        last_ts = max((m["ts"] for m in MESSAGES.get(sid, [])), default=first_ts)
        items.append({
            "sessionId": sid,
            "model": u.get("model"),
            "prompt_tokens": pt,
            "completion_tokens": ct,
            "total_tokens": pt + ct,
            "estimated_cost_usd": round(cost, 6),
            "first_ts": first_ts,
            "last_ts": last_ts,
        })
    items.sort(key=lambda x: x["last_ts"] or 0, reverse=True)
    return {"items": items, "limit": limit, "offset": offset}

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
            {
                "slug": body.slug,
                "name": body.name,
                "whatsapp": body.whatsapp,
                "settings": json.dumps(body.settings),
            }
        )).first()
    return dict(row._mapping)

@app.get("/v1/widget/bootstrap")
async def widget_bootstrap(tenant: str):
    """
    Devuelve config mínima para el front:
    - nombre, whatsapp del negocio
    - sugerencias iniciales (chips)
    """
    if not db_engine:
        raise HTTPException(503, "Database not configured")

    async with db_engine.connect() as conn:
        t = (await conn.execute(
            text("SELECT id, slug, name, whatsapp, settings FROM tenants WHERE slug=:slug"),
            {"slug": tenant}
        )).first()

    if not t:
        raise HTTPException(404, f"Tenant '{tenant}' no encontrado")

    # Sugerencias estáticas por ahora (luego las haremos dinámicas)
    suggestions = ["Hacer reserva", "Ver tarifas", "Contactar por WhatsApp"]

    return {
        "tenant": {
            "id": t.id,
            "slug": t.slug,
            "name": t.name,
            "whatsapp": t.whatsapp,
            "settings": t.settings,
        },
        "ui": {
            "suggestions": suggestions
        }
    }


# ── Modelos IO ────────────────────────────────────────────────────────────────
class ChatIn(BaseModel):
    message: str
    sessionId: str | None = None

class ChatOut(BaseModel):
    sessionId: str
    answer: str



# ── Lógica no streaming ──────────────────────────────────────────────────────
def generate_answer(messages: list[dict]) -> str:
    if USE_MOCK:
        last = next((m for m in reversed(messages) if m["role"] == "user"), {"content": ""})
        return f"(mock) Recibí: {last['content']}"
    resp = client.chat.completions.create(model=OPENAI_MODEL, messages=messages)
    return resp.choices[0].message.content

@app.post("/v1/chat", response_model=ChatOut)
async def chat(input: ChatIn, request: Request):
    key = input.sessionId or request.client.host
    if is_rate_limited(key):
        raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": str(RATE_WINDOW_SECONDS)})
    sid = ensure_session(input.sessionId)
    add_message(sid, "user", input.message)

    messages = [
    {"role": "system", "content": ZIA_SYSTEM_PROMPT},
    {"role": "user", "content": input.message},
    ]
    answer = generate_answer(messages)
    prompt_tks = rough_token_count("\n".join(m["content"] for m in messages))
    completion_tks = rough_token_count(answer)
    update_usage(sid, OPENAI_MODEL, prompt_tks, completion_tks)
    await persist_usage_async(sid, OPENAI_MODEL, prompt_tks, completion_tks)

    add_message(sid, "assistant", answer)
    return ChatOut(sessionId=sid, answer=answer)

# ── Streaming SSE ─────────────────────────────────────────────────────────────
@app.post("/v1/chat/stream")
async def chat_stream(input: ChatIn, request: Request):
    key = input.sessionId or request.client.host
    if is_rate_limited(key):
        raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": str(RATE_WINDOW_SECONDS)})

    sid = ensure_session(input.sessionId)
    add_message(sid, "user", input.message)

    messages = [
    {"role": "system", "content": ZIA_SYSTEM_PROMPT},
    {"role": "user", "content": input.message},
    ]

    async def event_generator():
        try:
            if USE_MOCK:
                full = f"(mock) Recibí: {input.message}"
                partial = ""
                prompt_tks = rough_token_count("\n".join(m["content"] for m in messages))
                completion_tks = 0
                for ch in full:
                    partial += ch
                    completion_tks += rough_token_count(ch)
                    yield sse_event(ch, event="delta")
                    await asyncio.sleep(0.02)
                add_message(sid, "assistant", partial)
                update_usage(sid, OPENAI_MODEL, prompt_tks, completion_tks)
                await persist_usage_async(sid, OPENAI_MODEL, prompt_tks, completion_tks)
                yield sse_event(f'{{"done": true, "sessionId": "{sid}"}}', event="done")
                return

            prompt_tks = rough_token_count("\n".join(m["content"] for m in messages))
            completion_tks = 0
            stream = client.chat.completions.create(model=OPENAI_MODEL, messages=messages, stream=True)
            final_text = ""
            i = 0
            for chunk in stream:
                piece = getattr(chunk.choices[0].delta, "content", None)
                if piece:
                    final_text += piece
                    completion_tks += rough_token_count(piece)
                    i += 1
                    yield sse_event(json.dumps({"i": i, "content": piece}), event="delta")
                    await asyncio.sleep(0)
                if await request.is_disconnected():
                    add_message(sid, "assistant", final_text)
                    update_usage(sid, OPENAI_MODEL, prompt_tks, completion_tks)
                    await persist_usage_async(sid, OPENAI_MODEL, prompt_tks, completion_tks)
                    print(f"[SSE] client disconnected (sid={sid})")
                    return

            add_message(sid, "assistant", final_text or "")
            update_usage(sid, OPENAI_MODEL, prompt_tks, completion_tks)
            await persist_usage_async(sid, OPENAI_MODEL, prompt_tks, completion_tks)
            yield sse_event(f'{{"done": true, "sessionId": "{sid}"}}', event="done")

        except Exception as e:
            print("SSE ERROR:", repr(e))
            err = str(e).replace("\n", " ")
            yield sse_event(f'{{"error":"{err}"}}', event="error")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
