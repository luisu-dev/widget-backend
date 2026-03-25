import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../config'

interface Integrations {
  facebook: boolean
  stripe: boolean
  whatsapp: boolean
  catalog: boolean
  google_calendar: boolean
}

interface Tenant {
  id: number
  slug: string
  name: string
  owner_email: string | null
  created_at: string | null
  bot_enabled: boolean
  integrations: Integrations
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const token = localStorage.getItem('zia_token')

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null)

  const [form, setForm] = useState({ tenantSlug: '', email: '', password: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/v1/admin/all-tenants`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.status === 401) { navigate('/login'); return }
      if (res.status === 403) { setError('Tu usuario no tiene permisos de administrador.'); setLoading(false); return }
      if (!res.ok) throw new Error('Error al cargar tenants')
      const data = await res.json()
      setTenants(data.tenants)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleBot = async (slug: string) => {
    setTogglingSlug(slug)
    try {
      const res = await fetch(`${API_BASE}/v1/admin/tenants/${slug}/bot-toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al cambiar estado del bot')
      const data = await res.json()
      setTenants(prev => prev.map(t => t.slug === slug ? { ...t, bot_enabled: data.bot_enabled } : t))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTogglingSlug(null)
    }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let p = ''
    for (let i = 0; i < 12; i++) p += chars.charAt(Math.floor(Math.random() * chars.length))
    setForm(prev => ({ ...prev, password: p }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    setFormLoading(true)
    const tenantSlug = form.tenantSlug.trim().toLowerCase()
    if (!tenantSlug.match(/^[a-z0-9-]+$/)) {
      setFormError('El slug solo puede incluir letras minúsculas, números y guiones.')
      setFormLoading(false)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/v1/admin/create-user-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenant: tenantSlug, email: form.email.trim(), password: form.password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al crear el usuario')
      setFormSuccess(`Tenant "${tenantSlug}" creado para ${form.email}`)
      setForm({ tenantSlug: '', email: '', password: '' })
      fetchTenants()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const IntegrationBadge = ({ active, label }: { active: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      active
        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
        : 'bg-gray-700/50 text-gray-500 border border-gray-600/30'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
      {label}
    </span>
  )

  const Toggle = ({ enabled, busy, onChange }: { enabled: boolean; busy: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      disabled={busy}
      title={enabled ? 'Bot activo' : 'Bot desactivado'}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        enabled ? 'bg-cyan-500' : 'bg-gray-600'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        enabled ? 'translate-x-4' : 'translate-x-1'
      }`} />
    </button>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
            <p className="text-gray-400 mt-1">{loading ? '...' : `${tenants.length} tenants registrados`}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowModal(true); setFormError(''); setFormSuccess('') }}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition font-medium"
            >
              + Nuevo Tenant
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Tabla */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              Cargando tenants...
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              No hay tenants registrados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900/30">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tenant</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Owner</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Integraciones</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Suscripción</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {tenants.map(t => (
                    <tr key={t.slug} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{t.name}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{t.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-300">{t.owner_email || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <IntegrationBadge active={t.integrations.facebook} label="Facebook" />
                          <IntegrationBadge active={t.integrations.whatsapp} label="WhatsApp" />
                          <IntegrationBadge active={t.integrations.stripe} label="Stripe" />
                          <IntegrationBadge active={t.integrations.catalog} label="Catálogo" />
                          <IntegrationBadge active={t.integrations.google_calendar} label="Google Cal" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-300">{formatDate(t.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Toggle
                          enabled={t.bot_enabled}
                          busy={togglingSlug === t.slug}
                          onChange={() => toggleBot(t.slug)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal crear tenant */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Crear Nuevo Tenant</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tenant Slug *</label>
                <input
                  type="text" required
                  value={form.tenantSlug}
                  onChange={e => setForm(prev => ({ ...prev, tenantSlug: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                  placeholder="mi-empresa-2024"
                />
                <p className="mt-1 text-xs text-gray-500">Solo letras minúsculas, números y guiones</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                  placeholder="cliente@empresa.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña *</label>
                <div className="flex gap-2">
                  <input
                    type="text" required
                    value={form.password}
                    onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                    className="flex-1 px-4 py-2.5 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    placeholder="Contraseña temporal"
                  />
                  <button type="button" onClick={generatePassword}
                    className="px-3 py-2.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition text-sm whitespace-nowrap">
                    Generar
                  </button>
                </div>
              </div>

              {formSuccess && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500 rounded-lg text-emerald-300 text-sm">
                  {formSuccess}
                </div>
              )}
              {formError && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
                  Cancelar
                </button>
                <button type="submit" disabled={formLoading}
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition disabled:opacity-50">
                  {formLoading ? 'Creando...' : 'Crear Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
