import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

const CALENDAR_FIELD_OPTIONS: Array<{ key: CalendarFieldKey; labelKey: string }> = [
  { key: 'name', labelKey: 'integrations.calendar_fields.name' },
  { key: 'email', labelKey: 'integrations.calendar_fields.email' },
  { key: 'whatsapp', labelKey: 'integrations.calendar_fields.whatsapp' },
  { key: 'phone', labelKey: 'integrations.calendar_fields.phone' },
  { key: 'company', labelKey: 'integrations.calendar_fields.company' },
  { key: 'service', labelKey: 'integrations.calendar_fields.service' },
  { key: 'notes', labelKey: 'integrations.calendar_fields.notes' },
  { key: 'date', labelKey: 'integrations.calendar_fields.date' },
  { key: 'time', labelKey: 'integrations.calendar_fields.time' }
];

interface GoogleCalendarItem {
  id: string;
  summary: string;
  primary?: boolean;
  access_role?: string;
  time_zone?: string;
}

export default function Integrations({ token, onConnectionChange }: IntegrationsProps) {
  const { t } = useTranslation();
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

  // Shopify integration
  const [shopifyForm, setShopifyForm] = useState({ domain: '', adminToken: '', storefrontToken: '', storeUrl: '', tokenType: 'admin' as 'admin' | 'storefront' });
  const [shopifyStatus, setShopifyStatus] = useState<{ connected: boolean; shopName?: string; domain?: string } | null>(null);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyFeedback, setShopifyFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [shopifyProducts, setShopifyProducts] = useState<any[]>([]);
  const [shopifyProductsLoading, setShopifyProductsLoading] = useState(false);

  // Tenants/brands for multi-brand integrations
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    fetchWhatsAppStatus();
    fetchTenants();
    fetchConnectedPagesCount();
    fetchGoogleCalendarSettings();
    fetchShopifyStatus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleConnected = params.get('google_connected') === 'true';
    const googleError = params.get('google_error');

    if (!googleConnected && !googleError) return;

    if (googleConnected) {
      setCalendarFeedback({ type: 'success', text: t('integrations.google_connected_success') });
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopifyConnected = params.get('shopify_connected') === 'true';
    const shopName = params.get('shop');

    if (!shopifyConnected) return;

    fetchShopifyStatus();
    setShopifyFeedback({ type: 'success', text: t('integrations.shopify_connected_success', { shop: shopName ? ` "${shopName}"` : '' }) });

    params.delete('shopify_connected');
    params.delete('shop');
    const nextQuery = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`);
  }, []);

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

  const fetchShopifyStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/tenant/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const settings = data.settings || {};
        if (settings.shopify_domain && (settings.shopify_storefront_token || settings.shopify_admin_token)) {
          setShopifyStatus({ connected: true, domain: settings.shopify_domain, shopName: settings.shopify_shop_name });
        } else {
          setShopifyStatus({ connected: false });
        }
      }
    } catch (error) {
      console.error('Error fetching Shopify status:', error);
    }
  };

  const handleShopifyOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopifyLoading(true);
    setShopifyFeedback(null);
    try {
      const domain = shopifyForm.domain.trim();
      if (!domain) throw new Error(t('integrations.shopify_domain_required'));
      const res = await fetch(`${API_BASE}/v1/admin/shopify/oauth/start?shop=${encodeURIComponent(domain)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t('integrations.connection_start_error'));
      window.location.href = data.auth_url;
    } catch (err: any) {
      setShopifyFeedback({ type: 'error', text: err.message });
      setShopifyLoading(false);
    }
  };

  const handleShopifyConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopifyLoading(true);
    setShopifyFeedback(null);
    try {
      const payload: any = {
        shopify_domain: shopifyForm.domain.trim(),
        shopify_store_url: shopifyForm.storeUrl.trim() || undefined,
      };
      if (shopifyForm.tokenType === 'admin') {
        payload.shopify_admin_token = shopifyForm.adminToken.trim();
      } else {
        payload.shopify_storefront_token = shopifyForm.storefrontToken.trim();
      }
      const res = await fetch(`${API_BASE}/v1/admin/shopify/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al conectar con Shopify');
      setShopifyFeedback({ type: 'success', text: data.message });
      setShopifyStatus({ connected: true, shopName: data.shop_name, domain: data.domain });
      setShopifyForm({ domain: '', adminToken: '', storefrontToken: '', storeUrl: '', tokenType: 'admin' });
      onConnectionChange();
    } catch (err: any) {
      setShopifyFeedback({ type: 'error', text: err.message });
    } finally {
      setShopifyLoading(false);
    }
  };

  const handleShopifyDisconnect = async () => {
    if (!confirm(t('integrations.shopify_disconnect_confirm'))) return;
    setShopifyLoading(true);
    try {
      await fetch(`${API_BASE}/v1/admin/shopify/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setShopifyStatus({ connected: false });
      setShopifyProducts([]);
      setShopifyFeedback({ type: 'success', text: 'Shopify desconectado.' });
      onConnectionChange();
    } catch {
      setShopifyFeedback({ type: 'error', text: 'Error al desconectar.' });
    } finally {
      setShopifyLoading(false);
    }
  };

  const handleShopifyPreview = async () => {
    setShopifyProductsLoading(true);
    setShopifyProducts([]);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/shopify/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      setShopifyProducts(data.products || []);
    } catch (err: any) {
      setShopifyFeedback({ type: 'error', text: err.message });
    } finally {
      setShopifyProductsLoading(false);
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
        throw new Error(errorData.detail || t('integrations.calendar_save_error'));
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
      setCalendarFeedback({ type: 'success', text: t('integrations.calendar_saved') });
    } catch (error: any) {
      console.error('Error saving Google Calendar settings:', error);
      setCalendarFeedback({ type: 'error', text: error.message || t('integrations.calendar_save_error_fallback') });
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
        throw new Error(errorData.detail || t('integrations.google_connect_error'));
      }
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch (error: any) {
      console.error('Error starting Google OAuth:', error);
      setCalendarFeedback({ type: 'error', text: error.message || t('integrations.google_connect_error_fallback') });
      setGoogleConnectionLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!confirm(t('integrations.google_disconnect_confirm'))) {
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
      setCalendarFeedback({ type: 'success', text: t('integrations.google_disconnected') });
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
      alert(t('integrations.twilio_success', { url: data.webhook_url }));

      // Reset form
      setTwilioForm({
        account_sid: '',
        auth_token: '',
        whatsapp_from: ''
      });
    } catch (error: any) {
      console.error('Error configuring Twilio:', error);
      alert(error.message || t('integrations.twilio_error'));
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
        <h2 className="text-2xl font-bold text-white mb-2">{t('integrations.title')}</h2>
        <p className="text-gray-400">
          {t('integrations.subtitle')}
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
              {t('integrations.social')}
            </h3>
            <span className="text-xs text-gray-400">Facebook • Instagram</span>
          </div>
          <div className="flex items-center space-x-3">
            {connectedPagesCount > 0 ? (
              <span className="text-xs text-green-400">
                {t(connectedPagesCount === 1 ? 'integrations.connected_count' : 'integrations.connected_count_plural', { count: connectedPagesCount })}
              </span>
            ) : (
              <span className="text-xs text-gray-500">{t('integrations.not_connected_plural')}</span>
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
            <span className="text-xs text-gray-400">{t('integrations.whatsapp_subtitle')}</span>
          </div>
          <div className="flex items-center space-x-3">
            {whatsappStatus?.configured ? (
              <span className="text-xs text-green-400">{t('integrations.connected')}</span>
            ) : (
              <span className="text-xs text-gray-500">{t('integrations.not_connected')}</span>
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
                  <span className="text-green-400 font-medium text-sm">{t('integrations.whatsapp_connected')}</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                  <div>
                    <div className="text-xs text-gray-400">{t('integrations.whatsapp_number')}</div>
                    <div className="text-white font-mono text-sm">{whatsappStatus.whatsapp_from}</div>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-xs text-gray-400 mb-1">{t('integrations.twilio_webhook')}</div>
                    <div className="text-white font-mono text-xs break-all bg-black/30 p-2 rounded">
                      {whatsappStatus.webhook_url}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('integrations.twilio_webhook_hint')}
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
                  {t('integrations.reconfigure_credentials')}
                </button>
              </div>
            ) : whatsappRequestSent ? (
              <div className="bg-green-500/20 border border-green-500/40 rounded-lg p-4">
                <p className="text-green-300 text-sm">
                  {t('integrations.request_sent')}
                </p>
              </div>
            ) : showTwilioForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-white text-sm font-medium">{t('integrations.configure_twilio')}</h4>
                  <button
                    onClick={() => setShowTwilioForm(false)}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    ← {t('integrations.back')}
                  </button>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-300 text-xs">
                    {t('integrations.twilio_credentials_hint')} <br />
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
                    <label className="block text-xs text-gray-400 mb-1">{t('integrations.twilio_from_number')}</label>
                    <input
                      type="text"
                      value={twilioForm.whatsapp_from}
                      onChange={(e) => setTwilioForm({ ...twilioForm, whatsapp_from: e.target.value })}
                      placeholder="whatsapp:+14155238886 o +14155238886"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5] font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('integrations.twilio_from_hint')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTwilioForm(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition text-sm"
                  >
                    {t('integrations.cancel')}
                  </button>
                  <button
                    onClick={handleTwilioConfig}
                    disabled={loading || !twilioForm.account_sid || !twilioForm.auth_token || !twilioForm.whatsapp_from}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? t('integrations.saving') : t('integrations.save_config')}
                  </button>
                </div>
              </div>
            ) : showWhatsAppForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-white text-sm font-medium">{t('integrations.whatsapp_request_title')}</h4>
                  <button
                    onClick={() => setShowWhatsAppForm(false)}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    ← {t('integrations.back')}
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('integrations.business_name')}</label>
                    <input
                      type="text"
                      value={whatsappForm.business_name}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, business_name: e.target.value })}
                      placeholder={t('integrations.business_placeholder')}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('integrations.phone_number')}</label>
                    <input
                      type="tel"
                      value={whatsappForm.phone_number}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, phone_number: e.target.value })}
                      placeholder="+52 1234567890"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('integrations.phone_hint')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('integrations.contact_email')}</label>
                    <input
                      type="email"
                      value={whatsappForm.contact_email}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, contact_email: e.target.value })}
                      placeholder="contacto@tunegocio.com"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('integrations.additional_info')}</label>
                    <textarea
                      value={whatsappForm.additional_info}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, additional_info: e.target.value })}
                      placeholder={t('integrations.additional_info_placeholder')}
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
                    {t('integrations.cancel')}
                  </button>
                  <button
                    onClick={handleWhatsAppRequest}
                    disabled={loading || !whatsappForm.business_name || !whatsappForm.phone_number || !whatsappForm.contact_email}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? t('integrations.sending') : t('integrations.send_request')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-300 text-sm">
                  {t('integrations.whatsapp_intro')}
                </p>
                <ul className="space-y-2 text-xs text-gray-400">
                  <li className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('integrations.ai_replies')}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('integrations.catalog_integration')}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#04d9b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('integrations.support_247')}
                  </li>
                </ul>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setShowWhatsAppForm(true)}
                    className="w-full px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm"
                  >
                    {t('integrations.request_activation')}
                  </button>
                  <p className="text-xs text-gray-400">
                    {t('integrations.request_activation_hint')}
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
            <span className="text-xs text-gray-400">{t('integrations.calendar_subtitle')}</span>
          </div>
          <div className="flex items-center space-x-3">
            {calendarConfig.ready ? (
              <span className="text-xs text-green-400">{t('integrations.ready')}</span>
            ) : (
              <span className="text-xs text-gray-500">{t('integrations.pending')}</span>
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
                  <p className="text-sm text-white font-medium">{t('integrations.google_account')}</p>
                  <p className="text-xs text-gray-400">
                    {calendarConfig.user_connection_configured
                      ? t('integrations.google_connected_as', { email: calendarConfig.google_account_email || t('integrations.google_no_email') })
                      : t('integrations.google_connect_hint')}
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
                        {googleConnectionLoading ? t('integrations.refreshing') : t('integrations.refresh_calendars')}
                      </button>
                      <button
                        onClick={handleGoogleDisconnect}
                        disabled={googleConnectionLoading}
                        className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
                      >
                        {t('integrations.disconnect_google')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleGoogleConnect}
                      disabled={googleConnectionLoading || !calendarConfig.oauth_client_configured}
                      className="px-3 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-sm text-[#04d9b5] hover:bg-[#04d9b5]/30 transition disabled:opacity-50"
                    >
                      {googleConnectionLoading ? t('integrations.connecting') : t('integrations.connect_google')}
                    </button>
                  )}
                </div>
              </div>

              {!calendarConfig.oauth_client_configured && (
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300">
                  {t('integrations.oauth_missing')}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 p-3">
              <div>
                <p className="text-sm text-white font-medium">{t('integrations.auto_schedule')}</p>
                <p className="text-xs text-gray-400">{t('integrations.auto_schedule_hint')}</p>
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
                  <label className="block text-xs text-gray-400 mb-1">{t('integrations.google_calendar')}</label>
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
                    <option value="">{t('integrations.select_calendar')}</option>
                    {googleCalendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.primary ? t('integrations.primary') : calendar.summary} ({calendar.id})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {googleConnectionLoading ? t('integrations.loading_calendars') : t('integrations.manual_calendar_hint')}
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
                  <label className="block text-xs text-gray-400 mb-1">{t('integrations.timezone')}</label>
                  <select
                    value={calendarConfig.timezone}
                    onChange={(e) => setCalendarConfig((prev) => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[#0f0f17] border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#04d9b5]"
                  >
                    <optgroup label={t('integrations.timezone_mexico')}>
                      <option value="America/Mexico_City">{t('integrations.timezone_mexico_city')}</option>
                      <option value="America/Cancun">{t('integrations.timezone_cancun')}</option>
                      <option value="America/Monterrey">Monterrey (CST/CDT)</option>
                      <option value="America/Chihuahua">Chihuahua (MST/MDT)</option>
                      <option value="America/Tijuana">Tijuana (PST/PDT)</option>
                      <option value="America/Guatemala">Guatemala (CST)</option>
                    </optgroup>
                    <optgroup label={t('integrations.timezone_south_america')}>
                      <option value="America/Bogota">Bogotá (COT)</option>
                      <option value="America/Lima">Lima (PET)</option>
                      <option value="America/Santiago">Santiago (CLT)</option>
                      <option value="America/Buenos_Aires">Buenos Aires (ART)</option>
                      <option value="America/Sao_Paulo">São Paulo (BRT)</option>
                      <option value="America/Caracas">Caracas (VET)</option>
                    </optgroup>
                    <optgroup label={t('integrations.timezone_spain')}>
                      <option value="Europe/Madrid">Madrid (CET/CEST)</option>
                    </optgroup>
                    <optgroup label={t('integrations.timezone_usa')}>
                      <option value="America/New_York">{t('integrations.timezone_new_york')}</option>
                      <option value="America/Chicago">Chicago (CST/CDT)</option>
                      <option value="America/Denver">Denver (MST/MDT)</option>
                      <option value="America/Los_Angeles">{t('integrations.timezone_los_angeles')}</option>
                    </optgroup>
                    <optgroup label={t('integrations.timezone_other')}>
                      <option value="UTC">UTC</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('integrations.duration')}</label>
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
              <p className="text-sm text-white font-medium mb-2">{t('integrations.collect_fields')}</p>
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
                    <span>{t(field.labelKey)}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">{t('integrations.required_date_time')}</p>
            </div>

            <div className={`rounded-lg border p-3 text-xs ${calendarConfig.user_connection_configured || calendarConfig.service_account_configured ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-orange-500/10 border-orange-500/30 text-orange-300'}`}>
              {calendarConfig.user_connection_configured
                ? t('integrations.calendar_user_mode')
                : calendarConfig.service_account_configured
                  ? t('integrations.calendar_service_mode')
                  : t('integrations.calendar_missing_mode')}
            </div>

            <button
              onClick={handleSaveGoogleCalendar}
              disabled={calendarLoading || !calendarConfig.calendar_id}
              className="w-full px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {calendarLoading ? t('integrations.saving') : t('integrations.save_calendar')}
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
            <span className="text-xs text-gray-400">{t('integrations.ecommerce_subtitle')}</span>
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
                {t('integrations.stripe_desc')}
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
                            <span className="text-xs text-green-400">{t('integrations.connected')}</span>
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
                            {t('integrations.connect')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 text-center py-2">
                    {t('integrations.no_brands')}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10"></div>

            {/* Mercado Libre */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">Mercado Libre</h4>
                <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300">{t('integrations.coming_soon')}</span>
              </div>
              <p className="text-xs text-gray-400">
                {t('integrations.mercado_desc')}
              </p>
            </div>

            <div className="border-t border-white/10"></div>

            {/* Shopify */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">Shopify</h4>
                <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300">{t('integrations.coming_soon')}</span>
              </div>
              <p className="text-xs text-gray-400">
                {t('integrations.shopify_desc')}
              </p>
            </div>

            <div className="border-t border-white/10"></div>

            {/* Catálogo - Multi-brand */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">{t('integrations.product_catalog')}</h4>
              <p className="text-xs text-gray-400 mb-3">
                {t('integrations.catalog_desc')}
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
                          <span className="text-xs text-green-400">{t('integrations.configured')}</span>
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
                    {t('integrations.no_brands')}
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500">
                {t('integrations.catalog_help')}{' '}
                <a href="#" className="text-[#04d9b5] hover:underline">
                  {t('integrations.contact_support')}
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
              {t('integrations.web_pages')}
            </h3>
            <span className="text-xs text-gray-400">{t('integrations.web_subtitle')}</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-green-400">{t('integrations.one_site')}</span>
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
              {t('integrations.web_desc')}
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-white text-sm">acidia.app</span>
                <button className="text-red-400 hover:text-red-300 text-xs">{t('integrations.delete')}</button>
              </div>
            </div>
            <button className="px-4 py-2 rounded-lg bg-[#04d9b5]/20 border border-[#04d9b5]/40 text-[#04d9b5] hover:bg-[#04d9b5]/30 transition text-sm">
              {t('integrations.add_website')}
            </button>
          </div>
        )}
      </div>

      {/* ── Shopify ── */}
      <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
        <button
          onClick={() => toggleSection('shopify')}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition group"
        >
          <div className="flex items-center space-x-4">
            <h3 className="text-base font-medium text-white group-hover:text-[#04d9b5] transition">
              Shopify
            </h3>
            <span className="text-xs text-gray-400">{t('integrations.shopify_subtitle')}</span>
          </div>
          <div className="flex items-center space-x-3">
            {shopifyStatus?.connected
              ? <span className="text-xs text-green-400">● {t('integrations.connected')}</span>
              : <span className="text-xs text-gray-500">{t('integrations.not_connected')}</span>}
            <svg
              className={`w-4 h-4 text-[#04d9b5] transition-transform ${activeSection === 'shopify' ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {activeSection === 'shopify' && (
          <div className="px-6 py-5 border-t border-white/10 bg-black/20 space-y-5">

            {shopifyFeedback && (
              <div className={`p-3 rounded-lg text-sm ${shopifyFeedback.type === 'success' ? 'bg-green-500/20 border border-green-500/40 text-green-300' : 'bg-red-500/20 border border-red-500/40 text-red-300'}`}>
                {shopifyFeedback.text}
              </div>
            )}

            {shopifyStatus?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div>
                    <p className="text-white font-medium text-sm">{shopifyStatus.shopName || shopifyStatus.domain}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{shopifyStatus.domain}</p>
                  </div>
                  <button
                    onClick={handleShopifyDisconnect}
                    disabled={shopifyLoading}
                    className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                  >
                    {t('integrations.disconnect')}
                  </button>
                </div>

                <div>
                  <button
                    onClick={handleShopifyPreview}
                    disabled={shopifyProductsLoading}
                    className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/15 transition disabled:opacity-50"
                  >
                    {shopifyProductsLoading ? t('facebook.loading') : t('integrations.view_synced_products')}
                  </button>
                </div>

                {shopifyProducts.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {shopifyProducts.map((p, i) => (
                      <div key={p.id || i} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10">
                        {p.image && <img src={p.image} alt={p.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate">{p.name}</p>
                          <p className="text-[#04d9b5] text-xs">{p.price || '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400 text-xs">
                  {t('integrations.shopify_connect_desc')}
                </p>

                {/* Opción principal: OAuth (un clic) */}
                <form onSubmit={handleShopifyOAuth} className="space-y-3 p-4 rounded-xl bg-[#04d9b5]/5 border border-[#04d9b5]/20">
                  <p className="text-[#04d9b5] text-xs font-semibold">{t('integrations.recommended_oauth')}</p>
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="mi-tienda.myshopify.com"
                      value={shopifyForm.domain}
                      onChange={e => setShopifyForm(prev => ({ ...prev, domain: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#04d9b5]/60"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={shopifyLoading}
                    className="w-full py-2.5 rounded-lg bg-[#04d9b5] text-black font-semibold text-sm hover:bg-[#04d9b5]/90 transition disabled:opacity-50"
                  >
                    {shopifyLoading ? t('integrations.redirecting') : t('integrations.authorize_shopify')}
                  </button>
                  <p className="text-gray-500 text-xs">{t('integrations.shopify_oauth_hint')}</p>
                </form>

                {/* Opción avanzada: token manual */}
                <details className="group">
                  <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-300">
                    {t('integrations.advanced_token')}
                  </summary>
                  <form onSubmit={handleShopifyConnect} className="space-y-3 mt-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShopifyForm(prev => ({ ...prev, tokenType: 'admin' }))}
                        className={`flex-1 py-1.5 rounded text-xs border ${shopifyForm.tokenType === 'admin' ? 'bg-[#04d9b5]/20 border-[#04d9b5]/50 text-[#04d9b5]' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                        Admin Token
                      </button>
                      <button type="button" onClick={() => setShopifyForm(prev => ({ ...prev, tokenType: 'storefront' }))}
                        className={`flex-1 py-1.5 rounded text-xs border ${shopifyForm.tokenType === 'storefront' ? 'bg-[#04d9b5]/20 border-[#04d9b5]/50 text-[#04d9b5]' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                        Storefront Token
                      </button>
                    </div>
                    <input type="password" required
                      placeholder={shopifyForm.tokenType === 'admin' ? 'shpat_...' : t('integrations.storefront_token_placeholder')}
                      value={shopifyForm.tokenType === 'admin' ? shopifyForm.adminToken : shopifyForm.storefrontToken}
                      onChange={e => setShopifyForm(prev => shopifyForm.tokenType === 'admin'
                        ? { ...prev, adminToken: e.target.value }
                        : { ...prev, storefrontToken: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#04d9b5]/60"
                    />
                    <button type="submit" disabled={shopifyLoading}
                      className="w-full py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/15 transition disabled:opacity-50">
                      {shopifyLoading ? t('integrations.saving') : t('integrations.save_token')}
                    </button>
                  </form>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
