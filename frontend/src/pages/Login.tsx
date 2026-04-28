import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { API_BASE } from '../config'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!res.ok) {
        throw new Error('Usuario o contraseña incorrectos')
      }

      const data = await res.json()
      localStorage.setItem('zia_token', data.access_token)
      localStorage.setItem('token', data.access_token)

      const from = (location.state as any)?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--md-background)' }}
    >
      <div className="w-full max-w-[400px]">
        {/* Brand */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-[28px] mb-5"
            style={{ background: 'var(--md-primary-container)' }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M8 24L16 8L24 24"
                stroke="var(--md-on-primary-container)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.5 19h11"
                stroke="var(--md-on-primary-container)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1
            className="text-[28px] font-bold tracking-tight mb-1"
            style={{ color: 'var(--md-on-surface)' }}
          >
            Acid IA
          </h1>
          <p className="text-sm" style={{ color: 'var(--md-on-surface-variant)' }}>
            Inicia sesión para continuar
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-[28px] p-8"
          style={{
            background: 'var(--md-surface-container)',
            boxShadow: 'var(--md-elevation-2)'
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="md-field">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
              />
            </div>

            {/* Password */}
            <div className="md-field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
              <div className="mt-2 text-right">
                <Link
                  to="/forgot-password"
                  className="text-[13px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--md-primary)' }}
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div
                className="flex items-start gap-3 rounded-xl p-3"
                style={{
                  background: 'rgba(147,0,10,.25)',
                  border: '1px solid var(--md-error-container)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" stroke="var(--md-error)" strokeWidth="1.8"/>
                  <path d="M12 8v5" stroke="var(--md-error)" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="12" cy="16.5" r=".75" fill="var(--md-error)"/>
                </svg>
                <p className="text-sm" style={{ color: 'var(--md-error)' }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="md-btn-filled w-full py-3 text-[15px] mt-2"
            >
              {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--md-on-surface-variant)' }}
          >
            ← Volver al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
