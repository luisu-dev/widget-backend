import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { API_BASE } from '../config'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const tokenMissing = !token.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (tokenMissing) {
      setError('Token inválido. Solicita un nuevo enlace.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.detail || 'No se pudo actualizar la contraseña')
      }
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'Error al restablecer la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Nueva contraseña</h1>
            <p className="text-gray-400">Define tu nueva contraseña de acceso.</p>
          </div>

          {done ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/40 text-green-200 text-sm">
                Tu contraseña se actualizó correctamente.
              </div>
              <Link
                to="/login"
                className="block w-full text-center py-3 px-4 bg-gradient-to-r from-[#04d9b5] to-cyan-400 text-black font-semibold rounded-lg hover:brightness-110 transition"
              >
                Ir a login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {tokenMissing && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm">
                  El enlace no incluye token. Solicita uno nuevo.
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Nueva contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#04d9b5] focus:border-transparent transition"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#04d9b5] focus:border-transparent transition"
                  placeholder="Repite la contraseña"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || tokenMissing}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#04d9b5] to-cyan-400 text-black font-semibold rounded-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-gray-400 hover:text-white transition">
              ← Volver a login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
