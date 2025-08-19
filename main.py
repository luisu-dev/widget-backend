from fastapi import FastAPI, HTTPException, Request
from dotenv import load_dotenv
from pydantic import BaseModel
import os, uuid, time, asyncio
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse, JSONResponse
import json
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy import text


load_dotenv()

# ── Config ───────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")
DATABASE_URL = os.getenv("DATABASE_URL", "")
USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
RATE_LIMIT = int(os.getenv("RATE_LIMIT", "5"))
RATE_WINDOW_SECONDS = int(os.getenv("RATE_WINDOW_SECONDS", "10"))
PRICE_IN_PER_1K = float(os.getenv("PRICE_IN_PER_1K", "0"))
PRICE_OUT_PER_1K = float(os.getenv("PRICE_OUT_PER_1K", "0"))


client = OpenAI()  # usa OPENAI_API_KEY del entorno
app = FastAPI()

# ── Helpers ─────────────────────────────────────────────────────────────────
def sse_event(data: str, event: str | None = None) -> str:
    """
    Formatea un mensaje SSE:
      - data-only:    "data: {...}\n\n"
      - con evento:   "event: delta\ndata: {...}\n\n"
    """
    if event:
        return f"event: {event}\ndata: {data}\n\n"
    return f"data: {data}\n\n"

RATELIMIT: dict[str, list[float]] = {}
def to_asyncpg(url: str) -> str:
    if not url:
        return ""
    # Render puede darte postgres:// o postgresql://
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url  # ya está con +asyncpg

ASYNC_DB_URL = to_asyncpg(DATABASE_URL)
db_engine: AsyncEngine | None = None


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

# Medidor simple en memoria
USAGE: dict[str, dict] = {}

def rough_token_count(text: str) -> int:
    # Aproximación rápida (~4 chars ≈ 1 token)
    if not text:
        return 0
    return max(1, len(text) // 4)

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
            {
                "ts": int(time.time()),
                "sid": session_id,
                "model": model,
                "pt": int(prompt_tks),
                "ct": int(completion_tks),
            }
        )



# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.on_event("startup")
async def on_startup():
    global db_engine
    if not ASYNC_DB_URL:
        print("[USAGE] DATABASE_URL no seteado: corriendo sin persistencia")
        return
    db_engine = create_async_engine(ASYNC_DB_URL, echo=False, pool_pre_ping=True)
    async with db_engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS usage_events (
                id SERIAL PRIMARY KEY,
                ts BIGINT NOT NULL,
                session_id TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL,
                completion_tokens INTEGER NOT NULL
            );
        """))
    print("[USAGE] Postgres listo ✅")


@app.get("/v1/sessions/{sid}/messages")
async def get_messages(sid: str):
    if sid not in SESSIONS:
        raise HTTPException(status_code=404, detail="session not found")
    return {"sessionId": sid, "messages": MESSAGES.get(sid, [])}

@app.get("/v1/usage/{sid}")
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


# ── Modelos IO ────────────────────────────────────────────────────────────────
class ChatIn(BaseModel):
    message: str
    sessionId: str | None = None

class ChatOut(BaseModel):
    sessionId: str
    answer: str



# ── Lógica de respuesta simple (no streaming) ────────────────────────────────
def generate_answer(messages: list[dict]) -> str:
    if USE_MOCK:
        last = next((m for m in reversed(messages) if m["role"] == "user"), {"content": ""})
        return f"(mock) Recibí: {last['content']}"
    # modo real
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=messages,
    )
    return resp.choices[0].message.content

@app.post("/v1/chat", response_model=ChatOut)
async def chat(input: ChatIn, request: Request):
    key = input.sessionId or request.client.host
    if is_rate_limited(key):
        raise HTTPException(
            status_code=429,
            detail="Too many requests",
            headers={"Retry-After": str(RATE_WINDOW_SECONDS)},
        )

    sid = ensure_session(input.sessionId)
    add_message(sid, "user", input.message)

    messages = [
        {"role": "system", "content": "Eres un asistente breve y útil. Responde en español."},
        {"role": "user", "content": input.message},
    ]
    answer = generate_answer(messages)
    prompt_text = "\n".join(m["content"] for m in messages)
    prompt_tks = rough_token_count(prompt_text)
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
        raise HTTPException(
            status_code=429,
            detail="Too many requests",
            headers={"Retry-After": str(RATE_WINDOW_SECONDS)},
        )

    sid = ensure_session(input.sessionId)
    add_message(sid, "user", input.message)

    messages = [
        {"role": "system", "content": "Eres un asistente breve y útil. Responde en español."},
        {"role": "user", "content": input.message},
    ]

    async def event_generator():
        try:
            # --- MOCK ---
            if USE_MOCK:
                full = f"(mock) Recibí: {input.message}"
                partial = ""

                # tokens (prompt una vez; completion acumulado)
                prompt_text = "\n".join(m["content"] for m in messages)
                prompt_tks = rough_token_count(prompt_text)
                completion_tks = 0

                for ch in full:
                    partial += ch
                    completion_tks += rough_token_count(ch)
                    yield sse_event(ch, event="delta")
                    await asyncio.sleep(0.02)

                add_message(sid, "assistant", partial)
                update_usage(sid, OPENAI_MODEL, prompt_tks, completion_tks)
                yield sse_event(f'{{"done": true, "sessionId": "{sid}"}}', event="done")
                return

            # --- REAL STREAM ---
            # tokens (prompt una vez; completion acumulado)
            # --- REAL STREAM ---
            # tokens (prompt una vez; completion acumulado)
            prompt_text = "\n".join(m["content"] for m in messages)
            prompt_tks = rough_token_count(prompt_text)
            completion_tks = 0

            stream = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                stream=True,
            )

            final_text = ""
            i = 0  # <- secuencia para deduplicar en el front

            for chunk in stream:
                piece = getattr(chunk.choices[0].delta, "content", None)
                if piece:
                    final_text += piece
                    completion_tks += rough_token_count(piece)
                    i += 1
                    # ENVÍA JSON con número de secuencia
                    yield sse_event(json.dumps({"i": i, "content": piece}), event="delta")
                    await asyncio.sleep(0)  # flush

                # Si el cliente cerró, corta y guarda lo acumulado
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
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
