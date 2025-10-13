import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FacebookConnect from '../components/dashboard/FacebookConnect';

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

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
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
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, navigate]);

  // Fetch messages when switching to messages tab
  useEffect(() => {
    if (activeTab === 'messages' && token) {
      fetchMessages();
    }
  }, [activeTab, token]);

  // Fetch metrics when switching to metrics tab
  useEffect(() => {
    if (activeTab === 'metrics' && token) {
      fetchMetrics();
    }
  }, [activeTab, token]);

  // Set bot enabled state from profile
  useEffect(() => {
    if (profile?.tenant?.settings?.bot_enabled !== undefined) {
      setBotEnabled(profile.tenant.settings.bot_enabled);
    }
  }, [profile]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/messages?limit=50`, {
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

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/metrics/overview?days=7`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar métricas');
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Error al cargar métricas');
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

            <FacebookConnect token={token} tenant={profile.tenant} />
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Conversaciones</h2>
                <p className="text-gray-400">Mensajes recibidos de tus clientes</p>
              </div>
              <button
                onClick={fetchMessages}
                className="px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
              >
                Actualizar
              </button>
            </div>

            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  No hay mensajes aún
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {messages.map((msg) => (
                    <div key={msg.id} className="p-4 hover:bg-white/5 transition">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            msg.direction === 'in'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-green-500/20 text-green-300'
                          }`}>
                            {msg.direction === 'in' ? 'Recibido' : 'Enviado'}
                          </span>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                            {msg.channel}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.created_at).toLocaleString('es-MX')}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mb-1">
                        Sesión: <span className="text-white font-mono text-xs">{msg.session_id}</span>
                        {msg.author && <span className="ml-2">• {msg.author}</span>}
                      </div>
                      <p className="text-white">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                  <div className="text-3xl font-bold text-white">{metrics.conversations || 0}</div>
                </div>
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                  <div className="text-gray-400 text-sm mb-2">Mensajes Recibidos</div>
                  <div className="text-3xl font-bold text-white">{metrics.inbound || 0}</div>
                </div>
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                  <div className="text-gray-400 text-sm mb-2">Mensajes Enviados</div>
                  <div className="text-3xl font-bold text-white">{metrics.outbound || 0}</div>
                </div>
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                  <div className="text-gray-400 text-sm mb-2">Tokens Aprox.</div>
                  <div className="text-3xl font-bold text-white">{metrics.tokens?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                  <div className="text-gray-400 text-sm mb-2">Leads Capturados</div>
                  <div className="text-3xl font-bold text-white">{metrics.leads || 0}</div>
                </div>
                {metrics.actions && metrics.actions.map((action: any) => (
                  <div key={action.type} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                    <div className="text-gray-400 text-sm mb-2 capitalize">
                      {action.type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-3xl font-bold text-white">{action.c || 0}</div>
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
