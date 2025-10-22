import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

interface FacebookPage {
  id: number
  page_id: string
  page_name: string
  ig_user_id?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
  tenant_slug?: string
}

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
  onConnectionChange?: () => void
}

export default function FacebookConnect({ token, tenant, onConnectionChange }: FacebookConnectProps) {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pages, setPages] = useState<FacebookPage[]>([])
  const [loading, setLoading] = useState(true)

  // Cargar páginas de Facebook
  const fetchPages = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/facebook/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al cargar páginas')
      const data = await res.json()
      const loadedPages = data.pages || []
      setPages(loadedPages)
    } catch (err: any) {
      console.error(err)
      setPages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPages()
  }, [token])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('facebook_connected') === 'true') {
      setSuccess('¡Facebook conectado exitosamente! Actualizando información...')
      window.history.replaceState({}, '', window.location.pathname)

      // Recargar páginas
      setTimeout(() => {
        fetchPages()
        if (onConnectionChange) {
          onConnectionChange()
        }
        setSuccess('¡Facebook conectado exitosamente!')
      }, 1000)
    }
  }, [onConnectionChange])

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

  const handleActivatePage = async (pageId: string) => {
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/facebook/pages/${pageId}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al activar página')

      setSuccess('Página activada correctamente')
      await fetchPages()
      if (onConnectionChange) {
        onConnectionChange()
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
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
      setTimeout(() => {
        if (onConnectionChange) {
          onConnectionChange()
        } else {
          window.location.reload()
        }
      }, 1500)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setDisconnecting(false)
    }
  }

  // Mostrar páginas de la cuenta de Facebook del usuario
  const isConnected = pages.length > 0
  const activePage = pages.find(p => p.is_active)

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Conexión con Facebook</h3>
        <div className="text-center text-gray-400">Cargando...</div>
      </div>
    )
  }

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
            <span className="text-green-400 font-medium">{pages.length} página(s) de tu cuenta de Facebook</span>
          </div>

          {/* Lista de páginas */}
          <div className="space-y-3">
            {pages.map((page) => (
              <div
                key={page.page_id}
                className={`border rounded-lg p-4 ${
                  page.is_active
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <div className="flex-1">
                      <div className="text-white font-medium">{page.page_name}</div>
                      <div className="text-xs text-gray-400 font-mono">ID: {page.page_id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {page.ig_user_id && (
                      <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                        📷 IG
                      </span>
                    )}
                    {page.is_active && (
                      <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
                        En uso
                      </span>
                    )}
                  </div>
                </div>

                {page.ig_user_id && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-purple-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                    </svg>
                    <span>Instagram conectado</span>
                  </div>
                )}

                {!page.is_active && (
                  <button
                    onClick={() => handleActivatePage(page.page_id)}
                    className="w-full mt-2 px-3 py-1.5 text-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-200 rounded transition"
                  >
                    Usar esta página
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Connected features */}
          {activePage && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-sm font-medium text-white mb-3">Funcionalidades activas con "{activePage.page_name}":</div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-gray-300">
                  <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mensajes directos de Facebook
                </li>
                {activePage.ig_user_id && (
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
          )}

          <div className="pt-4 space-y-3">
            <div className="flex gap-3">
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-200 rounded-lg transition disabled:opacity-50"
              >
                {connecting ? 'Conectando...' : 'Cambiar página'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 rounded-lg transition disabled:opacity-50"
              >
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
            <p className="text-sm text-gray-400">
              <strong>Cambiar página:</strong> Conecta una página diferente sin perder tu configuración.<br/>
              <strong>Desconectar:</strong> Elimina completamente la conexión con Facebook e Instagram.
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
