/*! zIA Widget Loader: inserta estilos, markup y lógica del widget con 1 línea */
;(function(){
  try{
    var s = document.currentScript || (function(){var scr=document.getElementsByTagName('script');return scr[scr.length-1];})();
    var ds = (s && s.dataset) || {};

    var TENANT   = ds.tenant || window.TENANT || 'demo';
    var NAME     = ds.name   || window.TENANT_NAME || 'Asistente';
    var API      = ds.api    || window.CHAT_API || 'https://widget-backend-zia.onrender.com/v1/chat/stream';
    var ASSETS   = ds.assets || (function(){ try{ var u=new URL(s.src, location.href); return u.origin + '/widget'; }catch(_){ return '/widget'; } })();
    // Orb animado: por defecto encendido (lava lamp optimizado)
    var ORB_MODE = (ds.orb || 'on').toLowerCase();
    var THEME    = (ds.theme || 'flat').toLowerCase(); // default: plano
    var PERF     = (ds.performance || 'default').toLowerCase();
    var DEFER    = (ds.defer || '').toLowerCase(); // 'idle' | 'interaction' | <ms>
    var WA_NUM   = (ds.whatsapp || window.ZIA_WHATSAPP || '').trim();

    function boot(){
      try{
        // Exponer configuración global que usa app.js
        window.TENANT = TENANT;
        window.TENANT_NAME = NAME;
        window.CHAT_API = API;
        if (WA_NUM) { window.ZIA_WHATSAPP = WA_NUM; }
        // Forzar tema plano por defecto
        // Aplica tema al contenedor del widget (no al documento entero)
        var __ziaTheme = THEME || 'flat';
        window.__ZIA_DISABLE_ORB = (ORB_MODE !== 'on');

        // 1) Cargar CSS del widget
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = ASSETS + '/styles.css';
        document.head.appendChild(link);

        // 2) Inyectar contenedor aislado (evita interferir con el sitio)
        var root = document.createElement('div');
        root.id = 'zia-root';
        root.setAttribute('data-zia','');
        try { root.setAttribute('data-zia-theme', __ziaTheme); }catch(_){ }

        // 3) Markup del widget (launcher + panel)
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
        while (wrapper.firstChild) root.appendChild(wrapper.firstChild);
        document.body.appendChild(root);

        // 4) Cargar lógica del widget
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
