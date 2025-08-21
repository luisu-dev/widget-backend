// app.js
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const API = window.CHAT_API || "https://widget-backend-zia.onrender.com/v1/chat/stream";

  // DOM
  const out = document.getElementById("out");
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
    } catch { /* ignore */ }
  })();

  newBtn?.addEventListener("click", () => {
    if (!sid) return;
    sid.value = "sess_" + Math.random().toString(16).slice(2);
    try { localStorage.setItem("sid", sid.value); } catch {}
  });

  // UI helpers
  const append = (text) => {
    if (!out) return;
    out.textContent += text;
    const scroller = out.parentElement || out;
    scroller.scrollTop = scroller.scrollHeight;
  };

  const separator = () => {
    if (!out) return;
    if (out.textContent.trim().length) append("\n\n— — —\n");
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

  // SSE
  let currentController = null;

  async function startStream() {
    if (!msg) return;
    if (currentController) currentController.abort();

    separator();

    const body = {
      message: msg.value || "(vacío)",
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
      if (String(err?.name) === "AbortError") {
        append("\n\n[cancelado por usuario]");
      } else {
        append("\n\n[error] No se pudo conectar con el backend");
        console.error("Fetch failed:", err);
      }
      currentController = null;
      return;
    }

    if (!res.ok) {
      const retry = res.headers.get("Retry-After");
      const text = await res.text().catch(() => "");
      append(
        `\n\nError ${res.status} ${res.statusText}` +
        (retry ? ` — Retry-After: ${retry}s` : "") +
        (text ? `\n${text}` : "")
      );
      currentController = null;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastSeq = 0;

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
            append(text);

          } else if (evType === "done") {
            try {
              const info = JSON.parse(data);
              append(`\n\n[done: ${info.sessionId ?? "ok"}]`);
            } catch {
              append(`\n\n[done]`);
            }

          } else if (evType === "error") {
            append(`\n\n[error] ${data}`);
            console.error("SSE error event:", data);

          } else if (evType === "ui") {
            // futuro: chips/botones dinámicos
            append(`\n\n[ui] ${data}`);

          } else {
            append(`\n\n[${evType}] ${data}`);
          }
        }
      }
    } catch (err) {
      if (String(err?.name) === "AbortError") {
        append("\n\n[cancelado por usuario]");
      } else {
        append(`\n\n[stream-error] ${String(err)}`);
        console.error("Stream read failed:", err);
      }
    } finally {
      currentController = null;
    }
  }

  sendBtn?.addEventListener("click", startStream);
});
