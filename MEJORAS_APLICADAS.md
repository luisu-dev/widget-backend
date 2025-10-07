# Mejoras Aplicadas al Backend - ZIA

Este documento detalla las mejoras de seguridad, rendimiento y calidad de código aplicadas al archivo `main.py`.

## 📅 Fecha de Aplicación
2025-10-06

---

## 🔒 Mejoras de Seguridad

### 1. Validación de Secretos en Startup
**Ubicación:** `main.py:470-486`

**Problema:** El sistema iniciaba sin validar que los secretos críticos estuvieran configurados, permitiendo que la aplicación corriera en un estado inseguro.

**Solución:**
- Validación obligatoria de `AUTH_SECRET` y `ADMIN_KEY` en startup
- El sistema falla inmediatamente si faltan secretos críticos
- Warnings para secretos opcionales pero recomendados (Stripe, Twilio)

```python
# Validar secretos críticos
required_secrets = {
    "AUTH_SECRET": AUTH_SECRET,
    "ADMIN_KEY": ADMIN_KEY,
}
missing = [k for k, v in required_secrets.items() if not v or not v.strip()]
if missing:
    raise RuntimeError(f"❌ Secretos requeridos no configurados: {', '.join(missing)}")
```

**Impacto:** ✅ Previene inicio de la aplicación en estado inseguro

---

### 2. Validación de Firma Twilio Corregida
**Ubicación:** `main.py:623-660`

**Problema:** La función `_twilio_req_is_valid` solo verificaba que existiera el header `X-Twilio-Signature` pero nunca validaba la firma criptográfica, permitiendo webhooks falsificados.

**Solución:**
- Implementación completa de `RequestValidator` de Twilio
- Validación criptográfica real de la firma HMAC
- Logging de intentos de firma inválida

```python
validator = RequestValidator(auth_token)
is_valid = validator.validate(url, params, sig)
if not is_valid:
    log.warning(f"Firma Twilio inválida para URL: {url}")
```

**Impacto:** 🔐 Previene webhooks falsificados de Twilio (crítico para WhatsApp)

---

### 3. Validación de Firma Meta/Facebook
**Ubicación:** `main.py:1443-1473`

**Problema:** No había validación de firma para webhooks de Meta, permitiendo cualquier solicitud.

**Solución:**
- Nueva función `_validate_meta_signature()`
- Validación de `X-Hub-Signature-256` con HMAC-SHA256
- Verificación de `META_APP_SECRET`

```python
def _validate_meta_signature(request: Request, body: bytes) -> bool:
    signature = request.headers.get("X-Hub-Signature-256", "")
    expected_hash = signature[7:]  # Remueve "sha256="
    computed_hash = hmac.new(
        app_secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_hash, computed_hash)
```

**Impacto:** 🛡️ Protege webhooks de Facebook/Instagram contra spoofing

---

### 4. Validación Mejorada de Webhooks Stripe
**Ubicación:** `main.py:2681-2702`

**Problema:** No validaba que `STRIPE_WEBHOOK_SECRET` estuviera configurado antes de procesar webhooks.

**Solución:**
- Validación de secret al inicio del endpoint
- Manejo específico de `SignatureVerificationError`
- Logging detallado de firmas inválidas

```python
if not STRIPE_WEBHOOK_SECRET:
    log.error("STRIPE_WEBHOOK_SECRET no configurado")
    raise HTTPException(500, "Server misconfiguration")

try:
    event = stripe.Webhook.construct_event(raw, sig, STRIPE_WEBHOOK_SECRET)
except stripe.error.SignatureVerificationError as e:
    log.warning(f"❌ Firma de Stripe inválida: {e}")
    raise HTTPException(403, "Invalid signature")
```

**Impacto:** 💳 Asegura integridad de eventos de pagos

---

## ⚡ Mejoras de Rendimiento

### 5. Cleanup de Sesiones en Memoria
**Ubicación:** `main.py:832-851`

**Problema:** Las sesiones (`SESSIONS` y `MESSAGES`) crecían indefinidamente en memoria causando memory leaks.

**Solución:**
- Tarea asíncrona en background que limpia sesiones antiguas cada hora
- Elimina sesiones con más de 24 horas de antigüedad
- Logging de sesiones eliminadas

