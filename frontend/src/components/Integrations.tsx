import { useState, useEffect } from 'react';
import FacebookConnect from './FacebookConnect';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://acidia.app';

interface IntegrationsProps {
  token: string;
  onConnectionChange: () => void;
}

export default function Integrations({ token, onConnectionChange }: IntegrationsProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [catalogUrl, setCatalogUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWhatsAppStatus();
  }, []);

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
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('social')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Facebook e Instagram</h3>
              <p className="text-sm text-gray-400">Mensajes directos y comentarios</p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${activeSection === 'social' ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {activeSection === 'social' && (
          <div className="px-6 py-4 border-t border-white/10">
            <FacebookConnect token={token} onConnectionChange={onConnectionChange} />
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('whatsapp')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">WhatsApp</h3>
              <p className="text-sm text-gray-400">
                {whatsappStatus?.configured ? (
                  <span className="text-green-400">✓ Conectado: {whatsappStatus.whatsapp_from}</span>
                ) : (
                  <span>No conectado</span>
                )}
              </p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${activeSection === 'whatsapp' ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {activeSection === 'whatsapp' && (
          <div className="px-6 py-4 border-t border-white/10 space-y-4">
            <p className="text-gray-300 text-sm">
              Para activar WhatsApp, contáctanos. Nosotros configuraremos todo por ti.
            </p>
            <button className="px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30 transition">
              Solicitar Activación
            </button>
          </div>
        )}
      </div>

      {/* E-commerce */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('ecommerce')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">E-commerce</h3>
              <p className="text-sm text-gray-400">Stripe, Mercado Libre, Shopify, Catálogo</p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${activeSection === 'ecommerce' ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {activeSection === 'ecommerce' && (
          <div className="px-6 py-4 border-t border-white/10 space-y-6">
            {/* Stripe */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white">Stripe</h4>
                <span className="text-xs text-gray-400">Conectado</span>
              </div>
              <p className="text-sm text-gray-400">
                Acepta pagos directamente desde el chat
              </p>
            </div>

            <div className="border-t border-white/10 pt-4"></div>

            {/* Mercado Libre */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white">Mercado Libre</h4>
                <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300">Próximamente</span>
              </div>
              <p className="text-sm text-gray-400">
                Integración con tu tienda de Mercado Libre
              </p>
            </div>

            <div className="border-t border-white/10 pt-4"></div>

            {/* Shopify */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white">Shopify</h4>
                <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300">Próximamente</span>
              </div>
              <p className="text-sm text-gray-400">
                Conecta tu tienda de Shopify
              </p>
            </div>

            <div className="border-t border-white/10 pt-4"></div>

            {/* Catálogo */}
            <div className="space-y-3">
              <h4 className="font-semibold text-white">Catálogo de Productos</h4>
              <p className="text-sm text-gray-400">
                URL de tu catálogo de productos (JSON)
              </p>
              <input
                type="url"
                value={catalogUrl}
                onChange={(e) => setCatalogUrl(e.target.value)}
                placeholder="https://tu-sitio.com/catalog.json"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition"
                onClick={() => {
                  // TODO: Guardar catalog_url
                  alert('Guardar catalog_url');
                }}
              >
                Guardar Catálogo
              </button>
              <p className="text-xs text-gray-500">
                ¿No sabes cómo crear tu catálogo?{' '}
                <a href="#" className="text-purple-400 hover:underline">
                  Contacta con soporte
                </a>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Web */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleSection('web')}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Páginas Web</h3>
              <p className="text-sm text-gray-400">Sitios conectados a tu bot</p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${activeSection === 'web' ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {activeSection === 'web' && (
          <div className="px-6 py-4 border-t border-white/10 space-y-4">
            <p className="text-gray-300 text-sm">
              Agrega los sitios web donde quieres instalar el widget del bot.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-white">acidia.app</span>
                <button className="text-red-400 hover:text-red-300 text-sm">Eliminar</button>
              </div>
            </div>
            <button className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition">
              + Agregar Sitio Web
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
