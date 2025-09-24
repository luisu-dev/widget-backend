import React, { useEffect, useState, useMemo } from 'react'

const API_BASE = '' // same origin; configure proxy in dev

function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem('zia_token') || '')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setProfile(null)
      return
    }
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) throw new Error('Sesión inválida')
        const data = await res.json()
        setProfile(data)
      } catch (err) {
        console.error(err)
        setToken('')
        localStorage.removeItem('zia_token')
        setError('Sesión expirada. Vuelve a iniciar sesión.')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  const login = async (email, password) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (!res.ok) throw new Error('Usuario o contraseña incorrectos')
      const data = await res.json()
      localStorage.setItem('zia_token', data.access_token)
      setToken(data.access_token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('zia_token')
    setToken('')
    setProfile(null)
  }

  return { token, profile, loading, error, login, logout }
}

function LoginView({ onLogin, loading, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e) => {
    e.preventDefault()
    onLogin(email, password)
  }

  return (
    <div className="auth-card">
      <h1>ZIA Dashboard</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function Nav({ current, onChange, tenantName, onLogout }) {
  const tabs = [
    { id: 'metrics', label: 'Métricas' },
    { id: 'messages', label: 'Mensajes' },
    { id: 'settings', label: 'Configuración' }
  ]
  return (
    <header className="app-header">
      <div>
        <h2>{tenantName || 'Tu workspace'}</h2>
      </div>
      <nav>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={current === tab.id ? 'active' : ''}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <button className="link" onClick={onLogout}>Cerrar sesión</button>
    </header>
  )
}

function MetricsView({ token }) {
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/v1/admin/metrics/overview?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) throw new Error('No se pudo obtener métricas')
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [token, days])

  if (loading && !data) return <p>Cargando métricas…</p>

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Resumen últimos {days} días</h3>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[7, 14, 30, 60, 90].map((d) => (
            <option key={d} value={d}>{d} días</option>
          ))}
        </select>
      </div>
      {data ? (
        <div className="metrics-grid">
          <MetricCard title="Conversaciones" value={data.messages.conversations} />
          <MetricCard title="Mensajes entrantes" value={data.messages.inbound} />
          <MetricCard title="Mensajes salientes" value={data.messages.outbound} />
          <MetricCard title="Leads" value={data.leads} />
          <MetricCard title="Tokens aprox." value={data.approxTokens} />
          <MetricCard title="WhatsApp enviados" value={data.actions.wa_out || 0} />
          <MetricCard title="Links de checkout" value={data.actions.checkout_link_out || 0} />
          <MetricCard title="Pagos completados" value={data.actions.stripe_checkout_completed || 0} />
        </div>
      ) : (
        <p>No hay datos en este rango.</p>
      )}
    </div>
  )
}

function MetricCard({ title, value }) {
  return (
    <div className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MessagesView({ token }) {
  const [channel, setChannel] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const query = new URLSearchParams({ limit: 50, ...(channel ? { channel } : {}) })
        const res = await fetch(`/v1/admin/messages?${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) throw new Error('No se pudo obtener mensajes')
        const json = await res.json()
        setItems(json.items)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [token, channel])

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Mensajes recientes</h3>
        <select value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Todos los canales</option>
          <option value="web">Web</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="facebook_dm">Facebook DM</option>
          <option value="instagram_dm">Instagram DM</option>
          <option value="facebook_comment">Facebook comentarios</option>
          <option value="instagram_comment">Instagram comentarios</option>
        </select>
      </div>
      {loading ? (
        <p>Cargando mensajes…</p>
      ) : (
        <ul className="message-list">
          {items.map((msg) => (
            <li key={msg.id}>
              <div className="meta">
                <span className={`tag ${msg.direction}`}>{msg.direction === 'in' ? 'Entrante' : 'Saliente'}</span>
                <span className="channel">{msg.channel}</span>
                <span className="date">{new Date(msg.created_at).toLocaleString()}</span>
              </div>
              <div className="body">{msg.content}</div>
              {msg.author && <div className="author">Autor: {msg.author}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SettingsView({ token, initialTenant }) {
  const [form, setForm] = useState({
    whatsapp: initialTenant?.tenant?.whatsapp || '',
    bot_enabled: tenant_botEnabled(initialTenant),
    settings: initialTenant?.tenant?.settings || {}
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setForm({
      whatsapp: initialTenant?.tenant?.whatsapp || '',
      bot_enabled: tenant_botEnabled(initialTenant),
      settings: initialTenant?.tenant?.settings || {}
    })
  }, [initialTenant])

  const toggleBot = () => {
    setForm((prev) => ({ ...prev, bot_enabled: !prev.bot_enabled }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const payload = {
      whatsapp: form.whatsapp,
      settings: {
        ...(form.settings || {}),
        bot_enabled: form.bot_enabled,
        whatsapp_link: form.settings?.whatsapp_link || undefined
      }
    }
    try {
      const res = await fetch('/v1/admin/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      setMessage('Guardado correctamente ✅')
    } catch (err) {
      console.error(err)
      setMessage('Error al guardar cambios')
    } finally {
      setSaving(false)
    }
  }

  const onFieldChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onLinkChange = (value) => {
    setForm((prev) => ({
      ...prev,
      settings: { ...(prev.settings || {}), whatsapp_link: value }
    }))
  }

  return (
    <div className="panel">
      <h3>Configuración del tenant</h3>
      <form className="settings-form" onSubmit={onSubmit}>
        <label>
          Número WhatsApp (E.164)
          <input
            value={form.whatsapp}
            onChange={(e) => onFieldChange('whatsapp', e.target.value)}
            placeholder="52155..."
          />
        </label>
        <label>
          Enlace directo WhatsApp
          <input
            value={form.settings?.whatsapp_link || ''}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder="https://wa.me/..."
          />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={form.bot_enabled} onChange={toggleBot} />
          <span>{form.bot_enabled ? 'Bot activo' : 'Bot desactivado'}</span>
        </label>
        <label>
          Mensaje cuando el bot está off
          <textarea
            value={form.settings?.bot_off_message || ''}
            onChange={(e) => setForm((prev) => ({
              ...prev,
              settings: { ...(prev.settings || {}), bot_off_message: e.target.value }
            }))}
            placeholder="El asistente está en pausa..."
          />
        </label>
        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        {message && <p>{message}</p>}
      </form>
    </div>
  )
}

function tenant_botEnabled(profile) {
  return !!(profile?.tenant?.settings?.bot_enabled ?? true)
}

function App() {
  const auth = useAuth()
  const [view, setView] = useState('metrics')

  useEffect(() => {
    if (!auth.profile) setView('metrics')
  }, [auth.profile])

  if (!auth.token || !auth.profile) {
    return <LoginView onLogin={auth.login} loading={auth.loading} error={auth.error} />
  }

  return (
    <div className="app">
      <Nav
        current={view}
        onChange={setView}
        tenantName={auth.profile?.tenant?.name}
        onLogout={auth.logout}
      />
      <main>
        {view === 'metrics' && <MetricsView token={auth.token} />}
        {view === 'messages' && <MessagesView token={auth.token} />}
        {view === 'settings' && <SettingsView token={auth.token} initialTenant={auth.profile} />}
      </main>
    </div>
  )
}

export default App
