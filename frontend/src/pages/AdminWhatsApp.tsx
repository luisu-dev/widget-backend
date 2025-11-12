import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://acidia.app';

interface Tenant {
  slug: string;
  name: string;
  owner_user_id: number;
  whatsapp_configured: boolean;
  whatsapp_from?: string;
}

export default function AdminWhatsApp() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

  const [twilioForm, setTwilioForm] = useState({
    account_sid: '',
    auth_token: '',
    whatsapp_from: ''
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || localStorage.getItem('zia_token');
    if (!storedToken) {
      navigate('/login', { state: { from: { pathname: '/admin/whatsapp' } } });
      return;
    }
    setToken(storedToken);
    fetchTenants(storedToken);
  }, [navigate]);

  const fetchTenants = async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/tenants`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();

        // Los tenants ya vienen con integrations.whatsapp del endpoint
        const tenantsWithStatus = data.tenants.map((tenant: any) => ({
          ...tenant,
          whatsapp_configured: tenant.integrations?.whatsapp || false,
          whatsapp_from: tenant.whatsapp || null
        }));

        setTenants(tenantsWithStatus);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureTwilio = async () => {
    if (!selectedTenant) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/twilio/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(twilioForm)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Error al configurar Twilio');
      }

      const data = await res.json();
      alert(`✓ Configuración exitosa para ${selectedTenant}\n\nWebhook URL:\n${data.webhook_url}\n\nConfigura esta URL en Twilio Console.`);

      // Reset form and refresh
      setTwilioForm({ account_sid: '', auth_token: '', whatsapp_from: '' });
      setSelectedTenant(null);
      await fetchTenants(token);
    } catch (error: any) {
      console.error('Error configuring Twilio:', error);
      alert(error.message || 'Error al configurar Twilio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white text-sm mb-4"
            >
              ← Volver al Dashboard
            </button>
            <h1 className="text-3xl font-bold text-white mb-2">Admin: Configuración WhatsApp</h1>
            <p className="text-gray-400">Configura las credenciales de Twilio para cada marca/tenant</p>
          </div>

          {/* Tenants List */}
          <div className="bg-black/40 backdrop-blur border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Marcas Disponibles</h2>

            {loading && !tenants.length ? (
              <div className="text-gray-400 text-center py-4">Cargando...</div>
            ) : tenants.length === 0 ? (
              <div className="text-gray-400 text-center py-4">No hay marcas configuradas</div>
            ) : (
              <div className="space-y-3">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.slug}
                    className={`p-4 rounded-lg border transition ${
                      selectedTenant === tenant.slug
                        ? 'bg-[#04d9b5]/10 border-[#04d9b5]/40'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-white font-medium">{tenant.name}</h3>
                          <span className="text-xs text-gray-500">{tenant.slug}</span>
                          {tenant.whatsapp_configured && (
                            <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                              ✓ Configurado
                            </span>
                          )}
                        </div>
                        {tenant.whatsapp_from && (
                          <div className="text-xs text-gray-400 mt-1 font-mono">
                            {tenant.whatsapp_from}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTenant(tenant.slug);
                          setTwilioForm({ account_sid: '', auth_token: '', whatsapp_from: '' });
                        }}
                        className="px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm"
                      >
                        {tenant.whatsapp_configured ? 'Reconfigurar' : 'Configurar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configuration Form */}
          {selectedTenant && (
            <div className="bg-black/40 backdrop-blur border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  Configurar Twilio para: {tenants.find(t => t.slug === selectedTenant)?.name}
                </h2>
                <button
                  onClick={() => setSelectedTenant(null)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Cancelar
                </button>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
                <p className="text-blue-300 text-sm">
                  Ingresa las credenciales de Twilio para esta marca. Encuéntralas en:{' '}
                  <a
                    href="https://console.twilio.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    console.twilio.com
                  </a>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Account SID *</label>
                  <input
                    type="text"
                    value={twilioForm.account_sid}
                    onChange={(e) => setTwilioForm({ ...twilioForm, account_sid: e.target.value })}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#04d9b5] font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Auth Token *</label>
                  <input
                    type="password"
                    value={twilioForm.auth_token}
                    onChange={(e) => setTwilioForm({ ...twilioForm, auth_token: e.target.value })}
                    placeholder="********************************"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#04d9b5] font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">WhatsApp From Number *</label>
                  <input
                    type="text"
                    value={twilioForm.whatsapp_from}
                    onChange={(e) => setTwilioForm({ ...twilioForm, whatsapp_from: e.target.value })}
                    placeholder="whatsapp:+14155238886 o +521234567890"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#04d9b5] font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Para Sandbox: whatsapp:+14155238886 • Para número real: tu número de Twilio
                  </p>
                </div>

                <button
                  onClick={handleConfigureTwilio}
                  disabled={loading || !twilioForm.account_sid || !twilioForm.auth_token || !twilioForm.whatsapp_from}
                  className="w-full px-6 py-3 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 bg-black/40 backdrop-blur border border-white/10 rounded-xl p-6">
            <h3 className="text-white font-medium mb-3">Instrucciones:</h3>
            <ol className="space-y-2 text-sm text-gray-400">
              <li>1. Obtén las credenciales de Twilio desde console.twilio.com</li>
              <li>2. Selecciona la marca que quieres configurar</li>
              <li>3. Ingresa las credenciales y guarda</li>
              <li>4. Copia el Webhook URL que aparecerá</li>
              <li>5. Configura el webhook en Twilio Console → Messaging → Settings</li>
              <li>6. Prueba enviando un mensaje de WhatsApp al número configurado</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
