import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface RegisterForm {
  fullName: string
  phone: string
  email: string
  businessName: string
  whatsappNumber: string
  website: string
  plan: 'starter' | 'addon-whatsapp' | 'addon-ecommerce' | 'web-basic' | 'web-premium' | 'web-ecommerce'
}

export default function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<RegisterForm>({
    fullName: '',
    phone: '',
    email: '',
    businessName: '',
    whatsappNumber: '',
    website: '',
    plan: 'starter'
  })

  useEffect(() => {
    const planFromUrl = searchParams.get('plan')
    const validPlans = ['starter', 'addon-whatsapp', 'addon-ecommerce', 'web-basic', 'web-premium', 'web-ecommerce']
    if (planFromUrl && validPlans.includes(planFromUrl)) {
      setForm(prev => ({ ...prev, plan: planFromUrl as any }))
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/v1/pre-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.fullName,
          phone: form.phone,
          email: form.email,
          business_name: form.businessName,
          whatsapp_number: form.whatsappNumber,
          website: form.website,
          plan: form.plan
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || t('register.create_error'))
      }

      const data = await response.json()
      window.location.href = data.checkout_url
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const plans = t('register.plans', { returnObjects: true }) as Array<{
    id: RegisterForm['plan']
    name: string
    subtitle: string
    price: string
    features: string[]
  }>

  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{ background: 'var(--md-background)' }}
    >
      <div className="max-w-[560px] mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <h1
            className="text-[32px] font-bold tracking-tight mb-2"
            style={{ color: 'var(--md-on-surface)' }}
          >
            AcidIA
          </h1>
          <p className="text-base" style={{ color: 'var(--md-on-surface-variant)' }}>
            {t('register.subtitle')}
          </p>
          <button
            onClick={() => navigate('/login')}
            className="md-btn-text mt-3 text-sm"
          >
            {t('auth.login_link')}
          </button>
        </div>

        {/* Form card */}
        <div
          className="rounded-[28px] p-8 space-y-8"
          style={{
            background: 'var(--md-surface-container)',
            boxShadow: 'var(--md-elevation-2)'
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* ── Sección 1: Datos de contacto ── */}
            <section className="space-y-5">
              <div>
                <h2
                  className="text-[18px] font-semibold mb-0.5"
                  style={{ color: 'var(--md-on-surface)' }}
                >
                  {t('register.contact_section')}
                </h2>
                <hr style={{ borderColor: 'var(--md-outline-variant)', marginTop: '12px' }} />
              </div>

              <div className="md-field">
                <label>{t('register.full_name')}</label>
                <input
                  type="text"
                  name="fullName"
                  required
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder={t('register.full_name_placeholder')}
                />
              </div>

              <div className="md-field">
                <label>{t('register.phone')}</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+52 999 123 4567"
                />
              </div>

              <div className="md-field">
                <label>{t('auth.email')} *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="juan@ejemplo.com"
                />
              </div>
            </section>

            {/* ── Sección 2: Datos del negocio ── */}
            <section className="space-y-5">
              <div>
                <h2
                  className="text-[18px] font-semibold mb-0.5"
                  style={{ color: 'var(--md-on-surface)' }}
                >
                  {t('register.business_section')}
                </h2>
                <hr style={{ borderColor: 'var(--md-outline-variant)', marginTop: '12px' }} />
              </div>

              <div className="md-field">
                <label>{t('register.business_name')}</label>
                <input
                  type="text"
                  name="businessName"
                  required
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder={t('register.business_name_placeholder')}
                />
                <p className="text-[12px] mt-1.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                  {t('register.business_hint')}
                </p>
              </div>

              <div className="md-field">
                <label>{t('register.whatsapp_number')}</label>
                <input
                  type="tel"
                  name="whatsappNumber"
                  value={form.whatsappNumber}
                  onChange={handleChange}
                  placeholder="+52 999 123 4567"
                />
              </div>

              <div className="md-field">
                <label>{t('register.website')}</label>
                <input
                  type="url"
                  name="website"
                  value={form.website}
                  onChange={handleChange}
                  placeholder="https://mitienda.com"
                />
              </div>
            </section>

            {/* ── Sección 3: Plan ── */}
            <section className="space-y-4">
              <div>
                <h2
                  className="text-[18px] font-semibold mb-0.5"
                  style={{ color: 'var(--md-on-surface)' }}
                >
                  {t('register.plan_section')}
                </h2>
                <hr style={{ borderColor: 'var(--md-outline-variant)', marginTop: '12px' }} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plans.map((plan) => {
                  const selected = form.plan === plan.id
                  return (
                    <label
                      key={plan.id}
                      className="relative cursor-pointer rounded-[16px] p-5 transition-all"
                      style={{
                        background: selected ? 'var(--md-primary-container)' : 'var(--md-surface-container-high)',
                        border: selected
                          ? '2px solid var(--md-primary)'
                          : '1px solid var(--md-outline-variant)',
                        boxShadow: selected ? 'var(--md-elevation-1)' : 'none',
                      }}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={selected}
                        onChange={handleChange}
                        className="sr-only"
                      />

                      {/* Selected check */}
                      {selected && (
                        <div
                          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--md-primary)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 7l3.5 3.5 5.5-6" stroke="var(--md-on-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}

                      <p
                        className="text-[15px] font-semibold mb-0.5"
                        style={{ color: selected ? 'var(--md-on-primary-container)' : 'var(--md-on-surface)' }}
                      >
                        {plan.name}
                      </p>
                      <p
                        className="text-[12px] mb-3"
                        style={{ color: selected ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)' }}
                      >
                        {plan.subtitle}
                      </p>
                      <p
                        className="text-[22px] font-bold mb-1"
                        style={{ color: 'var(--md-primary)' }}
                      >
                        {plan.price}
                      </p>
                      <p
                        className="text-[11px] mb-3"
                        style={{ color: selected ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)' }}
                      >
                        {t('register.tax')}
                      </p>
                      <ul className="space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <span
                              className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ background: 'var(--md-primary)' }}
                            />
                            <span
                              className="text-[13px]"
                              style={{ color: selected ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)' }}
                            >
                              {f}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </label>
                  )
                })}
              </div>
            </section>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-3 rounded-xl p-3"
                style={{
                  background: 'rgba(147,0,10,.25)',
                  border: '1px solid var(--md-error-container)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" stroke="var(--md-error)" strokeWidth="1.8"/>
                  <path d="M12 8v5" stroke="var(--md-error)" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="12" cy="16.5" r=".75" fill="var(--md-error)"/>
                </svg>
                <p className="text-sm" style={{ color: 'var(--md-error)' }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="md-btn-filled w-full py-3.5 text-[15px]"
            >
              {loading ? t('register.processing') : t('register.continue_payment')}
            </button>

            <p className="text-[12px] text-center" style={{ color: 'var(--md-on-surface-variant)' }}>
              {t('register.terms_prefix')}{' '}
              <a href="/terms" className="underline" style={{ color: 'var(--md-primary)' }}>
                {t('register.terms')}
              </a>{' '}
              {t('register.and')}{' '}
              <a href="/privacy" className="underline" style={{ color: 'var(--md-primary)' }}>
                {t('register.privacy')}
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
