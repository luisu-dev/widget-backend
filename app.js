// app.js
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const API = window.CHAT_API || "https://widget-backend-zia.onrender.com/v1/chat/stream";

  // DOM
  const thread = document.getElementById("msgs");   // <<< nuevo contenedor
  const msg = document.getElementById("msg");
  const sid = document.getElementById("sid");
  const sendBtn = document.getElementById("send");
  const newBtn = document.getElementById("new");
  const stopBtn = document.getElementById("stop");

  const panel = document.getElementById("cw-panel");
  const launcher = document.getElementById("cw-launcher");
  const closeBtn = document.getElementById("cw-close");
  const minBtn = document.getElementById("cw-min");

  // sessionId persistente
  (function persistSessionId() {
    try {
      const saved = localStorage.getItem("sid");
      if (saved && sid) {
        sid.value = saved;
      } else if (sid) {
        sid.value = "sess_" + Math.random().toString(16).slice(2);
        localStorage.setItem("sid", sid.value);
      }
    } catch {}
  })();

  newBtn?.addEventListener("click", () => {
    if (!sid) return;
    sid.value = "sess_" + Math.random().toString(16).slice(2);
    try { localStorage.setItem("sid", sid.value); } catch {}
  });

  // ===== helpers UI =====
  const autoscroll = () => {
    const scroller = thread?.parentElement || thread;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  };

  const makeBubble = (role, text = "") => {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.textContent = text;
    thread?.appendChild(el);
    autoscroll();
    return el;
  };

  // toggle widget
  const openPanel = () => panel?.classList.add("open");
  const closePanelFn = () => panel?.classList.remove("open");
  launcher?.addEventListener("click", openPanel);
  closeBtn?.addEventListener("click", closePanelFn);
  minBtn?.addEventListener("click", () => panel?.classList.toggle("open"));

  // enter-to-send
  msg?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn?.click();
    }
  });

  // ===== Streaming SSE =====
  let currentController = null;
  let currentBotBubble = null; // la burbuja que vamos rellenando con deltas

  async function startStream() {
    if (!msg) return;

    // cancela stream previo si existía
    if (currentController) currentController.abort();

    // pinta mi mensaje como burbuja de usuario y limpia textarea
    const userText = msg.value || "(vacío)";
    makeBubble("user", userText);
    msg.value = "";

    const body = {
      message: userText,
      sessionId: sid?.value || null,
    };

    // nuevo controller por request
    currentController = new AbortSignalController();
    // fallback para navegadores que no tienen AbortSignalController
    function AbortSignalController(){
      const ctrl = new AbortController();
      ctrl.on = (fn) => { stopBtn && (stopBtn.onclick = () => ctrl.abort()); };
      return ctrl;
    }
    currentController = new AbortController();
    stopBtn && (stopBtn.onclick = () => currentController?.abort());

    let res;
    try {
      res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: currentController.signal,
      });
    } catch (err) {
      const el = makeBubble("bot", "[error] No se pudo conectar con el backend");
      el.style.opacity = ".85";
      console.error("Fetch failed:", err);
      currentController = null;
      return;
    }

    if (!res.ok) {
      const retry = res.headers.get("Retry-After");
      const text = await res.text().catch(() => "");
      const msgErr =
        `Error ${res.status} ${res.statusText}` +
        (retry ? ` — Retry-After: ${retry}s` : "") +
        (text ? `\n${text}` : "");
      makeBubble("bot", msgErr);
      currentController = null;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastSeq = 0;

    // crea la burbuja del bot vacía y ve rellenándola
    currentBotBubble = makeBubble("bot", "");

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) buffer += decoder.decode(value, { stream: true });

        // Normaliza CRLF -> LF
        buffer = buffer.replace(/\r\n/g, "\n");

        // Procesa eventos separados por doble salto de línea
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let evType = "message";
          let data = "";

          for (const line of rawEvent.split("\n")) {
            if (!line) continue;
            if (line.startsWith(":")) continue; // comentario SSE
            if (line.startsWith("event:")) { evType = line.slice(6).trim(); continue; }
            if (line.startsWith("data:")) {
              let chunk = line.slice(5);
              if (chunk.startsWith(" ")) chunk = chunk.slice(1);
              data += (data ? "\n" : "") + chunk;
            }
          }

          if (evType === "delta") {
            let text = data;
            try {
              const obj = JSON.parse(data);
              if (obj && typeof obj.content === "string") {
                if (typeof obj.i === "number") {
                  if (obj.i <= lastSeq) continue; // dedup
                  lastSeq = obj.i;
                }
                text = obj.content;
              }
            } catch {}

            // agrega al contenido de la burbuja del bot
            if (currentBotBubble) {
              currentBotBubble.textContent += text;
              autoscroll();
            }

          } else if (evType === "done") {
            // no mostramos nada (adiós [done])
            currentBotBubble = null;

          } else if (evType === "error") {
            makeBubble("bot", `[error] ${data}`);
            console.error("SSE error event:", data);

          } else if (evType === "ui") {
            // futuro: chips/botones dinámicos
            // const ui = JSON.parse(data);
            // renderChips(ui);
          } else {
            // eventos desconocidos
          }
        }
      }
    } catch (err) {
      if (String(err?.name) === "AbortError") {
        // usuario detuvo
        const el = makeBubble("bot", "[cancelado]");
        el.style.opacity = ".85";
      } else {
        makeBubble("bot", `[stream-error] ${String(err)}`);
        console.error("Stream read failed:", err);
      }
    } finally {
      currentController = null;
      currentBotBubble = null;
    }
  }

  sendBtn?.addEventListener("click", startStream);
});
