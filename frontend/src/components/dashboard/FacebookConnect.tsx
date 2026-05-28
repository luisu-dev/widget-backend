import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { API_BASE } from '../../config'

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

interface InstagramProfile {
  id: string
  username: string
  name?: string
  biography?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
  profile_picture_url?: string
}

interface InstagramMedia {
  id: string
  caption?: string
  media_type: string
  media_url?: string
  permalink: string
  thumbnail_url?: string
  timestamp: string
  username?: string
}

interface FacebookConnectProps {
  token: string
  onConnectionChange?: () => void
}

export default function FacebookConnect({ token, onConnectionChange }: FacebookConnectProps) {
  const { t } = useTranslation()
  const [connecting, setConnecting] = useState(false)
  const [connectingInstagram, setConnectingInstagram] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pages, setPages] = useState<FacebookPage[]>([])
  const [loading, setLoading] = useState(true)

  // Instagram data
  const [expandedIgPages, setExpandedIgPages] = useState<Set<string>>(new Set())
  const [igProfiles, setIgProfiles] = useState<Record<string, InstagramProfile>>({})
  const [igMedia, setIgMedia] = useState<Record<string, InstagramMedia[]>>({})
  const [loadingIgData, setLoadingIgData] = useState<Set<string>>(new Set())

  // Cargar páginas de Facebook
  const fetchPages = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/facebook/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(t('facebook.pages_loaded_error'))
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

  // Fetch Instagram profile data
  const fetchInstagramProfile = async (igUserId: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/instagram/profile/${igUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al cargar perfil de Instagram')
      const data = await res.json()
      setIgProfiles(prev => ({ ...prev, [igUserId]: data.profile }))
    } catch (err: any) {
      console.error('Error fetching Instagram profile:', err)
    }
  }

  // Fetch Instagram media
  const fetchInstagramMedia = async (igUserId: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/instagram/media/${igUserId}?limit=12`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al cargar medios de Instagram')
      const data = await res.json()
      setIgMedia(prev => ({ ...prev, [igUserId]: data.media }))
    } catch (err: any) {
      console.error('Error fetching Instagram media:', err)
    }
  }

  // Toggle Instagram details expansion
  const toggleInstagramDetails = async (igUserId: string) => {
    const newExpanded = new Set(expandedIgPages)

    if (newExpanded.has(igUserId)) {
      newExpanded.delete(igUserId)
    } else {
      newExpanded.add(igUserId)

      // Load data if not already loaded
      if (!igProfiles[igUserId] || !igMedia[igUserId]) {
        setLoadingIgData(prev => new Set(prev).add(igUserId))

        await Promise.all([
          !igProfiles[igUserId] && fetchInstagramProfile(igUserId),
          !igMedia[igUserId] && fetchInstagramMedia(igUserId)
        ])

        setLoadingIgData(prev => {
          const next = new Set(prev)
          next.delete(igUserId)
          return next
        })
      }
    }

    setExpandedIgPages(newExpanded)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('facebook_connected') === 'true') {
      setSuccess(t('facebook.connected_updating'))
      window.history.replaceState({}, '', window.location.pathname)

      // Recargar páginas
      setTimeout(() => {
        fetchPages()
        if (onConnectionChange) {
          onConnectionChange()
        }
        setSuccess(t('facebook.connected_success'))
      }, 1000)
    }
    if (params.get('instagram_connected') === 'true') {
      setSuccess(t('facebook.instagram_connected_updating'))
      window.history.replaceState({}, '', window.location.pathname)

      setTimeout(() => {
        fetchPages()
        if (onConnectionChange) {
          onConnectionChange()
        }
        setSuccess(t('facebook.instagram_connected_success'))
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
      if (!res.ok) throw new Error(t('facebook.connect_error'))
      const data = await res.json()
      window.location.href = data.auth_url
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setConnecting(false)
    }
  }

  const handleConnectInstagram = async () => {
    setConnectingInstagram(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/instagram/connect`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(t('facebook.instagram_connect_error'))
      const data = await res.json()
      window.location.href = data.auth_url
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setConnectingInstagram(false)
    }
  }

  const handleActivatePage = async (pageId: string) => {
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/facebook/pages/${pageId}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(t('facebook.activate_error'))

      setSuccess(t('facebook.page_activated'))
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
    if (!confirm(t('facebook.disconnect_confirm'))) {
      return
    }

    setDisconnecting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/facebook/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(t('facebook.disconnect_error'))

      setSuccess(t('facebook.disconnect_success'))
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

  // Mostrar conexiones sociales del tenant sin duplicar Instagram directo si ya viene ligado a Facebook.
  const isInstagramLoginPage = (page: FacebookPage) => page.page_id.startsWith('ig:')
  const normalizeConnectionName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const linkedFacebookNames = new Set(
    pages
      .filter(page => !isInstagramLoginPage(page) && page.ig_user_id)
      .map(page => normalizeConnectionName(page.page_name))
  )
  const displayPages = pages.filter(page => {
    if (!isInstagramLoginPage(page)) return true
    return !linkedFacebookNames.has(normalizeConnectionName(page.page_name))
  })
  const activePage = displayPages.find(p => p.is_active) || displayPages[0]
  const isConnected = displayPages.length > 0
  const facebookPagesCount = displayPages.filter(page => !isInstagramLoginPage(page)).length
  const instagramAccountsCount = displayPages.filter(page => isInstagramLoginPage(page)).length
  const onlyInstagramConnected = facebookPagesCount === 0 && instagramAccountsCount > 0
  const sectionTitle = onlyInstagramConnected
    ? t('facebook.instagram_title')
    : instagramAccountsCount > 0
      ? t('facebook.social_title')
      : t('facebook.title')
  const connectionCountLabel = facebookPagesCount > 0 && instagramAccountsCount > 0
    ? t('facebook.accounts_count', { facebook: facebookPagesCount, instagram: instagramAccountsCount })
    : instagramAccountsCount > 0
      ? t('facebook.instagram_accounts_count', { count: instagramAccountsCount })
      : t('facebook.pages_count', { count: facebookPagesCount })

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">{sectionTitle}</h3>
        <div className="text-center text-gray-400">{t('facebook.loading')}</div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
      <h3 className="text-xl font-semibold text-white mb-4">{sectionTitle}</h3>

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
            <span className="text-green-400 font-medium">{connectionCountLabel}</span>
          </div>

          {/* Lista de páginas */}
          <div className="space-y-3">
            {displayPages.map((page) => (
              <div
                key={page.page_id}
                className={`border rounded-lg p-4 ${
                  page.is_active
                    ? isInstagramLoginPage(page)
                      ? 'bg-purple-500/10 border-purple-500/30'
                      : 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    {isInstagramLoginPage(page) ? (
                      <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    )}
                    <div className="flex-1">
                      <div className="text-white font-medium">{page.page_name}</div>
                      <div className="text-xs text-gray-400">
                        {isInstagramLoginPage(page) ? t('facebook.instagram_account') : t('facebook.facebook_page')}
                        <span className="font-mono"> · ID: {page.page_id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {page.ig_user_id && (
                      <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                        {isInstagramLoginPage(page) ? t('facebook.instagram_login_badge') : 'IG'}
                      </span>
                    )}
                    {page.is_active && (
                      <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
                        {t('facebook.active_for_tenant')}
                      </span>
                    )}
                  </div>
                </div>

                {page.ig_user_id && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <button
                      onClick={() => toggleInstagramDetails(page.ig_user_id!)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-2 text-sm text-purple-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                        </svg>
                        <span className="font-medium">{t('facebook.view_instagram')}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-purple-400 transition-transform ${
                          expandedIgPages.has(page.ig_user_id) ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Instagram Details (expandable) */}
                    {expandedIgPages.has(page.ig_user_id) && (
                      <div className="mt-3 space-y-4">
                        {loadingIgData.has(page.ig_user_id) ? (
                          <div className="text-center text-gray-400 py-4">
                            {t('facebook.loading_instagram')}
                          </div>
                        ) : (
                          <>
                            {/* Instagram Profile */}
                            {igProfiles[page.ig_user_id] && (
                              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-4">
                                <div className="flex items-start gap-4">
                                  {igProfiles[page.ig_user_id].profile_picture_url && (
                                    <img
                                      src={igProfiles[page.ig_user_id].profile_picture_url}
                                      alt="Profile"
                                      className="w-16 h-16 rounded-full border-2 border-purple-400"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <div className="text-white font-semibold text-lg">
                                      {igProfiles[page.ig_user_id].name || igProfiles[page.ig_user_id].username}
                                    </div>
                                    <div className="text-purple-300 text-sm">
                                      @{igProfiles[page.ig_user_id].username}
                                    </div>
                                    {igProfiles[page.ig_user_id].biography && (
                                      <div className="text-gray-300 text-xs mt-2">
                                        {igProfiles[page.ig_user_id].biography}
                                      </div>
                                    )}
                                    <div className="flex gap-4 mt-3 text-xs">
                                      <div className="text-white">
                                        <span className="font-bold">{(igProfiles[page.ig_user_id].media_count ?? 0).toLocaleString()}</span> {t('facebook.posts')}
                                      </div>
                                      <div className="text-white">
                                        <span className="font-bold">{(igProfiles[page.ig_user_id].followers_count ?? 0).toLocaleString()}</span> {t('facebook.followers')}
                                      </div>
                                      <div className="text-white">
                                        <span className="font-bold">{(igProfiles[page.ig_user_id].follows_count ?? 0).toLocaleString()}</span> {t('facebook.following')}
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2 font-mono">
                                      ID: {igProfiles[page.ig_user_id].id}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Instagram Media Gallery */}
                            {igMedia[page.ig_user_id] && igMedia[page.ig_user_id].length > 0 && (
                              <div>
                                <div className="text-white text-sm font-medium mb-2">
                                  {t('facebook.recent_posts', { count: igMedia[page.ig_user_id].length })}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {igMedia[page.ig_user_id].slice(0, 9).map((media) => (
                                    <a
                                      key={media.id}
                                      href={media.permalink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="aspect-square relative group overflow-hidden rounded-lg border border-white/10 hover:border-purple-400/50 transition"
                                    >
                                      <img
                                        src={media.media_type === 'VIDEO' ? media.thumbnail_url : media.media_url}
                                        alt={media.caption?.substring(0, 50) || 'Instagram post'}
                                        className="w-full h-full object-cover"
                                      />
                                      {media.media_type === 'VIDEO' && (
                                        <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
                                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z"/>
                                          </svg>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                        <p className="text-white text-xs text-center line-clamp-3">
                                          {media.caption || t('facebook.no_description')}
                                        </p>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!page.is_active && (
                  <button
                    onClick={() => handleActivatePage(page.page_id)}
                    className="w-full mt-2 px-3 py-1.5 text-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-200 rounded transition"
                  >
                    {t('facebook.use_connection')}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Connected features */}
          {activePage && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-sm font-medium text-white mb-1">{t('facebook.active_connection', { page: activePage.page_name })}</div>
              <div className="text-xs text-gray-400 mb-3">{t('facebook.active_connection_help')}</div>
              <ul className="space-y-2 text-sm">
                {!isInstagramLoginPage(activePage) && (
                  <li className="flex items-center gap-2 text-gray-300">
                    <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('facebook.facebook_messages')}
                  </li>
                )}
                {activePage.ig_user_id && (
                  <li className="flex items-center gap-2 text-gray-300">
                    <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('facebook.instagram_messages')}
                  </li>
                )}
                <li className="flex items-center gap-2 text-gray-300">
                  <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('facebook.ai_replies')}
                </li>
              </ul>
            </div>
          )}

          <div className="pt-4 space-y-3">
            <div className={`grid gap-3 ${instagramAccountsCount > 0 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-200 rounded-lg transition disabled:opacity-50"
              >
                {connecting
                  ? t('facebook.changing')
                  : facebookPagesCount > 0
                    ? t('facebook.change_page')
                    : t('facebook.connect_button')}
              </button>
              {instagramAccountsCount === 0 && (
                <button
                  onClick={handleConnectInstagram}
                  disabled={connectingInstagram}
                  className="flex-1 px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 text-pink-100 rounded-lg transition disabled:opacity-50"
                >
                  {connectingInstagram ? t('facebook.changing_instagram') : t('facebook.connect_instagram')}
                </button>
              )}
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 rounded-lg transition disabled:opacity-50"
              >
                {disconnecting ? t('facebook.disconnecting') : t('facebook.disconnect')}
              </button>
            </div>
            <p className="text-sm text-gray-400">
              <strong>{facebookPagesCount > 0 ? t('facebook.change_page_help_title') : t('facebook.facebook_help_title')}</strong> {facebookPagesCount > 0 ? t('facebook.change_page_help') : t('facebook.facebook_help')}<br/>
              {instagramAccountsCount === 0 && (
                <>
                  <strong>{t('facebook.instagram_help_title')}</strong> {t('facebook.instagram_help')}<br/>
                </>
              )}
              <strong>{t('facebook.disconnect_help_title')}</strong> {t('facebook.disconnect_help')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span className="text-gray-400">{t('facebook.not_connected')}</span>
          </div>

          <p className="text-gray-300">
            {t('facebook.connect_intro')}
          </p>

          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('facebook.facebook_messages')}
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('facebook.instagram_messages')}
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('facebook.post_comments')}
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('facebook.ai_replies')}
            </li>
          </ul>

          <div className="grid gap-3 md:grid-cols-2">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? t('facebook.changing') : t('facebook.connect_button')}
            </button>
            <button
              onClick={handleConnectInstagram}
              disabled={connectingInstagram}
              className="w-full py-3 px-4 bg-gradient-to-r from-pink-600 to-purple-500 hover:from-pink-500 hover:to-purple-400 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connectingInstagram ? t('facebook.changing_instagram') : t('facebook.connect_instagram_direct')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
