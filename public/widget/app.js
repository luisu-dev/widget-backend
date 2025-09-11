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

  // ------- Unread badge + modos del orb -------
  let unreadCount = 0;
  function setUnread(n){
    unreadCount = Math.max(0, n|0);
    if (!badgeEl) return;
    if (unreadCount > 0){
      badgeEl.hidden = false;
      badgeEl.textContent = String(unreadCount);
      window.__orbSetMode?.("unread");
    } else {
      badgeEl.hidden = true;
      badgeEl.textContent = "";
      window.__orbSetMode?.("idle");
    }
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

  // ------- saludo -------
  let BRAND_NAME = window.TENANT_NAME || null;
  function greetOnce(){
    const session = sid?.value || "anon";
    const flagKey = `welcomed:${TENANT}:${session}`;
    try{
      if (localStorage.getItem(flagKey)) return;
      const brand = BRAND_NAME || window.TENANT_NAME || "zIA";
      makeBubble("bot", `Hola — soy ${brand}, tu asistente con IA. Puedo resolver dudas, cotizar y coordinar por WhatsApp. ¿Qué necesitas hoy?`);
      localStorage.setItem(flagKey,"1");
    }catch(e){
      const brand = BRAND_NAME || window.TENANT_NAME || "zIA";
      makeBubble("bot", `Hola — soy ${brand}, tu asistente con IA. Puedo resolver dudas, cotizar y coordinar por WhatsApp. ¿Qué necesitas hoy?`);
    }
  }

  const openPanel = ()=>{
    panel?.classList.add("open");
    setUnread(0); // reset no leídos
    if (thread && thread.childElementCount === 0) greetOnce();
  };

  launcher?.addEventListener("click", openPanel);
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

  // ------- Bootstrap inicial -------
  (async function initBootstrap(){
    try{
      const res = await fetch(BOOTSTRAP);
      if(!res.ok) return;
      const data = await res.json();
      BRAND_NAME = data?.tenant?.name || BRAND_NAME;
      renderChips(data?.ui?.suggestions || []);
    }catch(e){
      console.warn("bootstrap skipped:", e?.message || e);
    }
  })();

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

              const shouldBubble = (ui?.showWhatsAppBubble ?? !!ui?.whatsapp);
              if (shouldBubble && ui?.whatsapp && ui.whatsapp !== lastShownWhatsApp) {
                makeBubble("bot", `Puedes escribirnos por WhatsApp aquí: <a href="${ui.whatsapp}" target="_blank" rel="noopener">Abrir WhatsApp</a>`);
                lastShownWhatsApp = ui.whatsapp;
              }

              const chips = (ui?.chips || []).filter(c => !(shouldBubble && /whats\s*app|whatsapp|wasap/i.test(c)));
              renderChips(chips);
            }catch{}
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
   Nube de puntos nítida + modos visuales del launcher (orb)
