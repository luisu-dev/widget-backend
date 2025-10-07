# 💳 Stripe Multi-Tenant con Stripe Connect

## ✅ Implementación Correcta

El sistema usa **Stripe Connect**, que es el producto de Stripe específicamente diseñado para plataformas multi-tenant.

### 🎯 Arquitectura

```
Tu Plataforma (widget-backend)
├── STRIPE_SECRET_KEY en .env ← Tu cuenta de plataforma
└── Crea cuentas conectadas para tenants
    ├── Tenant A → settings.stripe_acct = "acct_111"
    ├── Tenant B → settings.stripe_acct = "acct_222"
    └── Tenant C → settings.stripe_acct = "acct_333"
```

### 💡 ¿Por qué STRIPE_SECRET_KEY está en .env?

Es **correcto** que esté ahí porque:

1. **Es la clave de tu plataforma**, no de los tenants
2. Permite crear cuentas Stripe Connect para cada tenant
3. Los pagos van **directo a cada tenant** (aislados)
4. Opcionalmente puedes cobrar una comisión

### 🔐 Aislamiento Multi-Tenant

**Cada tenant tiene su propia cuenta Stripe** en `settings`:

```json
{
  "stripe_acct": "acct_1234567890",  // ← Cuenta Stripe del tenant
  "stripe_prices": {
    "starter": "price_xxx",
    "meta": "price_yyy"
  }
}
```

## 🔄 Flujo Completo

### 1. Conectar Stripe (Por Tenant)

```http
GET /v1/stripe/connect/onboard?tenant=acidia
```

**Backend** (línea 2904):
```python
# Crea cuenta Stripe Connect para el tenant
account = stripe.Account.create(
    type="express",      # ← Express Account (recomendado)
    country="MX",
    capabilities={
        "card_payments": {"requested": True},
        "transfers": {"requested": True}
    }
)

# Guarda en settings del tenant
await update_tenant_settings(tenant, {
    "stripe_acct": account.id  # ← Aquí queda aislado
})

# Genera link de onboarding
link = stripe.AccountLink.create(
    account=account.id,
    type="account_onboarding"
)

return {"onboarding_url": link.url}
```

**Frontend**:
```typescript
// Usuario del tenant click "Conectar Stripe"
const res = await fetch('/v1/stripe/connect/onboard?tenant=acidia')
const { onboarding_url } = await res.json()

// Redirige a Stripe para completar onboarding
window.location.href = onboarding_url
```

### 2. Crear Checkout (Por Tenant)

```http
POST /v1/stripe/checkout/by-plan?tenant=acidia
{
  "plan": "starter",
  "quantity": 1
}
```

**Backend** (línea 2954):
```python
# Obtiene cuenta del tenant desde settings
acct = tenant["settings"]["stripe_acct"]

# Crea checkout EN LA CUENTA DEL TENANT
session = stripe.checkout.Session.create(
    mode="subscription",
    line_items=[{"price": price_id, "quantity": qty}],
    success_url=f"{SITE_URL}/pago-exitoso",
    cancel_url=f"{SITE_URL}/pago-cancelado",
    stripe_account=acct,  # ← Usa cuenta del tenant
    metadata={"tenant": tenant, "plan": plan}
)

return {"url": session.url}
```

**Resultado**: El dinero va directo a la cuenta del tenant.

### 3. Webhook (Identifica Tenant)

```http
POST /v1/stripe/webhook
```

**Backend** (línea 2965):
```python
# Stripe envía el account ID en el evento
event = stripe.Webhook.construct_event(body, signature, WEBHOOK_SECRET)
acct = event.get("account")  # "acct_1234567890"

# Busca a qué tenant pertenece esa cuenta
tenant_slug = await find_tenant_by_acct(acct)

# Procesa el evento para ese tenant específico
if event["type"] == "checkout.session.completed":
    # Registrar pago para el tenant correcto
    await store_event(tenant_slug, "stripe_checkout_completed", {...})
```

## 💰 Flujo de Dinero

### Sin Application Fee (Default)

