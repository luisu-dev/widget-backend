import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { API_BASE } from '../config'

export default function ResetPassword() {
  const { t } = useTranslation()
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
      setError(t('auth.password_min_error'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('errors.password_mismatch'))
      return
    }
    if (tokenMissing) {
      setError(t('auth.token_invalid'))
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
        throw new Error(data?.detail || t('auth.reset_failed'))
      }
      setDone(true)
    } catch (err: any) {
      setError(err.message || t('auth.reset_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">{t('auth.reset_title')}</h1>
            <p className="text-gray-400">{t('auth.reset_subtitle')}</p>
          </div>

          {done ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/40 text-green-200 text-sm">
                {t('auth.password_updated')}
              </div>
              <Link
                to="/login"
                className="block w-full text-center py-3 px-4 bg-gradient-to-r from-[#04d9b5] to-cyan-400 text-black font-semibold rounded-lg hover:brightness-110 transition"
              >
                {t('auth.go_to_login')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {tokenMissing && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm">
                  {t('auth.token_missing')}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  {t('auth.new_password')}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#04d9b5] focus:border-transparent transition"
                  placeholder={t('auth.password_min_placeholder')}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  {t('auth.password_confirm')}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#04d9b5] focus:border-transparent transition"
                  placeholder={t('auth.repeat_password_placeholder')}
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
                {loading ? t('auth.updating_password') : t('auth.update_password')}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-gray-400 hover:text-white transition">
              ← {t('auth.back_to_login_short')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
