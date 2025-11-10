import { useState, useEffect } from 'react';
import FacebookConnect from './dashboard/FacebookConnect';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://acidia.app';

interface IntegrationsProps {
  token: string;
  onConnectionChange: () => void;
}

export default function Integrations({ token, onConnectionChange }: IntegrationsProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // WhatsApp activation form
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState({
    business_name: '',
    phone_number: '',
    contact_email: '',
    additional_info: ''
  });
  const [whatsappRequestSent, setWhatsappRequestSent] = useState(false);

  // Tenants/brands for multi-brand integrations
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    fetchWhatsAppStatus();
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/tenants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchWhatsAppStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/twilio/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWhatsappStatus(data);
      }
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
    }
  };

  const handleWhatsAppRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/whatsapp/request-activation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(whatsappForm)
      });

      if (!res.ok) {
        throw new Error('Error al enviar solicitud');
      }

      setWhatsappRequestSent(true);
      setShowWhatsAppForm(false);
      // Reset form
      setWhatsappForm({
        business_name: '',
        phone_number: '',
        contact_email: '',
        additional_info: ''
      });
    } catch (error: any) {
      console.error('Error sending WhatsApp request:', error);
      alert('Error al enviar solicitud. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Integraciones</h2>
        <p className="text-gray-400">
          Gestiona, agrega o elimina todas tus integraciones
        </p>
      </div>

      {/* Redes Sociales */}
      <div className="bg-black/40 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('social')}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition group"
        >
          <div className="flex items-center space-x-4">
            <h3 className="text-base font-medium text-white group-hover:text-[#04d9b5] transition">
              Redes Sociales
            </h3>
            <span className="text-xs text-gray-400">Facebook • Instagram</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-green-400">3 conectadas</span>
            <svg
              className={`w-4 h-4 text-[#04d9b5] transition-transform ${activeSection === 'social' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        {activeSection === 'social' && (
          <div className="px-6 py-4 border-t border-white/10 bg-black/20">
            <FacebookConnect token={token} onConnectionChange={onConnectionChange} />
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="bg-black/40 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('whatsapp')}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition group"
        >
          <div className="flex items-center space-x-4">
            <h3 className="text-base font-medium text-white group-hover:text-[#04d9b5] transition">
              WhatsApp
            </h3>
            <span className="text-xs text-gray-400">Canal conversacional</span>
          </div>
          <div className="flex items-center space-x-3">
            {whatsappStatus?.configured ? (
              <span className="text-xs text-green-400">Conectado</span>
            ) : (
              <span className="text-xs text-gray-500">No conectado</span>
            )}
            <svg
              className={`w-4 h-4 text-[#04d9b5] transition-transform ${activeSection === 'whatsapp' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        {activeSection === 'whatsapp' && (
          <div className="px-6 py-4 border-t border-white/10 bg-black/20 space-y-4">
            {whatsappStatus?.configured ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-medium text-sm">WhatsApp conectado</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Número de WhatsApp:</div>
                  <div className="text-white font-mono text-sm">{whatsappStatus.whatsapp_from}</div>
                </div>
              </div>
            ) : whatsappRequestSent ? (
              <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-4">
                <p className="text-green-300 text-sm">
                  ✓ Solicitud enviada exitosamente. Nos pondremos en contacto contigo pronto para configurar WhatsApp.
                </p>
              </div>
            ) : !showWhatsAppForm ? (
              <div className="space-y-3">
                <p className="text-gray-300 text-sm">
                  Activa WhatsApp para tu negocio. Solo llena el formulario y nosotros nos encargamos de todo.
                </p>
                <ul className="space-y-2 text-xs text-gray-400">
                  <li className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Configuración completa por nuestro equipo
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Número de WhatsApp Business dedicado
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Respuestas automáticas con IA
                  </li>
                </ul>
                <button
                  onClick={() => setShowWhatsAppForm(true)}
                  className="w-full px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm"
                >
                  Solicitar Activación
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-white text-sm font-medium">Solicitud de Activación de WhatsApp</h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nombre del Negocio *</label>
                    <input
                      type="text"
                      value={whatsappForm.business_name}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, business_name: e.target.value })}
                      placeholder="Ej: Chilangos Downtown"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Número de Teléfono *</label>
                    <input
                      type="tel"
                      value={whatsappForm.phone_number}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, phone_number: e.target.value })}
                      placeholder="+52 1234567890"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si no tienes número, te ayudaremos a obtener uno
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email de Contacto *</label>
                    <input
                      type="email"
                      value={whatsappForm.contact_email}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, contact_email: e.target.value })}
                      placeholder="contacto@tunegocio.com"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Información Adicional (opcional)</label>
                    <textarea
                      value={whatsappForm.additional_info}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, additional_info: e.target.value })}
                      placeholder="Cuéntanos sobre tu negocio o necesidades específicas..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowWhatsAppForm(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleWhatsAppRequest}
                    disabled={loading || !whatsappForm.business_name || !whatsappForm.phone_number || !whatsappForm.contact_email}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* E-commerce */}
      <div className="bg-black/40 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('ecommerce')}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition group"
        >
          <div className="flex items-center space-x-4">
            <h3 className="text-base font-medium text-white group-hover:text-[#04d9b5] transition">
              E-commerce
            </h3>
            <span className="text-xs text-gray-400">Stripe • Mercado Libre • Shopify • Catálogo</span>
          </div>
          <div className="flex items-center space-x-3">
            <svg
              className={`w-4 h-4 text-[#04d9b5] transition-transform ${activeSection === 'ecommerce' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        {activeSection === 'ecommerce' && (
          <div className="px-6 py-4 border-t border-white/10 bg-black/20 space-y-6">
            {/* Stripe - Multi-brand */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">Stripe</h4>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Acepta pagos directamente desde el chat. Cada marca puede tener su propia cuenta de Stripe.
              </p>

              {/* Lista de marcas/tenants con Stripe */}
              <div className="space-y-2">
                {tenants.length > 0 ? (
                  tenants.map((tenant) => (
                    <div
                      key={tenant.slug}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">{tenant.name}</div>
                        <div className="text-xs text-gray-500">{tenant.slug}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {tenant.stripe_acct ? (
                          <>
                            <span className="text-xs text-green-400">Conectado</span>
                            <button
                              onClick={() => window.open(`${API_BASE}/v1/admin/stripe/dashboard?tenant_slug=${tenant.slug}&token=${token}`, '_blank')}
                              className="px-3 py-1 rounded text-xs bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition"
                            >
                              Dashboard
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={async () => {
                              // Redirigir con token en la URL ya que es una redirección de Stripe
                              window.location.href = `${API_BASE}/v1/admin/stripe/onboard?tenant_slug=${tenant.slug}&token=${token}`;
                            }}
                            className="px-3 py-1 rounded text-xs bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition"
                          >
                            Conectar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 text-center py-2">
                    No hay marcas configuradas.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10"></div>

            {/* Mercado Libre */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">Mercado Libre</h4>
                <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300">Próximamente</span>
              </div>
              <p className="text-xs text-gray-400">
                Integración con tu tienda de Mercado Libre
              </p>
            </div>

            <div className="border-t border-white/10"></div>

            {/* Shopify */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">Shopify</h4>
                <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300">Próximamente</span>
              </div>
              <p className="text-xs text-gray-400">
                Conecta tu tienda de Shopify
              </p>
            </div>

            <div className="border-t border-white/10"></div>

            {/* Catálogo - Multi-brand */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Catálogo de Productos</h4>
              <p className="text-xs text-gray-400 mb-3">
                Configura el catálogo de productos para cada marca (formato JSON).
              </p>

              {/* Lista de marcas con catálogo */}
              <div className="space-y-3">
                {tenants.length > 0 ? (
                  tenants.map((tenant) => (
                    <div
                      key={`catalog-${tenant.slug}`}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-white text-sm font-medium">{tenant.name}</div>
                        {tenant.catalog_url && (
                          <span className="text-xs text-green-400">Configurado</span>
                        )}
                      </div>
                      <input
                        type="url"
                        defaultValue={tenant.catalog_url || ''}
                        placeholder={`https://${tenant.slug}.com/catalog.json`}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                        onBlur={async (e) => {
                          const url = e.target.value.trim();
                          if (url) {
                            // TODO: Implementar guardado del catalog_url
                            console.log(`Guardar catálogo para ${tenant.slug}:`, url);
                          }
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 text-center py-2">
                    No hay marcas configuradas.
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500">
                ¿No sabes cómo crear tu catálogo?{' '}
                <a href="#" className="text-[#04d9b5] hover:underline">
                  Contacta con soporte
                </a>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Web */}
      <div className="bg-black/40 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('web')}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition group"
        >
          <div className="flex items-center space-x-4">
            <h3 className="text-base font-medium text-white group-hover:text-[#04d9b5] transition">
              Páginas Web
            </h3>
            <span className="text-xs text-gray-400">Sitios conectados al widget</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-green-400">1 sitio</span>
            <svg
              className={`w-4 h-4 text-[#04d9b5] transition-transform ${activeSection === 'web' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        {activeSection === 'web' && (
          <div className="px-6 py-4 border-t border-white/10 bg-black/20 space-y-4">
            <p className="text-gray-300 text-xs">
              Agrega los sitios web donde quieres instalar el widget del bot.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-white text-sm">acidia.app</span>
                <button className="text-red-400 hover:text-red-300 text-xs">Eliminar</button>
              </div>
            </div>
            <button className="px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm">
              + Agregar Sitio Web
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
