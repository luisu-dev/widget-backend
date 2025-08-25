// app.js
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ------- API con tenant -------
  const RAW_API = window.CHAT_API || "https://widget-backend-zia.onrender.com/v1/chat/stream";
  const TENANT  = window.TENANT   || "demo";
  const API     = `${RAW_API}?tenant=${encodeURIComponent(TENANT)}`;
  const BOOTSTRAP = (RAW_API || "").replace(/\/v1\/chat\/stream$/, "") + `/v1/widget/bootstrap?tenant=${encodeURIComponent(TENANT)}`;

  // DOM
  const thread = document.getElementById("msgs");
  const chipsBox = document.getElementById("chips");
  const msg  = document.getElementById("msg");
  const sid  = document.getElementById("sid");
  const sendBtn = document.getElementById("send");
  const newBtn  = document.getElementById("new");
  const stopBtn = document.getElementById("stop");
  const panel   = document.getElementById("cw-panel");
  const launcher= document.getElementById("cw-launcher");
  const closeBtn= document.getElementById("cw-close");
  const minBtn  = document.getElementById("cw-min");

  // ------- sesión persistente -------
  (function persistSessionId() {
    try {
      const saved = localStorage.getItem("sid");
      if (saved && sid) sid.value = saved;
      else if (sid) {
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

  // ------- helpers UI -------
  const autoscroll = () => {
    const scroller = thread?.parentElement || thread;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  };
  const makeBubble = (role, html = "") => {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.innerHTML = html;       // usamos innerHTML para que se vean <a> linkify
    thread?.appendChild(el);
    autoscroll();
    return el;
  };
  const openPanel = () => {
  panel?.classList.add("open");
  // saludar si el thread está vacío
  if (thread && thread.childElementCount === 0) {
    greetOnce();
  }
};

  const closePanelFn = () => panel?.classList.remove("open");
  launcher?.addEventListener("click", openPanel);
  closeBtn?.addEventListener("click", closePanelFn);
  minBtn?.addEventListener("click", () => panel?.classList.toggle("open"));
  msg?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn?.click();
    }
  });

  // Convierte URLs en <a href="...">
  const linkify = (text) => {
    if (!text) return "";
    const urlRe = /(https?:\/\/[^\s<>"']+)/g;
    return text.replace(urlRe, (u) => {
      const safe = u.replace(/"/g, "&quot;");
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
    });
  };

  // ------- chips -------
  function renderChips(items = []) {
    if (!chipsBox) return;
    chipsBox.innerHTML = "";
    if (!items.length) return;
    items.forEach((label) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = label;
      b.onclick = () => {
        msg.value = label;
        sendBtn?.click();
      };
      chipsBox.appendChild(b);
    });
  }

  // Bootstrap inicial (sugerencias)
  (async function initBootstrap(){
    try {
      const res = await fetch(BOOTSTRAP);
      if (!res.ok) return;
      const data = await res.json();
      const suggestions = data?.ui?.suggestions || [];
      renderChips(suggestions);
    } catch {}
  })();

  // ------- Streaming SSE -------
  let currentController = null;
  let currentBotBubble = null;

  async function startStream() {
    if (!msg) return;
    if (currentController) currentController.abort();

    // burbuja usuario
    const userText = msg.value || "(vacío)";
    makeBubble("user", linkify(userText));
    msg.value = "";

    const body = {
      message: userText,
      sessionId: sid?.value || null,
    };

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
      makeBubble("bot", "[error] No se pudo conectar con el backend");
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
    currentBotBubble = makeBubble("bot", "");

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let evType = "message";
          let data = "";

          for (const line of rawEvent.split("\n")) {
            if (!line) continue;
            if (line.startsWith(":")) continue;
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
                  if (obj.i <= lastSeq) continue;
                  lastSeq = obj.i;
                }
                text = obj.content;
              }
            } catch {}
            if (currentBotBubble) {
              currentBotBubble.innerHTML += linkify(text);
              autoscroll();
            }
          } else if (evType === "ui") {
            try {
              const ui = JSON.parse(data);
              const chips = ui?.chips || [];
              renderChips(chips);
            } catch {}
          } else if (evType === "done") {
            currentBotBubble = null; // no mostramos [done]
          } else if (evType === "error") {
            makeBubble("bot", `[error] ${data}`);
            console.error("SSE error event:", data);
          }
        }
      }
    } catch (err) {
      if (String(err?.name) === "AbortError") {
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
  function greetOnce() {
  const session = sid?.value || "anon";
  const flagKey = `welcomed:${session}`;
  if (localStorage.getItem(flagKey)) return;   // ya saludamos

  const brand = (window.TENANT_NAME || "zIA");
  const text  = `Hola — soy ${brand}, tu asistente con IA. Puedo resolver dudas, cotizar y coordinar por WhatsApp. ¿Qué necesitas hoy?`;
  makeBubble("bot", text);

  localStorage.setItem(flagKey, "1");
}

  document.getElementById("send")?.addEventListener("click", startStream);
});
