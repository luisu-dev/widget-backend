// app.js
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ------- API con tenant -------
  const RAW_API = window.CHAT_API || "https://widget-backend-zia.onrender.com/v1/chat/stream";
  const TENANT  = window.TENANT   || "demo";
  const API     = `${RAW_API}?tenant=${encodeURIComponent(TENANT)}`;
  const BOOTSTRAP = (RAW_API || "").replace(/\/v1\/chat\/stream$/, "") + `/v1/widget/bootstrap?tenant=${encodeURIComponent(TENANT)}`;

  // ------- DOM -------
  const thread   = document.getElementById("msgs");
  const chipsBox = document.getElementById("chips");
  const msg      = document.getElementById("msg");
  const sid      = document.getElementById("sid");
  const sendBtn  = document.getElementById("send");
  const newBtn   = document.getElementById("new");
  const stopBtn  = document.getElementById("stop");
  const panel    = document.getElementById("cw-panel");
  const launcher = document.getElementById("cw-launcher");
  const closeBtn = document.getElementById("cw-close");
  const minBtn   = document.getElementById("cw-min");

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
    el.innerHTML = html;
    thread?.appendChild(el);
    autoscroll();
    return el;
  };
  const closePanelFn = () => panel?.classList.remove("open");

  // saludo: usa nombre real del tenant si está disponible
  let BRAND_NAME = window.TENANT_NAME || null;
  function greetOnce() {
    const session = sid?.value || "anon";
    const flagKey = `welcomed:${TENANT}:${session}`;
    if (localStorage.getItem(flagKey)) return;
    const brand = BRAND_NAME || window.TENANT_NAME || "zIA";
    const text  = `Hola — soy ${brand}, tu asistente con IA. Puedo resolver dudas, cotizar y coordinar por WhatsApp. ¿Qué necesitas hoy?`;
    makeBubble("bot", text);
    localStorage.setItem(flagKey, "1");
  }

  const openPanel = () => {
    panel?.classList.add("open");
    if (thread && thread.childElementCount === 0) greetOnce();
  };

  launcher?.addEventListener("click", openPanel);
  closeBtn?.addEventListener("click", closePanelFn);
  minBtn?.addEventListener("click", () => panel?.classList.toggle("open"));
  msg?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn?.click();
    }
  });

  // --- typing indicator ---
  let typingEl = null;
  let typingTimer = null;
  function showTyping() {
    if (typingEl) return;
    typingEl = makeBubble("bot", "...");
    typingEl.style.opacity = "0.6";
    typingEl.classList.add("typing");
    let dots = 1;
    typingTimer = setInterval(() => {
      dots = (dots % 3) + 1;
      if (typingEl) typingEl.textContent = ".".repeat(dots);
    }, 350);
  }
  function hideTyping() {
    if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

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

  // ------- Bootstrap inicial (nombre del tenant + sugerencias) -------
  (async function initBootstrap(){
    try {
      const res = await fetch(BOOTSTRAP);
      if (!res.ok) return;
      const data = await res.json();
      BRAND_NAME = data?.tenant?.name || BRAND_NAME;
      const suggestions = data?.ui?.suggestions || [];
      renderChips(suggestions);
    } catch {}
    const suggestions = data?.ui?.suggestions || [];
    renderChips(suggestions);

  })();

  // ------- Streaming SSE -------
  let currentController = null;
  let currentBotBubble = null;
  let lastShownWhatsApp = "";

  async function startStream() {
    if (!msg) return;
    if (currentController) currentController.abort();

    const userText = msg.value || "(vacío)";
    makeBubble("user", linkify(userText));
    msg.value = "";

    const body = { message: userText, sessionId: sid?.value || null };

    currentController = new AbortController();
    stopBtn && (stopBtn.onclick = () => currentController?.abort());

    let res;
    try {
      showTyping();
      res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: currentController.signal,
      });
    } catch (err) {
      hideTyping();
      makeBubble("bot", "[error] No se pudo conectar con el backend");
      console.error("Fetch failed:", err);
      currentController = null;
      return;
    }

    if (!res.ok) {
      hideTyping();
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
    currentBotBubble = null;

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
            if (!currentBotBubble) {
              hideTyping();
              currentBotBubble = makeBubble("bot", "");
            }
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
            currentBotBubble.innerHTML += linkify(text);
            autoscroll();

          } else if (evType === "ui") {
            try {
            const ui = JSON.parse(data);

    // A) Burbuja de WhatsApp (una sola vez por valor)
            const shouldBubble = (ui?.showWhatsAppBubble ?? !!ui?.whatsapp);
            if (shouldBubble && ui?.whatsapp && ui.whatsapp !== lastShownWhatsApp) {
              makeBubble(
                "bot",
                `Puedes escribirnos por WhatsApp aquí: <a href="${ui.whatsapp}" target="_blank" rel="noopener">Abrir WhatsApp</a>`
              );
              lastShownWhatsApp = ui.whatsapp;
            }

    // B) Chips (incluye “WhatsApp / Email / Llamada” cuando el backend los mande)
            const chips = (ui?.chips || []).filter(c =>
              !(shouldBubble && /whats\s*app|whatsapp|wasap/i.test(c))
            );
            renderChips(chips);
          } catch {}
          } else if (evType === "done") {
            currentBotBubble = null;
          } else if (evType === "error") {
            makeBubble("bot", `[error] ${data}`);
            console.error("SSE error event:", data);
          }
        }
      }
    } catch (err) {
      hideTyping();
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

  // Saludo si el panel ya venía abierto (p.ej. por CSS)
  if (panel?.classList.contains("open") && thread?.childElementCount === 0) {
    greetOnce();
  }

  // Enviar
  document.getElementById("send")?.addEventListener("click", startStream);
});