```python
async def cleanup_old_sessions():
    """Limpia sesiones antiguas de la memoria para prevenir memory leaks."""
    while True:
        await asyncio.sleep(SESSION_CLEANUP_INTERVAL_SECONDS)

        cutoff_ms = now_ms() - (SESSION_MAX_AGE_HOURS * 3600 * 1000)
        to_delete = [
            sid for sid, session in SESSIONS.items()
            if session.get("startedAt", 0) < cutoff_ms
        ]

        for sid in to_delete:
            SESSIONS.pop(sid, None)
            MESSAGES.pop(sid, None)
```

**Configuración:**
- `SESSION_MAX_AGE_HOURS = 24` - Edad máxima de sesión
- `SESSION_CLEANUP_INTERVAL_SECONDS = 3600` - Frecuencia de limpieza

**Impacto:** 🚀 Previene crecimiento ilimitado de memoria en producción

---

## 🔧 Mejoras de Calidad de Código

### 6. Constantes Extraídas
**Ubicación:** `main.py:148-156`

**Problema:** Números mágicos dispersos por todo el código dificultaban mantenimiento.

**Solución:**
```python
# ── Constantes de la aplicación ───────────────────────────────────────────
MAX_TEXT_LENGTH = 2000  # Longitud máxima de texto en respuestas
MAX_MESSAGE_CONTENT_LENGTH = 4000  # Longitud máxima de contenido de mensaje en DB
CATALOG_MAX_ITEMS = 14  # Máximo de productos en catálogo
CATALOG_MAX_DESC_LENGTH = 120  # Máximo de caracteres en descripción de producto
CHAT_MAX_HISTORY_PAIRS = 8  # Máximo de pares de mensajes en historial de chat
OPENAI_RETRY_DELAY = 0.7  # Segundos de espera entre reintentos de OpenAI
CATALOG_FETCH_TIMEOUT = 6  # Timeout en segundos para fetch de catálogo
DB_CONNECT_TIMEOUT = 5  # Timeout en segundos para conexión a DB
```

**Reemplazos realizados:**
- `[:2000]` → `[:MAX_TEXT_LENGTH]` (8 ocurrencias)
- `[:4000]` → `[:MAX_MESSAGE_CONTENT_LENGTH]` (1 ocurrencia)
- `max_pairs=8` → `max_pairs=CHAT_MAX_HISTORY_PAIRS` (1 ocurrencia)

**Impacto:** 📝 Mejora mantenibilidad y configurabilidad

---

### 7. Eliminación de Código Duplicado - `_graph_params`
**Ubicación:** `main.py:704-718`

**Problema:** La función `_graph_params` estaba duplicada 4 veces en diferentes lugares del código.

**Solución:**
- Función global única con documentación
- Eliminadas 4 definiciones locales redundantes

```python
def _graph_params(access_token: str) -> dict:
    """
    Genera parámetros para llamadas a la Graph API de Meta.
    Incluye el access_token y opcionalmente appsecret_proof para mayor seguridad.
    """
    params = {"access_token": access_token}
    app_secret = os.getenv("META_APP_SECRET", "")
    if app_secret:
        proof = hmac.new(
            app_secret.encode("utf-8"),
            msg=access_token.encode("utf-8"),
            digestmod=hashlib.sha256
        ).hexdigest()
        params["appsecret_proof"] = proof
    return params
```

**Líneas eliminadas:** ~32 líneas de código duplicado

**Impacto:** ♻️ Reduce duplicación y facilita mantenimiento

---

### 8. Bug Fix - `build_system_for_tenant`
**Ubicación:** `main.py:1117-1154`

**Problema:** Variables `policies`, `hours`, `products`, `prices`, `faq` no estaban definidas, causando `NameError` en runtime.

**Solución:**
- Extraer todas las variables del diccionario `settings`
- Código duplicado eliminado
- Documentación agregada

```python
def build_system_for_tenant(tenant: Optional[dict]) -> str:
    """Construye el prompt del sistema personalizado para un tenant."""
    s = (tenant or {}).get("settings", {}) or {}

    # Extraer configuraciones del tenant
    policies = s.get("policies", "")
    hours = s.get("business_hours", "")
    products = s.get("products_description", "")
    prices = s.get("prices", {})
    faq = s.get("faq", [])

    # ... resto del código ...
```

