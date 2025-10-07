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

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Configuración</h2>
              <p className="text-gray-400">Ajusta la configuración de tu tenant.</p>
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
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