// ===== Nube de puntos neon en header =====
(function neonBlob(){
  const cvs = document.getElementById('cw-viz');
  if(!cvs) return;
  const ctx = cvs.getContext('2d');
  let w=0,h=0, dpr=window.devicePixelRatio||1, t=0;
  const grid = { cols: 72, rows: 42, gap: 7 };

  function rn(i){ const x=Math.sin(i)*43758.5453; return x-Math.floor(x); }
  function hash(x,y){ return rn(x*157.31+y*789.23); }
  function noise(x,y){
    const xi=Math.floor(x), yi=Math.floor(y);
    const xf=x-xi, yf=y-yi;
    const tl=hash(xi,yi), tr=hash(xi+1,yi), bl=hash(xi,yi+1), br=hash(xi+1,yi+1);
    const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
    const a=tl+(tr-tl)*u, b=bl+(br-bl)*u;
    return a+(b-a)*v;
  }

  function resize(){
    const rect = cvs.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width*dpr));
    h = Math.max(1, Math.floor(rect.height*dpr));
    cvs.width = w; cvs.height = h; ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize(); addEventListener('resize', resize);

  function lerp(a,b,u){ return a+(b-a)*u; }
  function hue(u){
    const c1=[80,180,255], c2=[180,90,255];
    return `rgb(${Math.round(lerp(c1[0],c2[0],u))},${Math.round(lerp(c1[1],c2[1],u))},${Math.round(lerp(c1[2],c2[2],u))})`;
  }

  function draw(){
    ctx.clearRect(0,0,cvs.width,cvs.height);
    const cols = grid.cols, rows = grid.rows;
    const gx = cvs.clientWidth/(cols-1), gy = cvs.clientHeight/(rows-1);
    const cx = cvs.clientWidth/2, cy = cvs.clientHeight/2;
    const scale = Math.min(cx, cy)*0.9;
    t += 0.006;

    ctx.save();
    ctx.translate(0,0);
    ctx.globalCompositeOperation='lighter';

    for(let y=0; y<rows; y++){
      for(let x=0; x<cols; x++){
        const nx = (x/(cols-1))*2-1;
        const ny = (y/(rows-1))*2-1;
        const r = Math.hypot(nx, ny);
        const ang = Math.atan2(ny, nx);
        const warp = 0.38*noise(Math.cos(ang)*1.2 + t*0.7, Math.sin(ang)*1.2 - t*0.5);
        const radius = (0.55 + warp - r*0.15)*scale;

        const px = cx + Math.cos(ang)*(radius);
        const py = cy + Math.sin(ang)*(radius);
        const n = noise(nx*1.8 + t*0.8, ny*1.6 - t*0.6);
        const c = hue(n*0.85);

        ctx.fillStyle = c;
        const s = 1.2 + n*1.8;
        ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
