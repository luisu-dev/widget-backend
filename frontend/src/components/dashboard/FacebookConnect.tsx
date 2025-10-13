import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

interface Tenant {
  settings?: {
    fb_page_id?: string
    fb_page_token?: string
    fb_page_name?: string
    ig_user_id?: string
    ig_user_ids?: string[]
    [key: string]: any
  }
}

interface FacebookConnectProps {
  token: string
  tenant: Tenant
}

export default function FacebookConnect({ token, tenant }: FacebookConnectProps) {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('facebook_connected') === 'true') {
      setSuccess('¡Facebook conectado exitosamente!')
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => setSuccess(''), 5000)
    }
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/facebook/connect`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al iniciar conexión con Facebook')
      const data = await res.json()
      window.location.href = data.auth_url
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('¿Estás seguro de desconectar Facebook? Dejarás de recibir mensajes de Facebook e Instagram.')) {
      return
    }

    setDisconnecting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/facebook/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al desconectar Facebook')

      setSuccess('Facebook desconectado correctamente')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setDisconnecting(false)
    }
  }

  // Multi-tenant: leer desde settings
  const settings = tenant.settings || {}
  const isConnected = settings.fb_page_id && settings.fb_page_token

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
      <h3 className="text-xl font-semibold text-white mb-4">Conexión con Facebook</h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/50 text-green-200 text-sm">
          {success}
        </div>
      )}

      {isConnected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 font-medium">Conectado</span>
          </div>

          {/* Facebook Page Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <div className="flex-1">
                <div className="text-sm text-gray-400">Página de Facebook</div>
                <div className="text-white font-medium">
                  {settings.fb_page_name || 'Página conectada'}
                </div>
              </div>
            </div>
            {settings.fb_page_id && (
              <div className="text-xs text-gray-400 font-mono">
                ID: {settings.fb_page_id}
              </div>
            )}
          </div>

          {/* Instagram Info */}
          {settings.ig_user_id && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                </svg>
                <div className="flex-1">
                  <div className="text-sm text-gray-400">Instagram Business</div>
                  <div className="text-white font-medium">Conectado</div>
                </div>
              </div>
            </div>
          )}

          {/* Connected features */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="text-sm font-medium text-white mb-3">Funcionalidades activas:</div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-gray-300">
                <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Mensajes directos de Facebook
              </li>
              {settings.ig_user_id && (
                <li className="flex items-center gap-2 text-gray-300">
                  <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mensajes directos de Instagram
                </li>
              )}
              <li className="flex items-center gap-2 text-gray-300">
                <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Respuestas automáticas con IA
              </li>
            </ul>
          </div>

          <div className="pt-4">
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 rounded-lg transition disabled:opacity-50"
            >
              {disconnecting ? 'Desconectando...' : 'Desconectar Facebook'}
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Esto desconectará tanto Facebook como Instagram de tu cuenta.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span className="text-gray-400">No conectado</span>
          </div>

          <p className="text-gray-300">
            Conecta tu página de Facebook para recibir y responder mensajes automáticamente.
          </p>

          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Mensajes directos de Facebook
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Mensajes directos de Instagram
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Comentarios en publicaciones
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Respuestas automáticas con IA
            </li>
          </ul>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? 'Conectando...' : 'Conectar con Facebook'}
          </button>
        </div>
      )}
    </div>
  )
}
