import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FacebookConnect from '../components/dashboard/FacebookConnect';
import BrandConfig from '../components/dashboard/BrandConfig';

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface User {
  id: number;
  email: string;
  tenant: string;
  role: string;
}

interface Tenant {
  slug: string;
  name: string;
  whatsapp?: string;
  settings?: {
    bot_enabled?: boolean;
    whatsapp_link?: string;
    bot_off_message?: string;
    // Facebook/Instagram credentials (multi-tenant)
    fb_page_id?: string;
    fb_page_token?: string;
    fb_page_name?: string;
    ig_user_id?: string;
    ig_user_ids?: string[];
  };
}

interface Profile {
  user: User;
  tenant: Tenant;
}

function Dashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem('zia_token') || '');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('integrations');
  const [messages, setMessages] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [botEnabled, setBotEnabled] = useState(true);
  const [savingBotState, setSavingBotState] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [facebookPages, setFacebookPages] = useState<any[]>([]);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);

  const fetchProfile = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Sesión inválida');
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error(err);
      localStorage.removeItem('zia_token');
      navigate('/login');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchFacebookPages = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/facebook/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const pages = data.pages || [];
      setFacebookPages(pages);

      // Seleccionar la página activa por defecto
      const activePage = pages.find((p: any) => p.is_active);
      if (activePage) {
        setSelectedPage(activePage);
      } else if (pages.length > 0) {
        setSelectedPage(pages[0]);
      }
    } catch (err) {
      console.error('Error loading Facebook pages:', err);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    fetchProfile();
    fetchFacebookPages();
  }, [token, navigate]);

  // Fetch messages when switching to messages tab or changing selected page
  useEffect(() => {
    if (activeTab === 'messages' && token) {
      fetchMessages();
    }
  }, [activeTab, token, selectedPage]);

  // Fetch metrics when switching to metrics tab or changing selected page
  useEffect(() => {
    if (activeTab === 'metrics' && token) {
      fetchMetrics();
    }
  }, [activeTab, token, selectedPage]);

  // Set bot enabled state from profile
  useEffect(() => {
    if (profile?.tenant?.settings?.bot_enabled !== undefined) {
      setBotEnabled(profile.tenant.settings.bot_enabled);
    }
  }, [profile]);

  const fetchMessages = async () => {
    try {
      // Filtrar por página seleccionada si existe
      const pageParam = selectedPage ? `&page_id=${selectedPage.page_id}` : '';
      const res = await fetch(`${API_BASE}/v1/admin/messages?limit=200${pageParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar mensajes');
      const data = await res.json();
      setMessages(data.items || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Error al cargar mensajes');
    }
  };

  // Group messages by session
  const groupedConversations = () => {
    const groups: { [key: string]: any[] } = {};
    messages.forEach(msg => {
      if (!groups[msg.session_id]) {
        groups[msg.session_id] = [];
      }
      groups[msg.session_id].push(msg);
    });

    // Sort each group by created_at and get latest message time
    return Object.entries(groups)
      .map(([sessionId, msgs]) => {
        const sorted = msgs.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return {
          sessionId,
          messages: sorted,
          lastMessage: sorted[sorted.length - 1],
          messageCount: sorted.length
        };
      })
      .sort((a, b) =>
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
      );
  };

  const openConversation = (sessionId: string) => {
    setSelectedSession(sessionId);
    const conv = groupedConversations().find(c => c.sessionId === sessionId);
    if (conv) {
      setConversationMessages(conv.messages);
    }
  };

  const fetchMetrics = async () => {
    try {
      console.log('Fetching metrics...');
      // Filtrar por página seleccionada si existe
      const pageParam = selectedPage ? `&page_id=${selectedPage.page_id}` : '';
      const url = `${API_BASE}/v1/admin/metrics/overview?days=7${pageParam}`;
      console.log('Metrics URL:', url);
      console.log('Selected page:', selectedPage);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Metrics response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Metrics error response:', errorText);
        throw new Error('Error al cargar métricas');
      }

      const data = await res.json();
      console.log('Metrics data:', data);
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Error al cargar métricas');
      // Set empty metrics to avoid infinite loading
      setMetrics({
        messages: { inbound: 0, outbound: 0, conversations: 0 },
        approxTokens: 0,
        leads: 0,
        actions: {}
      });
    }
  };

  const toggleBot = async () => {
    setSavingBotState(true);
    try {
      const newState = !botEnabled;
      const res = await fetch(`${API_BASE}/v1/admin/tenant/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: { bot_enabled: newState }
        })
      });
      if (!res.ok) throw new Error('Error al actualizar configuración');
      setBotEnabled(newState);
      // Reload profile to get updated settings
      const profileRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Error toggling bot:', err);
      setError('Error al cambiar estado del bot');
    } finally {
      setSavingBotState(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zia_token');
    setToken('');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{profile.tenant.name || 'Dashboard'}</h1>
              <p className="text-sm text-gray-400">{profile.user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-white/10 bg-black/10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-4 py-4">
            {[
              { id: 'integrations', label: 'Integraciones' },
              { id: 'messages', label: 'Conversaciones' },
              { id: 'metrics', label: 'Métricas' },
              { id: 'settings', label: 'Configuración' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-[#04d9b5] text-black font-medium'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {/* Panel de Admin - solo para acid-ia */}
            {profile.tenant.slug === 'acid-ia' && (
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:from-purple-700 hover:to-pink-700 transition"
              >
                🔧 Admin Panel
              </button>
            )}

            {/* Indicador de página activa */}
            {facebookPages.length > 0 && selectedPage && (
              <div className="ml-auto flex items-center space-x-2">
                <span className="text-white/70 text-sm font-medium">Página:</span>
                {facebookPages.length === 1 ? (
                  // Si solo hay una página, mostrar un badge fijo
                  <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-2 border-purple-500/60 shadow-lg">
                    <span className="text-white text-sm font-bold">
                      {selectedPage.page_name} {selectedPage.ig_user_id ? '📷' : '👥'}
                    </span>
                  </div>
                ) : (
                  // Si hay múltiples páginas, mostrar dropdown
                  <select
                    value={selectedPage.page_id}
                    onChange={(e) => {
                      const page = facebookPages.find(p => p.page_id === e.target.value);
                      if (page) setSelectedPage(page);
                    }}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-2 border-purple-500/50 text-white text-sm font-medium focus:outline-none focus:border-[#04d9b5] hover:border-purple-400 transition shadow-lg cursor-pointer"
                  >
                    {facebookPages.map((page) => (
                      <option key={page.page_id} value={page.page_id} className="bg-gray-900 text-white font-medium">
                        {page.page_name} {page.ig_user_id ? '📷' : '👥'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200">
            {error}
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Integraciones</h2>
              <p className="text-gray-400">
                Conecta tus cuentas de redes sociales para recibir y responder mensajes automáticamente.
              </p>
            </div>

            <FacebookConnect
              token={token}
              onConnectionChange={() => {
                fetchProfile(false);
                fetchFacebookPages();
              }}
            />
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Conversaciones</h2>
                <p className="text-gray-400">
                  {selectedSession ? 'Mensajes de la conversación' : `${groupedConversations().length} conversaciones activas`}
                </p>
              </div>
              <div className="flex space-x-2">
                {selectedSession && (
                  <button
                    onClick={() => {
                      setSelectedSession(null);
                      setConversationMessages([]);
                    }}
                    className="px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
                  >
                    ← Volver
                  </button>
                )}
                <button
                  onClick={fetchMessages}
                  className="px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
                >
                  Actualizar
                </button>
              </div>
            </div>

            {/* Conversation List */}
            {!selectedSession && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedConversations().length === 0 ? (
                  <div className="col-span-full bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 text-center text-gray-400">
                    No hay conversaciones aún
                  </div>
                ) : (
                  groupedConversations().map((conv) => (
                    <div
                      key={conv.sessionId}
                      onClick={() => openConversation(conv.sessionId)}
                      className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                            {conv.lastMessage.channel}
                          </span>
                          <span className="text-xs text-gray-400">
                            {conv.messageCount} mensajes
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400 mb-2 truncate">
                        ID: {conv.sessionId.substring(0, 12)}...
                      </div>
                      <p className="text-white text-sm line-clamp-2 mb-2">
                        {conv.lastMessage.content}
                      </p>
                      <div className="text-xs text-gray-400">
                        {new Date(conv.lastMessage.created_at).toLocaleString('es-MX')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Conversation Detail */}
            {selectedSession && (
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <div className="text-sm text-gray-400">Sesión:</div>
                  <div className="text-white font-mono text-sm">{selectedSession}</div>
                </div>
                <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                  {conversationMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'in' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                          msg.direction === 'in'
                            ? 'bg-blue-500/20 text-blue-100'
                            : 'bg-[#04d9b5]/20 text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-medium opacity-70">
                            {msg.direction === 'in' ? msg.author || 'Cliente' : 'Bot'}
                          </span>
                          <span className="text-xs opacity-50">
                            {new Date(msg.created_at).toLocaleTimeString('es-MX')}
                          </span>
                        </div>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Métricas</h2>
                <p className="text-gray-400">Estadísticas de uso de los últimos 7 días</p>
              </div>
              <button
                onClick={fetchMetrics}
                className="px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
              >
                Actualizar
              </button>
            </div>

            {metrics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                  <div className="text-gray-400 text-sm mb-2">Conversaciones</div>
                  <div className="text-3xl font-bold text-white">
                    {metrics.messages?.conversations || 0}
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                  <div className="text-gray-400 text-sm mb-2">Mensajes Recibidos</div>
                  <div className="text-3xl font-bold text-white">
                    {metrics.messages?.inbound || 0}
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                  <div className="text-gray-400 text-sm mb-2">Mensajes Enviados</div>
                  <div className="text-3xl font-bold text-white">
                    {metrics.messages?.outbound || 0}
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                  <div className="text-gray-400 text-sm mb-2">Tokens Aprox.</div>
                  <div className="text-3xl font-bold text-white">
                    {metrics.approxTokens?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                  <div className="text-gray-400 text-sm mb-2">Leads Capturados</div>
                  <div className="text-3xl font-bold text-white">{metrics.leads || 0}</div>
                </div>
                {metrics.actions && Object.entries(metrics.actions).map(([type, count]: [string, any]) => (
                  <div key={type} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                    <div className="text-gray-400 text-sm mb-2 capitalize">
                      {type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-3xl font-bold text-white">{count || 0}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8">
                <div className="text-center text-gray-400">Cargando métricas...</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Configuración</h2>
              <p className="text-gray-400">Ajusta la configuración de tu tenant.</p>
            </div>

            {/* Brand Configuration */}
            {selectedPage && (
              <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-blue-200">
                  📄 Configurando: <strong>{selectedPage.page_name}</strong>
                  {selectedPage.ig_user_id && <span className="ml-2">📷 Instagram conectado</span>}
                </p>
              </div>
            )}
            <BrandConfig
              token={token}
              tenant={profile.tenant}
              selectedPage={selectedPage}
              onUpdate={() => {
                fetchProfile(false);
                fetchFacebookPages();
              }}
            />

            {/* Killswitch */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Control del Bot</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium mb-1">Estado del Bot de IA</p>
                  <p className="text-sm text-gray-400">
                    {botEnabled
                      ? 'El bot está respondiendo automáticamente a los mensajes'
                      : 'El bot está pausado. Los mensajes no recibirán respuesta automática'}
                  </p>
                </div>
                <button
                  onClick={toggleBot}
                  disabled={savingBotState}
                  className={`relative inline-flex h-12 w-24 items-center rounded-full transition ${
                    botEnabled ? 'bg-[#04d9b5]' : 'bg-gray-600'
                  } ${savingBotState ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-10 w-10 transform rounded-full bg-white transition ${
                      botEnabled ? 'translate-x-12' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-400">
                  💡 Usa el killswitch para pausar el bot cuando quieras responder manualmente a tus clientes
                </p>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Información del Tenant</h3>
              <div className="space-y-3 text-gray-300">
                <div>
                  <span className="text-gray-400">Nombre:</span>{' '}
                  <span className="text-white">{profile.tenant.name}</span>
                </div>
                <div>
                  <span className="text-gray-400">Slug:</span>{' '}
                  <span className="text-white">{profile.tenant.slug}</span>
                </div>
                {profile.tenant.whatsapp && (
                  <div>
                    <span className="text-gray-400">WhatsApp:</span>{' '}
                    <span className="text-white">{profile.tenant.whatsapp}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Bot Status:</span>{' '}
                  <span className={`font-semibold ${botEnabled ? 'text-[#04d9b5]' : 'text-orange-400'}`}>
                    {botEnabled ? 'Activo' : 'Pausado'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
