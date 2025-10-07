# Configuración de Facebook OAuth

Esta guía te ayudará a configurar la autenticación OAuth de Facebook para conectar páginas de Facebook e Instagram a tu aplicación ZIA.

## 1. Crear una App de Facebook

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Click en "My Apps" → "Create App"
3. Selecciona el tipo de app: **Business**
4. Completa el formulario:
   - **Display Name**: ZIA Bot
   - **App Contact Email**: tu email
5. Click en "Create App"

## 2. Configurar productos de Facebook

### a) Agregar Facebook Login

1. En el dashboard de tu app, busca "Facebook Login"
2. Click en "Set Up"
3. Selecciona "Web" como plataforma
4. En "Valid OAuth Redirect URIs", agrega:
   ```
   http://localhost:8000/auth/facebook/callback
   https://tu-dominio.com/auth/facebook/callback
   ```

### b) Agregar Messenger

1. Busca "Messenger" en productos
2. Click en "Set Up"
3. Esto te permite recibir mensajes de Facebook

### c) Agregar Instagram

1. Busca "Instagram" en productos
2. Click en "Set Up"
3. Esto te permite recibir mensajes de Instagram

## 3. Configurar Webhooks

### Para Facebook Messenger

1. Ve a Messenger → Settings → Webhooks
2. Click en "Add Callback URL"
3. Agrega:
   - **Callback URL**: `https://tu-dominio.com/v1/meta/webhook`
   - **Verify Token**: El mismo valor que pusiste en `META_VERIFY_TOKEN` en tu `.env`
4. Click en "Verify and Save"
5. Suscríbete a los siguientes eventos:
   - `messages`
   - `messaging_postbacks`
   - `message_deliveries`
   - `message_reads`

### Para Instagram

1. Ve a Instagram → Settings → Webhooks
2. Sigue los mismos pasos que para Messenger
3. Suscríbete a:
   - `messages`
   - `messaging_postbacks`

### Para Feed (comentarios de Facebook)

1. Ve a Webhooks
2. Suscríbete al objeto "Page"
3. Selecciona:
   - `feed`
   - `comments`

## 4. Obtener credenciales

1. Ve a Settings → Basic en tu app de Facebook
2. Copia:
   - **App ID** → Variable `META_APP_ID`
   - **App Secret** → Variable `META_APP_SECRET` (click "Show")

## 5. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto con:

```bash
# Facebook/Meta OAuth
META_APP_ID=tu-app-id-aqui
META_APP_SECRET=tu-app-secret-aqui
META_VERIFY_TOKEN=un-token-secreto-que-tu-elijas
FACEBOOK_REDIRECT_URI=http://localhost:8000/auth/facebook/callback
FRONTEND_URL=http://localhost:5173
```

## 6. Permisos necesarios

Tu app necesita solicitar los siguientes permisos:

- `pages_show_list` - Ver lista de páginas
- `pages_read_engagement` - Leer engagement de páginas
- `pages_manage_metadata` - Gestionar metadata
- `pages_messaging` - Enviar/recibir mensajes en Messenger
- `instagram_basic` - Acceso básico a Instagram
- `instagram_manage_messages` - Gestionar mensajes de Instagram
- `instagram_manage_comments` - Gestionar comentarios de Instagram

## 7. Modo de desarrollo vs Producción

### Desarrollo

- Tu app está en "Development Mode"
- Solo tú y los usuarios agregados como testers pueden usarla
- Útil para probar

### Producción

Para que otros usuarios puedan conectar sus páginas:

1. Completa "App Review" en el panel de Facebook
2. Solicita permisos avanzados (pueden tardar días en aprobar)
3. Cambia el modo a "Live"

## 8. Conectar una página

Una vez configurado todo:

1. Inicia sesión en el dashboard de ZIA
2. Ve a "Integraciones"
3. Click en "Conectar con Facebook"
4. Autoriza los permisos
5. ¡Listo! Tu bot responderá automáticamente en Facebook e Instagram

## 9. Verificar que funciona

### Test de webhook

```bash
curl -X POST "https://tu-dominio.com/v1/meta/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "messaging": [{
        "sender": {"id": "123"},
        "recipient": {"id": "456"},
        "message": {"text": "Hola"}
      }]
    }]
  }'
```

### Test de conexión

1. Ve al endpoint: `GET /v1/admin/meta/diagnostics?tenant=tu-tenant`
2. Verifica que todos los valores estén configurados

## Troubleshooting

### Error: "Invalid OAuth redirect URI"

- Verifica que la URL en `FACEBOOK_REDIRECT_URI` esté exactamente igual en Facebook App Settings
- Asegúrate de incluir el protocolo (`http://` o `https://`)

### Error: "Missing authorization"

- Verifica que `AUTH_SECRET` esté configurado
- Asegúrate de estar enviando el token de autorización en los headers

### No recibo mensajes

- Verifica que los webhooks estén suscritos correctamente
- Revisa que `META_VERIFY_TOKEN` sea el mismo en ambos lados
- Checa los logs del servidor

### Instagram no aparece

- Asegúrate de que tu página de Facebook tenga una cuenta de Instagram Business conectada
- La cuenta debe ser de tipo "Business", no "Creator" o "Personal"

## Recursos adicionales

- [Facebook Developer Docs](https://developers.facebook.com/docs/)
- [Messenger Platform](https://developers.facebook.com/docs/messenger-platform/)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api/)
