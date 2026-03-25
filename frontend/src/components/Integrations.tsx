import { useState, useEffect } from 'react';
import FacebookConnect from './dashboard/FacebookConnect';

import { API_BASE } from '../config'

interface IntegrationsProps {
  token: string;
  onConnectionChange: () => void;
}

type CalendarFieldKey =
  | 'name'
  | 'email'
  | 'whatsapp'
  | 'phone'
  | 'company'
  | 'service'
  | 'notes'
  | 'date'
  | 'time';

const CALENDAR_FIELD_OPTIONS: Array<{ key: CalendarFieldKey; label: string }> = [
  { key: 'name', label: 'Nombre completo' },
  { key: 'email', label: 'Correo electrónico' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'company', label: 'Empresa' },
  { key: 'service', label: 'Servicio de interés' },
  { key: 'notes', label: 'Notas adicionales' },
  { key: 'date', label: 'Fecha de la cita' },
  { key: 'time', label: 'Hora de la cita' }
];

interface GoogleCalendarItem {
  id: string;
  summary: string;
  primary?: boolean;
  access_role?: string;
  time_zone?: string;
}

export default function Integrations({ token, onConnectionChange }: IntegrationsProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [connectedPagesCount, setConnectedPagesCount] = useState(0);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [googleConnectionLoading, setGoogleConnectionLoading] = useState(false);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarItem[]>([]);
  const [calendarFeedback, setCalendarFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [calendarConfig, setCalendarConfig] = useState({
    enabled: false,
    calendar_id: '',
    timezone: 'America/Mexico_City',
    duration_minutes: 30,
    collect_fields: ['name', 'email', 'service', 'date', 'time'] as CalendarFieldKey[],
    oauth_client_configured: false,
    service_account_configured: false,
    user_connection_configured: false,
    auth_mode: 'none',
    google_account_email: '',
    ready: false
  });

  // WhatsApp activation form
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState({
    business_name: '',
    phone_number: '',
    contact_email: '',
    additional_info: ''
  });
  const [whatsappRequestSent, setWhatsappRequestSent] = useState(false);

  // Twilio configuration form
  const [showTwilioForm, setShowTwilioForm] = useState(false);
  const [twilioForm, setTwilioForm] = useState({
    account_sid: '',
    auth_token: '',
    whatsapp_from: ''
  });

  // Tenants/brands for multi-brand integrations
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    fetchWhatsAppStatus();
    fetchTenants();
    fetchConnectedPagesCount();
    fetchGoogleCalendarSettings();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleConnected = params.get('google_connected') === 'true';
    const googleError = params.get('google_error');

    if (!googleConnected && !googleError) return;

    if (googleConnected) {
      setCalendarFeedback({ type: 'success', text: 'Cuenta de Google conectada correctamente.' });
      fetchGoogleCalendarSettings();
      fetchGoogleCalendars();
      onConnectionChange();
    } else if (googleError) {
      setCalendarFeedback({ type: 'error', text: googleError });
    }

    params.delete('google_connected');
    params.delete('google_error');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [onConnectionChange]);

  const fetchConnectedPagesCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/facebook/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConnectedPagesCount(data.pages?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching pages count:', error);
    }
  };

  const handleConnectionChange = () => {
    fetchConnectedPagesCount();
    onConnectionChange();
  };

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

  const fetchGoogleCalendarSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/google-calendar/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCalendarConfig({
          enabled: Boolean(data.enabled),
          calendar_id: data.calendar_id || '',
          timezone: data.timezone || 'America/Mexico_City',
          duration_minutes: Number(data.duration_minutes || 30),
          collect_fields: (data.collect_fields || ['name', 'email', 'service', 'date', 'time']) as CalendarFieldKey[],
          oauth_client_configured: Boolean(data.oauth_client_configured),
          service_account_configured: Boolean(data.service_account_configured),
          user_connection_configured: Boolean(data.user_connection_configured),
          auth_mode: data.auth_mode || 'none',
          google_account_email: data.google_account_email || '',
          ready: Boolean(data.ready)
        });
        if (data.user_connection_configured) {
          fetchGoogleCalendars();
        } else {
          setGoogleCalendars([]);
        }
      }
    } catch (error) {
      console.error('Error fetching Google Calendar settings:', error);
    }
  };

  const fetchGoogleCalendars = async () => {
    try {
      setGoogleConnectionLoading(true);
      const res = await fetch(`${API_BASE}/v1/admin/google-calendar/calendars`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'No se pudieron cargar los calendarios');
      }
      const data = await res.json();
      setGoogleCalendars(data.calendars || []);
    } catch (error) {
      console.error('Error fetching Google calendars:', error);
      setGoogleCalendars([]);
    } finally {
      setGoogleConnectionLoading(false);
    }
  };

  const toggleCalendarField = (field: CalendarFieldKey) => {
    setCalendarConfig((prev) => {
      const hasField = prev.collect_fields.includes(field);
      let next = hasField
        ? prev.collect_fields.filter((f) => f !== field)
        : [...prev.collect_fields, field];

      if (!next.includes('date')) next = [...next, 'date'];
      if (!next.includes('time')) next = [...next, 'time'];

      return { ...prev, collect_fields: next as CalendarFieldKey[] };
    });
  };

  const handleSaveGoogleCalendar = async () => {
    setCalendarLoading(true);
    try {
      const payload = {
        enabled: calendarConfig.enabled,
        calendar_id: calendarConfig.calendar_id.trim(),
        timezone: calendarConfig.timezone.trim() || 'America/Mexico_City',
        duration_minutes: Number(calendarConfig.duration_minutes || 30),
        collect_fields: calendarConfig.collect_fields
      };

      const res = await fetch(`${API_BASE}/v1/admin/google-calendar/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'No se pudo guardar la configuración');
      }
      const data = await res.json();
      setCalendarConfig((prev) => ({
        ...prev,
        enabled: Boolean(data.enabled),
        calendar_id: data.calendar_id || '',
        timezone: data.timezone || 'America/Mexico_City',
        duration_minutes: Number(data.duration_minutes || 30),
        collect_fields: (data.collect_fields || prev.collect_fields) as CalendarFieldKey[],
        oauth_client_configured: Boolean(data.oauth_client_configured),
        service_account_configured: Boolean(data.service_account_configured),
        user_connection_configured: Boolean(data.user_connection_configured),
        auth_mode: data.auth_mode || prev.auth_mode,
        google_account_email: data.google_account_email || prev.google_account_email,
        ready: Boolean(data.ready)
      }));
      setCalendarFeedback({ type: 'success', text: 'Configuración de Google Calendar guardada.' });
    } catch (error: any) {
      console.error('Error saving Google Calendar settings:', error);
      setCalendarFeedback({ type: 'error', text: error.message || 'Error guardando configuración de Google Calendar.' });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    try {
      setGoogleConnectionLoading(true);
      setCalendarFeedback(null);
      const res = await fetch(`${API_BASE}/auth/google/connect`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'No se pudo iniciar la conexión con Google');
      }
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch (error: any) {
      console.error('Error starting Google OAuth:', error);
      setCalendarFeedback({ type: 'error', text: error.message || 'No se pudo iniciar la conexión con Google.' });
      setGoogleConnectionLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!confirm('¿Deseas desconectar esta cuenta de Google Calendar?')) {
      return;
    }

    try {
      setGoogleConnectionLoading(true);
      setCalendarFeedback(null);
      const res = await fetch(`${API_BASE}/auth/google/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'No se pudo desconectar Google');
      }

      setGoogleCalendars([]);
      setCalendarConfig((prev) => ({
        ...prev,
        user_connection_configured: false,
        auth_mode: prev.service_account_configured ? 'service_account' : 'none',
        google_account_email: '',
        ready: prev.enabled && Boolean(prev.calendar_id) && prev.service_account_configured
      }));
      setCalendarFeedback({ type: 'success', text: 'Cuenta de Google desconectada.' });
      onConnectionChange();
    } catch (error: any) {
      console.error('Error disconnecting Google:', error);
      setCalendarFeedback({ type: 'error', text: error.message || 'No se pudo desconectar Google.' });
    } finally {
      setGoogleConnectionLoading(false);
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

  const handleTwilioConfig = async () => {
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
      setShowTwilioForm(false);
      await fetchWhatsAppStatus();

      // Mostrar webhook URL
      alert(`Configuración exitosa!\n\nWebhook URL para Twilio:\n${data.webhook_url}\n\nCopia esta URL y configúrala en tu cuenta de Twilio.`);

      // Reset form
      setTwilioForm({
        account_sid: '',
        auth_token: '',
        whatsapp_from: ''
      });
    } catch (error: any) {
      console.error('Error configuring Twilio:', error);
      alert(error.message || 'Error al configurar Twilio. Verifica tus credenciales.');
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
            {connectedPagesCount > 0 ? (
              <span className="text-xs text-green-400">{connectedPagesCount} conectada{connectedPagesCount !== 1 ? 's' : ''}</span>
            ) : (
              <span className="text-xs text-gray-500">No conectadas</span>
            )}
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
            <FacebookConnect token={token} onConnectionChange={handleConnectionChange} />
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
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                  <div>
                    <div className="text-xs text-gray-400">Número de WhatsApp:</div>
                    <div className="text-white font-mono text-sm">{whatsappStatus.whatsapp_from}</div>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-xs text-gray-400 mb-1">Webhook URL para Twilio:</div>
                    <div className="text-white font-mono text-xs break-all bg-black/30 p-2 rounded">
                      {whatsappStatus.webhook_url}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Configura esta URL en tu cuenta de Twilio para recibir mensajes
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTwilioForm(true);
                    setTwilioForm({
                      account_sid: '',
                      auth_token: '',
                      whatsapp_from: ''
                    });
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition text-sm"
                >
                  Reconfigurar credenciales
                </button>
              </div>
            ) : whatsappRequestSent ? (
              <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-4">
                <p className="text-green-300 text-sm">
                  ✓ Solicitud enviada exitosamente. Nos pondremos en contacto contigo pronto para configurar WhatsApp.
                </p>
              </div>
            ) : showTwilioForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-white text-sm font-medium">Configurar Twilio WhatsApp</h4>
                  <button
                    onClick={() => setShowTwilioForm(false)}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    ← Volver
                  </button>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-300 text-xs">
                    Ingresa tus credenciales de Twilio. Encuéntralas en: <br />
                    <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline">
                      console.twilio.com
                    </a>
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Account SID *</label>
                    <input
                      type="text"
                      value={twilioForm.account_sid}
                      onChange={(e) => setTwilioForm({ ...twilioForm, account_sid: e.target.value })}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Auth Token *</label>
                    <input
                      type="password"
                      value={twilioForm.auth_token}
                      onChange={(e) => setTwilioForm({ ...twilioForm, auth_token: e.target.value })}
                      placeholder="********************************"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">WhatsApp From Number *</label>
                    <input
                      type="text"
                      value={twilioForm.whatsapp_from}
                      onChange={(e) => setTwilioForm({ ...twilioForm, whatsapp_from: e.target.value })}
                      placeholder="whatsapp:+14155238886 o +14155238886"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5] font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Para Sandbox: whatsapp:+14155238886 • Para número real: tu número de Twilio
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTwilioForm(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleTwilioConfig}
                    disabled={loading || !twilioForm.account_sid || !twilioForm.auth_token || !twilioForm.whatsapp_from}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
                </div>
              </div>
            ) : showWhatsAppForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-white text-sm font-medium">Solicitud de Activación de WhatsApp</h4>
                  <button
                    onClick={() => setShowWhatsAppForm(false)}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    ← Volver
                  </button>
                </div>

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
            ) : (
              <div className="space-y-3">
                <p className="text-gray-300 text-sm">
                  Activa WhatsApp para tu negocio y empieza a recibir mensajes de tus clientes.
                </p>
                <ul className="space-y-2 text-xs text-gray-400">
                  <li className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Respuestas automáticas con IA
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Integración con tu catálogo de productos
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Atención 24/7 para tus clientes
                  </li>
                </ul>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setShowWhatsAppForm(true)}
                    className="w-full px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm"
                  >
                    Solicitar Activación
                  </button>
                  <p className="text-xs text-gray-400">
                    Completa el formulario y nuestro equipo se encargará de configurar WhatsApp para ti. Te contactaremos en 24-48 horas.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Calendar */}
      <div className="bg-black/40 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('calendar')}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition group"
        >
          <div className="flex items-center space-x-4">
            <h3 className="text-base font-medium text-white group-hover:text-[#04d9b5] transition">
              Google Calendar
            </h3>
            <span className="text-xs text-gray-400">Citas automáticas</span>
          </div>
          <div className="flex items-center space-x-3">
            {calendarConfig.ready ? (
              <span className="text-xs text-green-400">Listo</span>
            ) : (
              <span className="text-xs text-gray-500">Pendiente</span>
            )}
            <svg
              className={`w-4 h-4 text-[#04d9b5] transition-transform ${activeSection === 'calendar' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        {activeSection === 'calendar' && (
          <div className="px-6 py-4 border-t border-white/10 bg-black/20 space-y-4">
            {calendarFeedback && (
              <div className={`rounded-lg border p-3 text-sm ${calendarFeedback.type === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-300' : 'border-red-500/40 bg-red-500/10 text-red-200'}`}>
                {calendarFeedback.text}
              </div>
            )}

            <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-white font-medium">Cuenta de Google</p>
                  <p className="text-xs text-gray-400">
                    {calendarConfig.user_connection_configured
                      ? `Conectada como ${calendarConfig.google_account_email || 'cuenta sin email visible'}`
                      : 'Conecta la cuenta del usuario para elegir calendarios sin configurar IDs manuales.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {calendarConfig.user_connection_configured ? (
                    <>
                      <button
                        onClick={fetchGoogleCalendars}
                        disabled={googleConnectionLoading}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition disabled:opacity-50"
                      >
                        {googleConnectionLoading ? 'Actualizando...' : 'Recargar calendarios'}
                      </button>
                      <button
                        onClick={handleGoogleDisconnect}
                        disabled={googleConnectionLoading}
                        className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
                      >
                        Desconectar Google
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleGoogleConnect}
                      disabled={googleConnectionLoading || !calendarConfig.oauth_client_configured}
                      className="px-3 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-sm text-[#04d9b5] hover:bg-[#04d9b5]/30 transition disabled:opacity-50"
                    >
                      {googleConnectionLoading ? 'Conectando...' : 'Conectar Google'}
                    </button>
                  )}
                </div>
              </div>

              {!calendarConfig.oauth_client_configured && (
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300">
                  Falta configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REDIRECT_URI` en el backend para habilitar OAuth.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-3">
              <div>
                <p className="text-sm text-white font-medium">Agendado automático</p>
                <p className="text-xs text-gray-400">Si está activo, el bot puede crear citas directamente.</p>
              </div>
              <button
                onClick={() => setCalendarConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`w-14 h-8 rounded-full transition ${calendarConfig.enabled ? 'bg-[#04d9b5]' : 'bg-gray-600'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full transition-transform ${calendarConfig.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="space-y-3">
              {calendarConfig.user_connection_configured && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Calendario de Google</label>
                  <select
                    value={calendarConfig.calendar_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedCalendar = googleCalendars.find((calendar) => calendar.id === selectedId);
                      setCalendarConfig((prev) => ({
                        ...prev,
                        calendar_id: selectedId,
                        timezone: selectedCalendar?.time_zone || prev.timezone
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                  >
                    <option value="">Selecciona un calendario</option>
                    {googleCalendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.primary ? 'Principal' : calendar.summary} ({calendar.id})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {googleConnectionLoading ? 'Cargando calendarios...' : 'También puedes escribir manualmente un Calendar ID si lo prefieres.'}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Calendar ID</label>
                <input
                  type="text"
                  value={calendarConfig.calendar_id}
                  onChange={(e) => setCalendarConfig((prev) => ({ ...prev, calendar_id: e.target.value }))}
                  placeholder="ej. negocio@group.calendar.google.com"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Zona horaria</label>
                  <input
                    type="text"
                    value={calendarConfig.timezone}
                    onChange={(e) => setCalendarConfig((prev) => ({ ...prev, timezone: e.target.value }))}
                    placeholder="America/Mexico_City"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Duración (minutos)</label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={calendarConfig.duration_minutes}
                    onChange={(e) => setCalendarConfig((prev) => ({ ...prev, duration_minutes: Number(e.target.value || 30) }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-sm text-white font-medium mb-2">Campos a recolectar en el flujo</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CALENDAR_FIELD_OPTIONS.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={calendarConfig.collect_fields.includes(field.key)}
                      disabled={field.key === 'date' || field.key === 'time'}
                      onChange={() => toggleCalendarField(field.key)}
                      className="accent-[#04d9b5]"
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">`Fecha` y `Hora` siempre son requeridos para crear la cita.</p>
            </div>

            <div className={`rounded-lg border p-3 text-xs ${calendarConfig.user_connection_configured || calendarConfig.service_account_configured ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-orange-500/10 border-orange-500/30 text-orange-300'}`}>
              {calendarConfig.user_connection_configured
                ? 'La agenda usará la cuenta conectada por el usuario.'
                : calendarConfig.service_account_configured
                  ? 'Service account de Google detectada en backend. Sigue disponible como respaldo.'
                  : 'Falta configurar OAuth de usuario o GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_FILE en el backend.'}
            </div>

            <button
              onClick={handleSaveGoogleCalendar}
              disabled={calendarLoading || !calendarConfig.calendar_id}
              className="w-full px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {calendarLoading ? 'Guardando...' : 'Guardar configuración de agenda'}
            </button>
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
