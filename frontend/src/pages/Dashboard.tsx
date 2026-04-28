import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandConfig from '../components/dashboard/BrandConfig';
import Integrations from '../components/Integrations';
import { API_BASE } from '../config'

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
    orders_notify_phone?: string;
    widget_chips?: string[];
    bot_off_message?: string;
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

// ─── Helpers ───────────────────────────────────────────────────────────────

function MdSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className="relative inline-flex items-center transition-all"
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        background: checked ? 'var(--md-primary)' : 'var(--md-outline)',
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        outline: 'none',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: checked ? 24 : 4,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: checked ? 'var(--md-on-primary)' : 'var(--md-surface-container-high)',
          boxShadow: 'var(--md-elevation-1)',
          transition: 'left .2s, background .2s',
        }}
      />
    </button>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-[16px] p-5"
      style={{
        background: 'var(--md-surface-container)',
        boxShadow: 'var(--md-elevation-1)',
      }}
    >
      <p className="text-[12px] font-medium uppercase tracking-[.08em] mb-2" style={{ color: 'var(--md-on-surface-variant)' }}>
        {label}
      </p>
      <p className="text-[32px] font-bold leading-none" style={{ color: 'var(--md-on-surface)' }}>
        {value}
      </p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

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
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [conversationBotEnabled, setConversationBotEnabled] = useState(true);
  const [togglingConversationBot, setTogglingConversationBot] = useState(false);
  const [contactForm, setContactForm] = useState({ whatsapp: '', whatsapp_notifications: '', widget_chips: '' });
  const [savingContact, setSavingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState('');

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

      if (pages.length === 0) {
        setSelectedPage(null);
        setMessages([]);
        setSelectedSession(null);
        setConversationMessages([]);
        return;
      }

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

  useEffect(() => {
    if (activeTab === 'messages' && token) {
      if (facebookPages.length === 0) {
        setMessages([]);
        setSelectedSession(null);
        setConversationMessages([]);
        return;
      }
      fetchMessages();
    }
  }, [activeTab, token, selectedPage, facebookPages.length]);

  useEffect(() => {
    if (activeTab !== 'messages' || !token) return;
    const id = setInterval(() => { fetchMessages(); }, 5000);
    return () => clearInterval(id);
  }, [activeTab, token, selectedPage, facebookPages.length]);

  useEffect(() => {
    if (activeTab === 'metrics' && token) {
      fetchMetrics();
    }
  }, [activeTab, token, selectedPage]);

  useEffect(() => {
    if (profile?.tenant?.settings?.bot_enabled !== undefined) {
      setBotEnabled(profile.tenant.settings.bot_enabled);
    }
    if (profile?.tenant) {
      setContactForm({
        whatsapp: profile.tenant.whatsapp || '',
        whatsapp_notifications: profile.tenant.settings?.orders_notify_phone || '',
        widget_chips: (profile.tenant.settings?.widget_chips || []).join(', '),
      });
    }
  }, [profile]);

  const fetchMessages = async () => {
    try {
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

  const groupedConversations = () => {
    const groups: { [key: string]: any[] } = {};
    messages.forEach(msg => {
      if (!groups[msg.session_id]) groups[msg.session_id] = [];
      groups[msg.session_id].push(msg);
    });

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
    setReplyMessage('');
    const conv = groupedConversations().find(c => c.sessionId === sessionId);
    if (conv) setConversationMessages(conv.messages);
    fetchConversationBotState(sessionId);
  };

  useEffect(() => {
    if (!selectedSession) return;
    const conv = groupedConversations().find(c => c.sessionId === selectedSession);
    if (conv) setConversationMessages(conv.messages);
  }, [messages, selectedSession]);

  const sendReply = async () => {
    if (!selectedSession || !replyMessage.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: selectedSession,
          message: replyMessage.trim(),
          page_id: selectedPage?.page_id
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Error al enviar mensaje');
      }

      const newMessage = {
        id: Date.now(),
        direction: 'out',
        author: 'Admin',
        content: replyMessage.trim(),
        created_at: new Date().toISOString()
      };
      setConversationMessages([...conversationMessages, newMessage]);
      setReplyMessage('');
      setTimeout(() => fetchMessages(), 1000);
    } catch (err: any) {
      console.error('Error sending reply:', err);
      setError(err.message || 'Error al enviar mensaje');
    } finally {
      setSendingReply(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const pageParam = selectedPage ? `&page_id=${selectedPage.page_id}` : '';
      const url = `${API_BASE}/v1/admin/metrics/overview?days=7${pageParam}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

      if (!res.ok) throw new Error('Error al cargar métricas');

      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Error al cargar métricas');
      setMetrics({
        messages: { inbound: 0, outbound: 0, conversations: 0 },
        approxTokens: 0,
        leads: 0,
        actions: {}
      });
    }
  };

  const fetchConversationBotState = async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE}/v1/admin/conversations/bot-state?session_id=${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al consultar estado del bot');
      const data = await res.json();
      setConversationBotEnabled(Boolean(data.bot_enabled));
    } catch (err) {
      console.error('Error fetching conversation bot state:', err);
      setConversationBotEnabled(true);
    }
  };

  const toggleConversationBot = async () => {
    if (!selectedSession) return;
    setTogglingConversationBot(true);
    const nextState = !conversationBotEnabled;
    try {
      const res = await fetch(`${API_BASE}/v1/admin/conversations/bot-toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ session_id: selectedSession, enabled: nextState })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al cambiar estado del bot');
      }
      setConversationBotEnabled(nextState);
    } catch (err: any) {
      console.error('Error toggling conversation bot:', err);
      setError(err.message || 'Error al cambiar estado del bot');
    } finally {
      setTogglingConversationBot(false);
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
        body: JSON.stringify({ settings: { bot_enabled: newState } })
      });
      if (!res.ok) throw new Error('Error al actualizar configuración');
      setBotEnabled(newState);
      const profileRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (profileRes.ok) setProfile(await profileRes.json());
    } catch (err) {
      console.error('Error toggling bot:', err);
      setError('Error al cambiar estado del bot');
    } finally {
      setSavingBotState(false);
    }
  };

  const saveContactSettings = async () => {
    setSavingContact(true);
    try {
      const chips = contactForm.widget_chips
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
      const res = await fetch(`${API_BASE}/v1/admin/tenant/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          whatsapp: contactForm.whatsapp.trim() || null,
          settings: {
            orders_notify_phone: contactForm.whatsapp_notifications.trim() || null,
            widget_chips: chips.length ? chips : null,
          }
        })
      });
      if (!res.ok) throw new Error('Error al guardar');
      setContactSuccess('Guardado correctamente');
      setTimeout(() => setContactSuccess(''), 3000);
      const profileRes = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (profileRes.ok) setProfile(await profileRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingContact(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zia_token');
    setToken('');
    navigate('/login');
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--md-background)' }}
      >
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--md-outline-variant)', borderTopColor: 'var(--md-primary)' }}
        />
        <p style={{ color: 'var(--md-on-surface-variant)' }}>Cargando…</p>
      </div>
    );
  }

  if (!profile) return null;

  const TABS = [
    { id: 'integrations', label: 'Integraciones' },
    { id: 'messages',     label: 'Conversaciones' },
    { id: 'metrics',      label: 'Métricas' },
    { id: 'settings',     label: 'Configuración' },
  ];

  const isAdmin =
    ['acid-ia', 'acidia', 'acidium'].includes(profile.tenant.slug) ||
    profile.user.email?.endsWith('@acidia.app');

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'var(--md-background)' }}>

      {/* ── Top App Bar ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6"
        style={{
          height: 64,
          background: 'var(--md-surface-container)',
          boxShadow: 'var(--md-elevation-2)',
        }}
      >
        <div className="min-w-0">
          <h1
            className="text-[20px] font-semibold leading-tight truncate"
            style={{ color: 'var(--md-on-surface)' }}
          >
            {profile.tenant.name || 'Dashboard'}
          </h1>
          <p className="text-[12px] truncate" style={{ color: 'var(--md-on-surface-variant)' }}>
            {profile.user.email}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="md-btn-tonal px-3 py-1.5 text-[13px]"
            >
              Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="md-btn-outlined px-3 py-1.5 text-[13px]"
          >
            <span className="sm:hidden">Salir</span>
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      {/* ── Navigation Tabs ── */}
      <div
        style={{
          background: 'var(--md-surface-container)',
          borderBottom: '1px solid var(--md-outline-variant)',
        }}
      >
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`md-tab${activeTab === tab.id ? ' active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Facebook page selector */}
        {facebookPages.length > 0 && selectedPage && (
          <div
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 flex items-center gap-2"
          >
            <span className="text-[12px]" style={{ color: 'var(--md-on-surface-variant)' }}>
              Página:
            </span>
            {facebookPages.length === 1 ? (
              <span
                className="text-[13px] font-medium px-3 py-1 rounded-full"
                style={{
                  background: 'var(--md-primary-container)',
                  color: 'var(--md-on-primary-container)',
                }}
              >
                {selectedPage.page_name} {selectedPage.ig_user_id ? '📷' : '👥'}
              </span>
            ) : (
              <select
                value={selectedPage.page_id}
                onChange={(e) => {
                  const page = facebookPages.find(p => p.page_id === e.target.value);
                  if (page) setSelectedPage(page);
                }}
                className="text-[13px] font-medium px-3 py-1 rounded-full border focus:outline-none"
                style={{
                  background: 'var(--md-primary-container)',
                  color: 'var(--md-on-primary-container)',
                  borderColor: 'var(--md-primary)',
                }}
              >
                {facebookPages.map((page) => (
                  <option key={page.page_id} value={page.page_id} style={{ background: 'var(--md-surface-container)' }}>
                    {page.page_name} {page.ig_user_id ? '📷' : '👥'}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Global error banner */}
        {error && (
          <div
            className="flex items-start gap-3 rounded-[12px] p-4 mb-6"
            style={{
              background: 'rgba(147,0,10,.25)',
              border: '1px solid var(--md-error-container)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" stroke="var(--md-error)" strokeWidth="1.8"/>
              <path d="M12 8v5" stroke="var(--md-error)" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="12" cy="16.5" r=".75" fill="var(--md-error)"/>
            </svg>
            <p style={{ color: 'var(--md-error)' }}>{error}</p>
            <button
              onClick={() => setError('')}
              className="ml-auto text-lg leading-none"
              style={{ color: 'var(--md-error)', opacity: 0.7 }}
            >
              ×
            </button>
          </div>
        )}

        {/* ── Tab: Integrations ── */}
        {activeTab === 'integrations' && (
          <Integrations
            token={token}
            onConnectionChange={() => {
              fetchProfile(false);
              fetchFacebookPages();
            }}
          />
        )}

        {/* ── Tab: Messages ── */}
        {activeTab === 'messages' && (
          <div className="space-y-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[22px] font-semibold" style={{ color: 'var(--md-on-surface)' }}>
                  {selectedSession ? 'Conversación' : 'Conversaciones'}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                  {selectedSession
                    ? 'Mensajes de la sesión'
                    : `${groupedConversations().length} conversaciones activas`}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedSession && (
                  <button
                    onClick={() => { setSelectedSession(null); setConversationMessages([]); }}
                    className="md-btn-outlined px-4 py-2 text-sm"
                  >
                    ← Volver
                  </button>
                )}
                <button
                  onClick={fetchMessages}
                  className="md-btn-tonal px-4 py-2 text-sm"
                >
                  Actualizar
                </button>
              </div>
            </div>

            {/* Conversation list */}
            {!selectedSession && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedConversations().length === 0 ? (
                  <div
                    className="col-span-full rounded-[16px] p-10 text-center"
                    style={{ background: 'var(--md-surface-container)' }}
                  >
                    <p style={{ color: 'var(--md-on-surface-variant)' }}>No hay conversaciones aún</p>
                  </div>
                ) : (
                  groupedConversations().map((conv) => {
                    const isInstagram = conv.lastMessage.channel === 'instagram_dm';
                    const isFacebook = conv.lastMessage.channel === 'facebook_dm';

                    return (
                      <div
                        key={conv.sessionId}
                        onClick={() => openConversation(conv.sessionId)}
                        className="rounded-[16px] p-4 cursor-pointer transition-all hover:brightness-110"
                        style={{
                          background: isInstagram
                            ? 'color-mix(in srgb, #a200ff 12%, var(--md-surface-container))'
                            : isFacebook
                              ? 'color-mix(in srgb, #1877f2 12%, var(--md-surface-container))'
                              : 'var(--md-surface-container)',
                          boxShadow: 'var(--md-elevation-1)',
                          border: isInstagram
                            ? '1px solid rgba(162,0,255,.3)'
                            : isFacebook
                              ? '1px solid rgba(24,119,242,.3)'
                              : '1px solid var(--md-outline-variant)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="text-[11px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                            style={{
                              background: isInstagram
                                ? 'rgba(162,0,255,.2)'
                                : isFacebook
                                  ? 'rgba(24,119,242,.2)'
                                  : 'var(--md-surface-container-high)',
                              color: isInstagram
                                ? '#d87eff'
                                : isFacebook
                                  ? '#78aaff'
                                  : 'var(--md-on-surface-variant)',
                            }}
                          >
                            {isInstagram ? 'Instagram' : isFacebook ? 'Messenger' : conv.lastMessage.channel}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--md-on-surface-variant)' }}>
                            {conv.messageCount} msgs
                          </span>
                        </div>
                        <p className="text-[12px] mb-1 truncate font-mono" style={{ color: 'var(--md-on-surface-variant)' }}>
                          {conv.sessionId.substring(0, 16)}…
                        </p>
                        <p className="text-sm line-clamp-2 mb-2" style={{ color: 'var(--md-on-surface)' }}>
                          {conv.lastMessage.content}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--md-on-surface-variant)' }}>
                          {new Date(conv.lastMessage.created_at).toLocaleString('es-MX')}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Conversation detail */}
            {selectedSession && (
              <div
                className="rounded-[16px] overflow-hidden"
                style={{ background: 'var(--md-surface-container)', boxShadow: 'var(--md-elevation-1)' }}
              >
                {/* Conversation header */}
                <div
                  className="p-4"
                  style={{ borderBottom: '1px solid var(--md-outline-variant)' }}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest font-medium mb-0.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                        Sesión
                      </p>
                      <p className="text-sm font-mono" style={{ color: 'var(--md-on-surface)' }}>
                        {selectedSession}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[12px]" style={{ color: 'var(--md-on-surface-variant)' }}>
                          Bot en esta conversación
                        </p>
                        <p
                          className="text-[13px] font-semibold"
                          style={{ color: conversationBotEnabled ? 'var(--md-primary)' : 'var(--md-on-surface-variant)' }}
                        >
                          {conversationBotEnabled ? 'Activo' : 'Pausado'}
                        </p>
                      </div>
                      <MdSwitch
                        checked={conversationBotEnabled}
                        onChange={toggleConversationBot}
                        disabled={togglingConversationBot}
                      />
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
                  {conversationMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'in' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className="max-w-[72%] rounded-[16px] px-4 py-3"
                        style={{
                          background: msg.direction === 'in'
                            ? 'var(--md-surface-container-high)'
                            : 'var(--md-primary-container)',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[11px] font-medium"
                            style={{
                              color: msg.direction === 'in'
                                ? 'var(--md-on-surface-variant)'
                                : 'var(--md-on-primary-container)',
                            }}
                          >
                            {msg.direction === 'in' ? msg.author || 'Cliente' : 'Bot'}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--md-outline)' }}>
                            {new Date(msg.created_at).toLocaleTimeString('es-MX')}
                          </span>
                        </div>
                        <p
                          className="text-sm"
                          style={{
                            color: msg.direction === 'in'
                              ? 'var(--md-on-surface)'
                              : 'var(--md-on-primary-container)',
                          }}
                        >
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply input */}
                {(() => {
                  const platform = selectedSession?.split(':')[0];
                  const canReply = platform === 'fb' || platform === 'ig' || platform === 'wa';
                  const channelLabel = platform === 'wa'
                    ? 'WhatsApp (Twilio)'
                    : platform === 'ig'
                      ? 'Instagram DM'
                      : platform === 'fb'
                        ? 'Facebook Messenger'
                        : null;

                  if (!canReply) {
                    return (
                      <div
                        className="px-4 py-3 text-[12px]"
                        style={{
                          borderTop: '1px solid var(--md-outline-variant)',
                          color: 'var(--md-on-surface-variant)',
                        }}
                      >
                        Este canal no soporta respuesta manual desde el dashboard.
                      </div>
                    );
                  }

                  return (
                    <div
                      className="p-4"
                      style={{ borderTop: '1px solid var(--md-outline-variant)' }}
                    >
                      {channelLabel && (
                        <p className="text-[12px] mb-2" style={{ color: 'var(--md-on-surface-variant)' }}>
                          Respondiendo por {channelLabel}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
                          }}
                          placeholder="Escribe tu respuesta…"
                          disabled={sendingReply}
                          className="flex-1 px-4 py-2.5 rounded-[8px] border text-sm focus:outline-none"
                          style={{
                            background: 'var(--md-surface-container-high)',
                            border: '1px solid var(--md-outline-variant)',
                            color: 'var(--md-on-surface)',
                          }}
                        />
                        <button
                          onClick={sendReply}
                          disabled={sendingReply || !replyMessage.trim()}
                          className="md-btn-filled px-4 py-2.5 text-sm"
                        >
                          {sendingReply ? '…' : 'Enviar'}
                        </button>
                      </div>
                      <p className="text-[11px] mt-2" style={{ color: 'var(--md-on-surface-variant)' }}>
                        Presiona Enter para enviar. El bot queda pausado en esta conversación.
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Metrics ── */}
        {activeTab === 'metrics' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[22px] font-semibold" style={{ color: 'var(--md-on-surface)' }}>
                  Métricas
                </h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                  Últimos 7 días
                </p>
              </div>
              <button onClick={fetchMetrics} className="md-btn-tonal px-4 py-2 text-sm">
                Actualizar
              </button>
            </div>

            {metrics ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Conversaciones" value={metrics.messages?.conversations || 0} />
                <MetricCard label="Mensajes recibidos" value={metrics.messages?.inbound || 0} />
                <MetricCard label="Mensajes enviados" value={metrics.messages?.outbound || 0} />
                <MetricCard label="Tokens aprox." value={(metrics.approxTokens || 0).toLocaleString()} />
                <MetricCard label="Leads capturados" value={metrics.leads || 0} />
                {metrics.actions && Object.entries(metrics.actions).map(([type, count]: [string, any]) => (
                  <MetricCard key={type} label={type.replace(/_/g, ' ')} value={count || 0} />
                ))}
              </div>
            ) : (
              <div
                className="rounded-[16px] p-10 text-center"
                style={{ background: 'var(--md-surface-container)' }}
              >
                <div
                  className="inline-block w-8 h-8 rounded-full border-4 border-t-transparent animate-spin mb-3"
                  style={{ borderColor: 'var(--md-outline-variant)', borderTopColor: 'var(--md-primary)' }}
                />
                <p style={{ color: 'var(--md-on-surface-variant)' }}>Cargando métricas…</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Settings ── */}
        {activeTab === 'settings' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <h2 className="text-[22px] font-semibold" style={{ color: 'var(--md-on-surface)' }}>
                Configuración
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                Ajusta la configuración de tu tenant
              </p>
            </div>

            {/* Info banner */}
            <div
              className="flex items-start gap-3 rounded-[12px] p-4"
              style={{
                background: 'var(--md-primary-container)',
                color: 'var(--md-on-primary-container)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" stroke="var(--md-primary)" strokeWidth="1.8"/>
                <path d="M12 11v6" stroke="var(--md-primary)" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="12" cy="8" r=".75" fill="var(--md-primary)"/>
              </svg>
              <p className="text-[13px]">
                Esta configuración aplica a todos tus canales: widget web, WhatsApp, Facebook e Instagram.
              </p>
            </div>

            {/* Brand Config */}
            <BrandConfig
              token={token}
              tenant={profile.tenant}
              selectedPage={selectedPage}
              onUpdate={() => {
                fetchProfile(false);
                fetchFacebookPages();
              }}
            />

            {/* Contact & Widget chips */}
            <div
              className="rounded-[16px] p-6 space-y-5"
              style={{ background: 'var(--md-surface-container)', boxShadow: 'var(--md-elevation-1)' }}
            >
              <div>
                <h3 className="text-[17px] font-semibold" style={{ color: 'var(--md-on-surface)' }}>
                  Contacto y Widget
                </h3>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                  Números de WhatsApp y botones del chat
                </p>
              </div>

              {contactSuccess && (
                <div
                  className="flex items-center gap-2 rounded-[8px] p-3 text-[13px]"
                  style={{
                    background: 'rgba(0,55,48,.4)',
                    border: '1px solid var(--md-primary-container)',
                    color: 'var(--md-on-primary-container)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="var(--md-primary)" strokeWidth="1.8"/>
                    <path d="M8 12l3 3 5-5" stroke="var(--md-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {contactSuccess}
                </div>
              )}

              <div className="md-field">
                <label>WhatsApp para redirecciones</label>
                <input
                  type="text"
                  value={contactForm.whatsapp}
                  onChange={e => setContactForm(p => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="525512345678 (sin + ni espacios)"
                />
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                  El bot enviará aquí el link «Contactar por WhatsApp» en el widget
                </p>
              </div>

              <div className="md-field">
                <label>WhatsApp para notificaciones (Shopify)</label>
                <input
                  type="text"
                  value={contactForm.whatsapp_notifications}
                  onChange={e => setContactForm(p => ({ ...p, whatsapp_notifications: e.target.value }))}
                  placeholder="525512345678 (sin + ni espacios)"
                />
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                  Recibe alertas de nuevas órdenes de Shopify
                </p>
              </div>

              <div className="md-field">
                <label>Botones del widget (chips)</label>
                <input
                  type="text"
                  value={contactForm.widget_chips}
                  onChange={e => setContactForm(p => ({ ...p, widget_chips: e.target.value }))}
                  placeholder="Ver catálogo, Solicitar cotización, Contactar por WhatsApp"
                />
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                  Separados por coma — máx. 4 recomendado
                </p>
              </div>

              <button
                onClick={saveContactSettings}
                disabled={savingContact}
                className="md-btn-filled w-full py-3 text-[15px]"
              >
                {savingContact ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>

            {/* Bot Control */}
            <div
              className="rounded-[16px] p-6"
              style={{ background: 'var(--md-surface-container)', boxShadow: 'var(--md-elevation-1)' }}
            >
              <h3 className="text-[17px] font-semibold mb-4" style={{ color: 'var(--md-on-surface)' }}>
                Control del Bot
              </h3>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium" style={{ color: 'var(--md-on-surface)' }}>
                    Estado del Bot de IA
                  </p>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                    {botEnabled
                      ? 'Respondiendo automáticamente a los mensajes'
                      : 'Pausado — los mensajes no recibirán respuesta automática'}
                  </p>
                </div>
                <MdSwitch
                  checked={botEnabled}
                  onChange={toggleBot}
                  disabled={savingBotState}
                />
              </div>
              <div
                className="mt-4 pt-4 text-[12px]"
                style={{
                  borderTop: '1px solid var(--md-outline-variant)',
                  color: 'var(--md-on-surface-variant)',
                }}
              >
                Usa el interruptor para pausar el bot cuando quieras responder manualmente a tus clientes.
              </div>
            </div>

            {/* Tenant Info */}
            <div
              className="rounded-[16px] p-6"
              style={{ background: 'var(--md-surface-container)', boxShadow: 'var(--md-elevation-1)' }}
            >
              <h3 className="text-[17px] font-semibold mb-4" style={{ color: 'var(--md-on-surface)' }}>
                Información del Tenant
              </h3>
              <dl className="space-y-3">
                {[
                  { label: 'Nombre', value: profile.tenant.name },
                  { label: 'Slug', value: profile.tenant.slug },
                  ...(profile.tenant.whatsapp ? [{ label: 'WhatsApp', value: profile.tenant.whatsapp }] : []),
                  { label: 'Bot', value: botEnabled ? 'Activo' : 'Pausado', highlight: botEnabled },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex items-center justify-between">
                    <dt className="text-[13px]" style={{ color: 'var(--md-on-surface-variant)' }}>
                      {label}
                    </dt>
                    <dd
                      className="text-[13px] font-medium"
                      style={{ color: highlight !== undefined ? (highlight ? 'var(--md-primary)' : 'var(--md-on-surface-variant)') : 'var(--md-on-surface)' }}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
