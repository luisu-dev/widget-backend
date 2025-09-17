// app.js
"use strict";

function __ziaInit(){
  if (window.__zia_widget_inited) return; // evita doble init si el script se carga dos veces
  window.__zia_widget_inited = true;

  // ------- API con tenant (solo frontend) -------
  const RAW_API = window.CHAT_API || "https://widget-backend-zia.onrender.com/v1/chat/stream";
  const TENANT  = window.TENANT   || "demo";
  const API     = `${RAW_API}?tenant=${encodeURIComponent(TENANT)}`;
  const BOOTSTRAP = (RAW_API || "").replace(/\/v1\/chat\/stream$/, "")
                    + `/v1/widget/bootstrap?tenant=${encodeURIComponent(TENANT)}`;

  // ------- DOM -------
  const thread   = document.getElementById("msgs");
  const chipsBox = document.getElementById("chips");
  const ctaBox   = document.getElementById("zia-cta");
  const msg      = document.getElementById("msg");
  const sid      = document.getElementById("sid");
  const sendBtn  = document.getElementById("send");
  const newBtn   = document.getElementById("new");
  const stopBtn  = document.getElementById("stop");
  const panel    = document.getElementById("cw-panel");
  const launcher = document.getElementById("cw-launcher");
  const closeBtn = document.getElementById("cw-close");
  const minBtn   = document.getElementById("cw-min");
  const badgeEl  = document.querySelector(".cw-badge");
  const WA_FALLBACK = (window.ZIA_WHATSAPP || '').replace(/\D+/g,'');

  // ------- Unread badge + modos del orb -------
  let unreadCount = 0;
  function setUnread(n){
    unreadCount = Math.max(0, n|0);
    // Badge deshabilitada por diseño
    if (badgeEl){ badgeEl.hidden = true; badgeEl.textContent = ""; }
    if (unreadCount > 0) window.__orbSetMode?.("unread");
    else window.__orbSetMode?.("idle");
  }

  // ------- sesión persistente -------
  (function persistSessionId(){
    try{
      const saved = localStorage.getItem("sid");
      if(saved && sid) sid.value = saved;
      else if (sid){
        sid.value = "sess_" + Math.random().toString(16).slice(2);
        localStorage.setItem("sid", sid.value);
      }
    }catch{}
  })();
  newBtn?.addEventListener("click", ()=>{
    if(!sid) return;
    sid.value = "sess_" + Math.random().toString(16).slice(2);
    try{ localStorage.setItem("sid", sid.value); }catch{}
  });

  // ------- helpers UI -------
  const autoscroll = ()=>{
    const scroller = thread?.parentElement || thread;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  };
  const makeBubble = (role, html="")=>{
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.innerHTML = html;
    thread?.appendChild(el);
    autoscroll();
    return el;
  };

  // CTA renderer (botón de pago, chips y link a WhatsApp)
  function renderZiaCTA(payload = {}){
    if (!ctaBox) return;
    ctaBox.innerHTML = "";

    if (payload.checkout_url){
      const btn = document.createElement("button");
      btn.textContent = payload.label || "Pagar ahora";
      btn.className = "zia-cta-btn";
      btn.onclick = () => { window.location.href = payload.checkout_url; };
      ctaBox.appendChild(btn);
    }

    if (Array.isArray(payload.chips) && payload.chips.length){
      const wrap = document.createElement("div");
      for(const label of payload.chips){
        const b = document.createElement("button");
        b.type = "button";
        b.className = "zia-chip";
        b.textContent = label;
        b.onclick = () => { if (msg){ msg.value = label; sendBtn?.click(); } };
        wrap.appendChild(b);
      }
      ctaBox.appendChild(wrap);
    }

    const waLink = payload.whatsapp || (WA_FALLBACK ? `https://wa.me/${WA_FALLBACK}` : "");
    if (waLink){
      const a = document.createElement("a");
      a.href = waLink;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Hablar por WhatsApp";
      a.className = "zia-wa-link";
      ctaBox.appendChild(a);
    }
  }

  // ------- saludo -------
  let BRAND_NAME = window.TENANT_NAME || null;
  let greetedOnce = false;
  function greetOnce(){
    if (greetedOnce) return;
    const brand = BRAND_NAME || window.TENANT_NAME || "zIA";
    makeBubble("bot", `Hola — soy ${brand}, tu asistente con IA. Puedo resolver dudas, cotizar y coordinar por WhatsApp. ¿Qué necesitas hoy?`);
    greetedOnce = true;
  }

  const openPanel = ()=>{
    panel?.classList.add("open");
    setUnread(0);
    // siempre saluda una vez por navegación
    greetOnce();
    loadBootstrapOnce();
    try{ window.__ziaDismissTip?.(); }catch(_){ }
  };

  launcher?.addEventListener("click", ()=>{
    openPanel();
    try{ window.__ziaDismissTip?.(); }catch(_){ }
  });
  closeBtn?.addEventListener("click", ()=>panel?.classList.remove("open"));
  minBtn?.addEventListener("click", ()=>panel?.classList.toggle("open"));

  msg?.addEventListener("keydown",(e)=>{
    if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendBtn?.click(); }
  });

  // --- typing indicator (sin backend) ---
  let typingEl=null, typingTimer=null;
  function showTyping(){
    if(typingEl) return;
    typingEl = makeBubble("bot","...");
    typingEl.style.opacity=".6";
    typingEl.classList.add("typing");
    window.__orbSetMode?.("thinking");
    let dots=1;
    typingTimer = setInterval(()=>{ dots=(dots%3)+1; if(typingEl) typingEl.textContent=".".repeat(dots); },350);
  }
  function hideTyping(){
    if(typingTimer){ clearInterval(typingTimer); typingTimer=null; }
    if(typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl=null;
    if (unreadCount > 0) window.__orbSetMode?.("unread");
    else window.__orbSetMode?.("idle");
  }

  // linkify
  const linkify = (text)=>{
    if(!text) return "";
    const escape = (s)=>s
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;");
    const urlRe = /(https?:\/\/[^\s<>"']+)/g;
    let last=0, out="";
    text.replace(urlRe,(url, idx)=>{
      out += escape(text.slice(last, idx));
      const safe = escape(url);
      out += `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
      last = idx + url.length;
      return url;
    });
    out += escape(text.slice(last));
    return out;
  };

  // ------- chips -------
  function renderChips(items=[]){
    if(!chipsBox) return;
    chipsBox.innerHTML="";
    if(!items.length) return;
    for(const label of items){
      const b=document.createElement("button");
      b.className="chip"; b.textContent=label;
      b.onclick=()=>{ msg.value=label; sendBtn?.click(); };
      chipsBox.appendChild(b);
    }
  }

  // ------- Bootstrap (cargar al abrir por primera vez) -------
  let __BOOT_DONE = false;
  async function loadBootstrapOnce(){
    if (__BOOT_DONE) return;
    __BOOT_DONE = true;
    try{
      const res = await fetch(BOOTSTRAP);
      if(!res.ok) return;
      const data = await res.json();
      BRAND_NAME = data?.tenant?.name || BRAND_NAME;
      renderChips(data?.ui?.suggestions || []);
    }catch(e){
      console.warn("bootstrap skipped:", e?.message || e);
    }
  }

  // ------- Streaming -------
  let currentController=null, currentBotBubble=null, lastShownWhatsApp="";

  async function startStream(){
    if(!msg) return;
    if(currentController) currentController.abort();

    const userText = msg.value || "(vacío)";
    makeBubble("user", linkify(userText));
    msg.value="";

    const body = { message:userText, sessionId: sid?.value || null };
    currentController = new AbortController();
    if(stopBtn) stopBtn.onclick=()=>currentController?.abort();

    let res;
    try{
      showTyping();
      res = await fetch(API,{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(body),
        signal: currentController.signal
      });
    }catch(err){
      hideTyping();
      makeBubble("bot","[error] No se pudo conectar con el backend");
      console.error(err);
      currentController=null;
      return;
    }

    if(!res.ok){
      hideTyping();
      const retry = res.headers.get("Retry-After");
      const txt = await res.text().catch(()=> "");
      makeBubble("bot", `Error ${res.status} ${res.statusText}` + (retry?` — Retry-After: ${retry}s`:"") + (txt?`\n${txt}`:""));
      currentController=null;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer=""; let lastSeq=0; currentBotBubble=null;

    try{
      while(true){
        const {value, done} = await reader.read();
        if(done) break;
        if(value) buffer += decoder.decode(value,{stream:true});
        buffer = buffer.replace(/\r\n/g,"\n");

        let idx;
        while((idx = buffer.indexOf("\n\n")) !== -1){
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let evType="message"; let data="";
          for(const line of rawEvent.split("\n")){
            if(!line) continue;
            if(line.startsWith(":")) continue;
            if(line.startsWith("event:")){ evType=line.slice(6).trim(); continue; }
            if(line.startsWith("data:")){
              let chunk=line.slice(5); if(chunk.startsWith(" ")) chunk=chunk.slice(1);
              data += (data ? "\n" : "") + chunk;
            }
          }

          if(evType==="delta"){
            if(!currentBotBubble){ hideTyping(); currentBotBubble = makeBubble("bot",""); }
            let text=data;
            try{
              const obj=JSON.parse(data);
              if(obj && typeof obj.content==="string"){
                if(typeof obj.i==="number"){ if(obj.i<=lastSeq) continue; lastSeq=obj.i; }
                text=obj.content;
              }
            }catch{}
            currentBotBubble.innerHTML += linkify(text);
            autoscroll();

            if (!panel?.classList.contains("open")) setUnread(unreadCount + 1);

          }else if(evType==="ui"){
            try{
              const ui = JSON.parse(data);

              // botón fijo en la zona CTA (y chips / WhatsApp si aplica)
              renderZiaCTA(ui);

              // además deja un enlace en el hilo (buena trazabilidad en la conversación)
              const computedWa = ui?.whatsapp || (WA_FALLBACK ? `https://wa.me/${WA_FALLBACK}` : "");
              const shouldBubble = (ui?.showWhatsAppBubble ?? !!computedWa);
              if (shouldBubble && computedWa && computedWa !== lastShownWhatsApp) {
                makeBubble("bot", `Puedes escribirnos por WhatsApp aquí: <a href="${computedWa}" target="_blank" rel="noopener">Abrir WhatsApp</a>`);
                lastShownWhatsApp = computedWa;
              }
              if (ui?.checkout_url) {
                const label = ui?.label || 'Pagar ahora';
                makeBubble("bot", `Listo, puedes completar tu compra aquí: <a href="${ui.checkout_url}" target="_blank" rel="noopener">${label}</a>`);
              }

              // chips del cuerpo (filtremos redundancias con WhatsApp si hay burbuja)
              const chips = (ui?.chips || []).filter(c => !(shouldBubble && /whats\s*app|whatsapp|wasap/i.test(c)));
              renderChips(chips);

            }catch(e){
              console.error("UI payload inválido:", e);
            }
          }else if(evType==="done"){
            currentBotBubble=null;
          }else if(evType==="error"){
            makeBubble("bot", `[error] ${data}`);
            console.error("SSE error:", data);
          }
        }
      }
    }catch(err){
      hideTyping();
      if(String(err?.name)==="AbortError"){
        const el = makeBubble("bot","[cancelado]"); el.style.opacity=".85";
      }else{
        makeBubble("bot", `[stream-error] ${String(err)}`);
        console.error("read failed:", err);
      }
    }finally{
      currentController=null; currentBotBubble=null;
    }
  }

  if(panel?.classList.contains("open") && thread?.childElementCount===0){ greetOnce(); }
  document.getElementById("send")?.addEventListener("click", startStream);
}

