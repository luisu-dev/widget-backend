import { useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../config'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (!res.ok) {
        throw new Error('No se pudo procesar la solicitud')
      }
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Error enviando correo de recuperación')
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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--md-on-primary-container)" strokeWidth="1.8"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="var(--md-on-primary-container)" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="1.5" fill="var(--md-on-primary-container)"/>
            </svg>
          </div>
          <h1
            className="text-[28px] font-bold tracking-tight mb-1"
            style={{ color: 'var(--md-on-surface)' }}
          >
            Recuperar contraseña
          </h1>
          <p className="text-sm" style={{ color: 'var(--md-on-surface-variant)' }}>
            Te enviaremos un enlace si tu correo existe
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
          {sent ? (
            <div className="space-y-5">
              {/* Success state */}
              <div
                className="flex items-start gap-3 rounded-xl p-4"
                style={{
                  background: 'rgba(0,55,48,.4)',
                  border: '1px solid var(--md-primary-container)'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" stroke="var(--md-primary)" strokeWidth="1.8"/>
                  <path d="M8 12l3 3 5-5" stroke="var(--md-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-sm" style={{ color: 'var(--md-on-primary-container)' }}>
                  Si el correo existe en nuestra plataforma, recibirás un enlace de recuperación.
                </p>
              </div>

              <Link
                to="/login"
                className="md-btn-filled w-full py-3 text-[15px] flex items-center justify-center"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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

              <button
                type="submit"
                disabled={loading}
                className="md-btn-filled w-full py-3 text-[15px]"
              >
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </form>
          )}
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--md-on-surface-variant)' }}
          >
            ← Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