------------------------------------------------------------- */
(function orbDots(){
  const cv = document.getElementById('cw-orb');
  if(!cv) return;
  if (window.__ZIA_DISABLE_ORB) { return; }
  const ctx = cv.getContext('2d', { alpha: true });
  const DPR_MAX = 1.5; // limitar para evitar trabajo extra en pantallas 2x/3x
  let dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  let t = 0;
  let MODE = 'idle';                   // 'idle' | 'thinking' | 'unread'
  let ENABLED = true;
  const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.__orbSetMode = (m)=>{ MODE = m || 'idle'; };

  const rn=i=>{const x=Math.sin(i)*43758.5453; return x-Math.floor(x);};
  const hash=(x,y)=>rn(x*157.31+y*789.23);
  function noise(x,y){
    const xi=Math.floor(x), yi=Math.floor(y);
    const xf=x-xi, yf=y-yi;
    const tl=hash(xi,yi), tr=hash(xi+1,yi), bl=hash(xi,yi+1), br=hash(xi+1,yi+1);
    const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
    return (tl+(tr-tl)*u) + ( (bl+(br-bl)*u) - (tl+(tr-tl)*u) )*v;
  }
  const lerp=(a,b,u)=>a+(b-a)*u;
  const mixRGB=(a,b,u)=>`rgb(${Math.round(lerp(a[0],b[0],u))},${Math.round(lerp(a[1],b[1],u))},${Math.round(lerp(a[2],b[2],u))})`;

  const BLUE1=[90,190,255], BLUE2=[200,95,255];
  const MINT1=[110,231,183], MINT2=[120,250,210];

  function resize(){
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    cv.width  = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height* dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize(); addEventListener('resize', resize);
  // Dinamiza la carga de la animación según modo/perfil
  const MIN_R   = 0.08;
  const DOT_MIN = 0.9, DOT_MAX = 1.9;
  const BLUR_MIN= 1.5, BLUR_MAX= 3.0;

  function samplesForMode(){
    if (prefersReduce) return 220;
    if (MODE === 'thinking') return 700;
    if (MODE === 'unread') return 500;
    return 350; // idle
  }

  const golden = Math.PI * (3 - Math.sqrt(5));
  function sample(i, N, R){
    const u = (i+0.5)/N;
    const r = Math.sqrt(lerp(MIN_R*MIN_R, 1, u)) * R;
    const drift = MODE==='thinking' ? 0.7 : 0.5;
    const a = i * golden + t*drift;
    const wob = (noise(Math.cos(a)*1.4 + t*0.6, Math.sin(a)*1.4 - t*0.5)-0.5) * R*0.10;
    const rr  = Math.max(0, r + wob);
    return [ rr*Math.cos(a), rr*Math.sin(a), rr/R ];
  }

  function palette(){
    if (MODE === 'unread') return [MINT1, MINT2];
    if (MODE === 'thinking') return [BLUE1, [180,80,255]];
    return [BLUE1, BLUE2];
  }

  let lastTs = 0;
  function draw(ts){
    // Pausar si no visible o pestaña oculta
    if (!ENABLED || document.hidden) { requestAnimationFrame(draw); return; }
    // Limitar FPS (reduce CPU). Idle/unread: ~30fps, thinking: ~45fps, reduced: 20fps
    const targetFps = prefersReduce ? 20 : (MODE==='thinking' ? 45 : 30);
    const minDelta = 1000/targetFps;
    if (ts && (ts - lastTs) < minDelta) { requestAnimationFrame(draw); return; }
    lastTs = ts || 0;
    const w = cv.clientWidth, h = cv.clientHeight;
    const cx = w/2, cy = h/2;
    const R  = Math.min(cx, cy) * 0.88;

    ctx.clearRect(0,0,cv.width,cv.height);

    // clip circular
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();

    // base oscura
    const base = ctx.createRadialGradient(cx,cy,0, cx,cy,R*1.05);
    base.addColorStop(0,  '#0f131c');
    base.addColorStop(0.65,'#0b0d13');
    base.addColorStop(1,  '#090a0f');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = base;
    ctx.fillRect(cx-R-2, cy-R-2, (R+2)*2, (R+2)*2);

    // puntos
    ctx.globalCompositeOperation = 'screen';
    // pulso más marcado si hay unread
    t += (MODE==='thinking' ? 0.012 : MODE==='unread' ? 0.010 : 0.008);

    const [C1, C2] = palette();
    const SAMPLES = samplesForMode();
    for(let i=0;i<SAMPLES;i++){
      const [dx,dy,ru] = sample(i, SAMPLES, R);
      const x = cx + dx, y = cy + dy;

      const n   = noise(i*0.013 + t*0.7, i*0.021 - t*0.5);
      const col = mixRGB(C1, C2, Math.min(1, Math.max(0, n*0.9 + 0.1)));

      const size = DOT_MIN + (DOT_MAX - DOT_MIN) * (0.35 + 0.65*n);
      const blur = BLUR_MIN + (BLUR_MAX - BLUR_MIN) * (0.2 + 0.8*n);
      const fall = 0.35 + 0.65 * ru;     // menos brillo al centro
      const alpha= 0.18 * fall;

      // glow suave
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = col;
      ctx.shadowColor = col;
      ctx.shadowBlur  = blur;
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill();

      // núcleo nítido
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = Math.min(0.35, alpha + 0.08);
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.7, size*0.6), 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // Pausar animación si el launcher está fuera de viewport o panel cerrado y no hay unread
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
  document.addEventListener('visibilitychange', recomputeEnabled);
})();