// Ejecuta incluso si el script se inyecta después de DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", __ziaInit);
} else {
  __ziaInit();
}

/* -------------------------------------------------------------
   "Lava lamp" orb — colores por estado y bajo uso de GPU
   idle: morado, thinking: azul, unread: verde
-------------------------------------------------------------- */
(function orbLava(){
  const cv = document.getElementById('cw-orb');
  if(!cv) return;
  if (window.__ZIA_DISABLE_ORB) { return; }
  const ctx = cv.getContext('2d', { alpha: true });

  // limitar resolución del canvas para móviles
  const DPR_MAX = 1.4;
  let dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  let MODE = 'idle'; // 'idle' | 'thinking' | 'unread'
  let ENABLED = true;
  const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.__orbSetMode = (m)=>{ MODE = m || 'idle'; };

  function resize(){
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    cv.width  = Math.max(1, Math.round(r.width  * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize(); addEventListener('resize', resize);

  // blobs grandes con gradientes radiales — pocos por frame
  const BLOB_COUNT = 5;
  const blobs = Array.from({length:BLOB_COUNT}, (_,i)=>({
    baseR: 0.36 + (i%3)*0.05,     // radio relativo al contenedor
    angle: (i/BLOB_COUNT)*Math.PI*2,
    speed: 0.15 + (i%2)*0.06,
    dist:  0.18 + (i%4)*0.04,
  }));

  // Paletas (RGB)
  const PURPLE_A=[168,85,247], PURPLE_B=[147,51,234];  // idle
  const BLUE_A  =[59,130,246], BLUE_B  =[56,189,248];  // typing
  const GREEN_A =[16,185,129], GREEN_B =[34,197,94];   // unread

  const lerp=(a,b,u)=>a+(b-a)*u;
  const mix=(c1,c2,u)=>[
    Math.round(lerp(c1[0],c2[0],u)),
    Math.round(lerp(c1[1],c2[1],u)),
    Math.round(lerp(c1[2],c2[2],u))
  ];
  const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function palette(){
    if (MODE==='unread') return [GREEN_A, GREEN_B];
    if (MODE==='thinking') return [BLUE_A, BLUE_B];
    return [PURPLE_A, PURPLE_B];
  }

  let lastTs = 0;
  function draw(ts){
    if (!ENABLED || document.hidden) { requestAnimationFrame(draw); return; }
    // FPS moderado para no saturar GPU
    const targetFps = prefersReduce ? 18 : 24;
    const minDelta = 1000/targetFps;
    if (ts && (ts - lastTs) < minDelta) { requestAnimationFrame(draw); return; }
    const dt = Math.min(100, (ts - lastTs) || minDelta) / 1000;
    lastTs = ts || 0;

    const w = cv.clientWidth, h = cv.clientHeight;
    const cx = w/2, cy = h/2;
    const R  = Math.min(cx, cy) * 0.92;

    ctx.clearRect(0,0,cv.width,cv.height);

    // clip circular
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();

    // fondo suave oscuro
    const base = ctx.createRadialGradient(cx,cy,0, cx,cy,R*1.05);
    base.addColorStop(0,  '#0f1116');
    base.addColorStop(0.65,'#0c0f15');
    base.addColorStop(1,  '#090b10');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = base;
    ctx.fillRect(cx-R-2, cy-R-2, (R+2)*2, (R+2)*2);

    // blobs con mezcla 'screen' (bordes nítidos, sin blur)
    const [C1, C2] = palette();
    ctx.globalCompositeOperation = 'screen';
    const speedK = MODE==='thinking' ? 1.2 : MODE==='unread' ? 1.0 : 0.85;

    for(let i=0;i<blobs.length;i++){
      const b = blobs[i];
      b.angle += dt * b.speed * speedK * (prefersReduce ? 0.5 : 1);
      const wobble = 0.06*Math.sin((lastTs/1000)* (0.6 + i*0.13));
      const r  = R * (b.baseR + wobble);
      const x  = cx + Math.cos(b.angle) * (R * b.dist);
      const y  = cy + Math.sin(b.angle*0.9) * (R * (b.dist*0.9));

      // color varía levemente por blob
      const mixU = (i % 2 ? 0.35 : 0.65);
      const col  = mix(C1, C2, mixU);

      const outerAlpha = MODE==='unread' ? 0.42 : MODE==='thinking' ? 0.38 : 0.35;
      const innerAlpha = Math.min(0.85, outerAlpha + 0.22);

      ctx.fillStyle = rgba(col, outerAlpha);
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();

      ctx.fillStyle = rgba(col, innerAlpha);
      ctx.beginPath(); ctx.arc(x,y,r*0.58,0,Math.PI*2); ctx.fill();

      ctx.fillStyle = rgba([255,255,255], Math.min(0.18, innerAlpha*0.55));
      ctx.beginPath(); ctx.arc(x + r*0.18, y - r*0.15, r*0.22, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
    ctx.globalCompositeOperation='source-over';
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // pausar si el launcher no está en viewport
  const launcher = document.getElementById('cw-launcher');
  function recomputeEnabled(){
    if (prefersReduce) { ENABLED = false; return; }
    if (!launcher) { ENABLED = true; return; }
    const r = launcher.getBoundingClientRect();
    const inView = r.bottom >= 0 && r.right >= 0 && r.top <= (window.innerHeight||document.documentElement.clientHeight) && r.left <= (window.innerWidth||document.documentElement.clientWidth);
    ENABLED = inView;
  }
  recomputeEnabled();
  addEventListener('scroll', recomputeEnabled, {passive:true});
  addEventListener('resize', recomputeEnabled);
  document.addEventListener('visibilitychange', ()=>{ ENABLED = !document.hidden; });
})();