```
Cliente paga $100 → Stripe toma comisión (~3%) → Tenant recibe ~$97
                                                  ↓
                                         (Plataforma: $0)
```

### Con Application Fee (Opcional)

```python
session = stripe.checkout.Session.create(
    stripe_account=tenant_account,
    payment_intent_data={
        "application_fee_amount": 1000,  # $10 en centavos
    },
    ...
)
```

```
Cliente paga $100 → Stripe ~$3 → Tenant $87 + Plataforma $10
```

## 📊 Tipos de Cuentas Stripe

### Express (Recomendado) ✅
- **Onboarding rápido** (minutos)
- Stripe maneja compliance
- UI de Stripe
- Ideal para multi-tenant

### Standard
- Control total
- Más complejo
- El tenant maneja todo

### Custom
- Máximo control
- Tu plataforma maneja UI completa
- Más responsabilidad legal

## 🔧 Endpoints Disponibles

### Conectar Stripe
```http
GET /v1/stripe/connect/onboard?tenant=acidia
→ {"onboarding_url": "https://connect.stripe.com/..."}
```

### Crear Checkout
```http
POST /v1/stripe/checkout/by-plan?tenant=acidia
{
  "plan": "starter",
  "quantity": 1
}
→ {"url": "https://checkout.stripe.com/..."}
```

### Webhook
```http
POST /v1/stripe/webhook
→ Procesa eventos por tenant
```

## 🎨 Integración en Dashboard

Agregar tab "Pagos" en Dashboard:

```typescript
// frontend/src/pages/Dashboard.tsx
function PaymentsView({ token, tenant }: Props) {
  const [connecting, setConnecting] = useState(false)
  
  const handleConnectStripe = async () => {
    const res = await fetch(
      `/v1/stripe/connect/onboard?tenant=${tenant.slug}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const { onboarding_url } = await res.json()
    window.location.href = onboarding_url
  }
  
  const isConnected = tenant.settings?.stripe_acct
  
  return (
    <div>
      {isConnected ? (
        <div>
          ✅ Stripe Conectado
          <p>Account ID: {tenant.settings.stripe_acct}</p>
        </div>
      ) : (
        <button onClick={handleConnectStripe}>
          Conectar Stripe
        </button>
      )}
    </div>
  )
}
```

## 🧪 Testing

### 1. Conectar cuenta de prueba

```bash
# Iniciar onboarding
curl http://localhost:8000/v1/stripe/connect/onboard?tenant=acidia

# Abre la URL en navegador
# Usa datos de prueba de Stripe
```

### 2. Crear checkout de prueba

```bash
curl -X POST http://localhost:8000/v1/stripe/checkout/by-plan?tenant=acidia \
  -H "Content-Type: application/json" \
  -d '{"plan":"starter","quantity":1}'
```

### 3. Probar tarjeta

```
Número: 4242 4242 4242 4242
Exp: 12/34
CVC: 123
```

## 🔐 Seguridad Multi-Tenant

### ✅ Correcto (Aislamiento)

```python
# Cada checkout usa la cuenta del tenant
stripe.checkout.Session.create(
    stripe_account=tenant.settings["stripe_acct"],  # ← Aislado
    ...
)
```

### ❌ Incorrecto (Compartido)

```python
# ¡NO HACER! Todos los pagos irían a tu cuenta
stripe.checkout.Session.create(
    # Sin stripe_account, usa la cuenta por defecto
    ...
)
```

## 📚 Recursos

- [Stripe Connect Docs](https://stripe.com/docs/connect)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Testing Connect](https://stripe.com/docs/connect/testing)

## ✨ Mejoras Futuras

1. **Dashboard de pagos**: Mostrar transacciones por tenant
2. **Múltiples cuentas**: Permitir múltiples cuentas Stripe por tenant
3. **Informes**: Analytics de ingresos por tenant
4. **Comisiones dinámicas**: Application fee configurable por tenant
5. **Webhook logs**: Auditoría de eventos de Stripe

---

✅ **Stripe Multi-Tenant correctamente implementado con Stripe Connect**
