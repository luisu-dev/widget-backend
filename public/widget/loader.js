/*! zIA Widget Loader: inserta estilos, markup y lógica del widget con 1 línea */
;(function(){
  try{
    var s = document.currentScript || (function(){var scr=document.getElementsByTagName('script');return scr[scr.length-1];})();
    var ds = (s && s.dataset) || {};

    var TENANT   = ds.tenant || window.TENANT || 'demo';
    var NAME     = ds.name   || window.TENANT_NAME || 'Asistente';
    var API      = ds.api    || window.CHAT_API || 'https://widget-backend-zia.onrender.com/v1/chat/stream';
    var ASSETS   = ds.assets || (function(){ try{ var u=new URL(s.src, location.href); return u.origin + '/widget'; }catch(_){ return '/widget'; } })();
    var ORB_MODE = (ds.orb || '').toLowerCase(); // 'off' para desactivar animación
    var THEME    = (ds.theme || '').toLowerCase(); // 'minimal' | ''
    var PERF     = (ds.performance || 'auto').toLowerCase(); // 'auto' | 'default'
    var DEFER    = (ds.defer || '').toLowerCase(); // 'idle' | 'interaction' | <ms>

    function boot(){
      try{
        // Exponer configuración global que usa app.js
        window.TENANT = TENANT;
        window.TENANT_NAME = NAME;
        window.CHAT_API = API;
        // Heurística de rendimiento (Android, poca RAM, reduce-motion)
        var ua = (navigator.userAgent || '').toLowerCase();
        var isAndroid = /android/.test(ua);
        var lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 2);
        var reduce = false;
        try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(_){}

        var wantMinimal = THEME === 'minimal' || (PERF === 'auto' && (isAndroid || lowMem || reduce));
        if (wantMinimal) {
          try { document.documentElement.setAttribute('data-zia-theme','minimal'); }catch(_){ }
          window.__ZIA_DISABLE_ORB = true;
        }
        if (ORB_MODE === 'off') window.__ZIA_DISABLE_ORB = true;

        // 1) Cargar CSS del widget
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = ASSETS + '/styles.css';
        document.head.appendChild(link);

        // 2) Inyectar markup mínimo del widget (launcher + panel)
        var wrapper = document.createElement('div');
        wrapper.innerHTML = (
          '<button id="cw-launcher" class="cw-launcher" aria-label="Abrir chat">'
          + '<canvas id="cw-orb" aria-hidden="true"></canvas>'
          + '<span class="cw-badge" hidden></span>'
          + '</button>'
          + '<section id="cw-panel" class="cw-panel" aria-label="Chat">'
          + '  <header class="cw-header">'
          + '    <div class="cw-title">'
          + '      <span class="cw-dot"></span>'
          + '      <strong>' + (NAME || 'Asistente') + '</strong>'
          + '      <small>en línea</small>'
          + '    </div>'
          + '    <div class="cw-actions">'
          + '      <button id="cw-min" class="cw-iconbtn" aria-label="Minimizar">—</button>'
          + '      <button id="cw-close" class="cw-iconbtn" aria-label="Cerrar">✕</button>'
          + '    </div>'
          + '  </header>'
          + '  <div class="cw-body">'
          + '    <div class="cw-messages"><div id="msgs" class="cw-thread"></div></div>'
          + '    <div id="chips"></div>'
          + '    <footer class="cw-footer">'
          + '      <textarea id="msg" placeholder="Escribe tu mensaje…" rows="1"></textarea>'
          + '      <button id="send" class="cw-send">Enviar</button>'
          + '    </footer>'
          + '    <details class="cw-advanced">'
          + '      <summary>Opciones avanzadas</summary>'
          + '      <div class="row">'
          + '        <input id="sid" placeholder="sessionId (opcional)" />'
          + '        <button id="new">Nuevo sessionId</button>'
          + '        <button id="stop">Detener</button>'
          + '      </div>'
          + '    </details>'
          + '  </div>'
          + '</section>'
        );
        while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);

        // 3) Cargar lógica del widget
        var js = document.createElement('script');
        js.src = ASSETS + '/app.js';
        js.defer = true;
        document.body.appendChild(js);
      }catch(e){ console.error('[zia-widget] boot error:', e && e.message || e); }
    }

    // Defer strategies
    if (DEFER === 'idle'){
      if ('requestIdleCallback' in window){ window.requestIdleCallback(boot, {timeout: 1500}); }
      else setTimeout(boot, 600);
    } else if (DEFER === 'interaction'){
      var once = function(){ document.removeEventListener('pointerdown', once); document.removeEventListener('keydown', once); boot(); };
      document.addEventListener('pointerdown', once, {passive:true, once:true});
      document.addEventListener('keydown', once, {once:true});
    } else if (!isNaN(parseInt(DEFER,10))){
      setTimeout(boot, parseInt(DEFER,10));
    } else {
      boot();
    }
  }catch(e){
    console.error('[zia-widget] loader error:', e && e.message || e);
  }
})();