**Impacto:** 🐛 Elimina crash potencial en producción

---

## 📊 Resumen de Impacto

| Categoría | Mejoras | Impacto |
|-----------|---------|---------|
| **Seguridad** | 4 críticas | ✅ Previene ataques por webhooks falsificados |
| **Rendimiento** | 1 crítica | 🚀 Elimina memory leaks |
| **Código** | 3 mayores | 📝 ~70 líneas de duplicación eliminadas |
| **Bugs** | 1 crítico | 🐛 Previene crashes en runtime |

---

## ✅ Checklist de Verificación Post-Despliegue

Antes de desplegar a producción, verifica:

### Variables de Entorno Requeridas
- [ ] `AUTH_SECRET` está configurado (mínimo 32 caracteres)
- [ ] `ADMIN_KEY` está configurado
- [ ] `META_APP_SECRET` está configurado (si usas Meta webhooks)
- [ ] `STRIPE_WEBHOOK_SECRET` está configurado (si usas Stripe)
- [ ] `TWILIO_AUTH_TOKEN` está configurado (si usas Twilio)
- [ ] `META_VERIFY_TOKEN` está configurado (si usas Meta webhooks)

### Pruebas Recomendadas
1. **Startup:** Verificar que la app inicia correctamente con logs de validación
2. **Webhooks Twilio:** Enviar mensaje de prueba por WhatsApp
3. **Webhooks Meta:** Probar comentario en Facebook/Instagram
4. **Webhooks Stripe:** Hacer un pago de prueba
5. **Memory:** Monitorear uso de memoria durante 24-48 horas

### Logs a Verificar
```bash
# Startup exitoso
✅ Validación de secretos completada
🧹 Tarea de limpieza de sesiones iniciada
Postgres listo ✅

# Cleanup funcionando (después de 1 hora)
🧹 Limpiadas X sesiones antiguas (>24h)
```

---

## 🚨 Acciones de Emergencia

Si algo falla después del despliegue:

### Error: "Secretos requeridos no configurados"
```bash
# Verificar y configurar:
export AUTH_SECRET="tu-secret-aqui-32-chars-minimo"
export ADMIN_KEY="tu-admin-key-aqui"
```

### Webhook de Twilio rechazado (403)
```bash
# Si es desarrollo, deshabilitar validación:
export TWILIO_VALIDATE_SIGNATURE="false"

# Si es producción, verificar:
# 1. TWILIO_AUTH_TOKEN es correcto
# 2. URL en Twilio console coincide exactamente
```

### Memory leak persiste
```bash
# Verificar que la tarea de cleanup está corriendo:
# Buscar en logs: "🧹 Tarea de limpieza de sesiones iniciada"
# Si no aparece, revisar el startup event
```

---

## 📈 Métricas Recomendadas

Agregar monitoreo de:
1. **Memoria:** Uso de heap de Python cada hora
2. **Sesiones:** Conteo de `len(SESSIONS)` cada 15 minutos
3. **Webhooks:** Rate de 403 (firma inválida) por minuto
4. **Seguridad:** Alertas cuando `AUTH_SECRET` está vacío

---

## 🔮 Próximas Mejoras Recomendadas

### Alta Prioridad
1. **Redis para Rate Limiting:** Mover `RATELIMIT` a Redis para soporte multi-instancia
2. **Tests Unitarios:** Agregar tests para validaciones de firma
3. **Separación en Módulos:** Dividir `main.py` en 8-10 archivos

### Media Prioridad
4. **Retry con Backoff:** Implementar exponential backoff en llamadas a OpenAI
5. **Circuit Breaker:** Para APIs externas (Meta, Stripe, OpenAI)
6. **Health Checks:** Endpoint `/health` que valide DB, Redis, APIs

### Baja Prioridad
7. **Telemetría:** Integrar Sentry o DataDog
8. **i18n:** Internacionalización de mensajes
9. **API Documentation:** OpenAPI/Swagger completo

---

## 📞 Soporte

Para preguntas sobre estas mejoras:
- Revisar comentarios en el código (marcados con `# ←` o docstrings)
- Buscar logs con emojis (🔐, ⚠️, ✅, ❌) para debugging
- Consultar este documento para contexto

**Versión del documento:** 1.0
**Última actualización:** 2025-10-06
