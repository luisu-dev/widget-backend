import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Welcome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate('/login')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [sessionId, navigate])

  const steps = t('welcome.steps', { returnObjects: true }) as string[]
  const emailItems = t('welcome.email_items', { returnObjects: true }) as string[]

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--md-background)' }}
    >
      <div className="w-full max-w-[560px]">

        {/* Success icon */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
            style={{ background: 'var(--md-primary-container)' }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M10 20l7 7 13-14"
                stroke="var(--md-primary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1
            className="text-[32px] font-bold tracking-tight mb-2"
            style={{ color: 'var(--md-on-surface)' }}
          >
            {t('welcome.title')}
          </h1>
          <p style={{ color: 'var(--md-on-surface-variant)' }}>
            {t('welcome.subtitle')}
          </p>
        </div>

        {/* Email notice card */}
        <div
          className="rounded-[16px] p-5 mb-4 flex items-start gap-4"
          style={{
            background: 'var(--md-primary-container)',
            boxShadow: 'var(--md-elevation-1)'
          }}
        >
          <div
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5"
            style={{ background: 'rgba(4,217,181,.2)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="var(--md-primary)" strokeWidth="1.8"/>
              <path d="M3 7l9 6 9-6" stroke="var(--md-primary)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p
              className="font-semibold mb-1"
              style={{ color: 'var(--md-on-primary-container)' }}
            >
              {t('welcome.email_title')}
            </p>
            <p className="text-sm mb-3" style={{ color: 'var(--md-on-primary-container)' }}>
              {t('welcome.email_intro')}
            </p>
            <ul className="space-y-1">
              {emailItems.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm" style={{ color: 'var(--md-on-primary-container)' }}>
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: 'var(--md-primary)' }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Next steps card */}
        <div
          className="rounded-[16px] p-5 mb-6"
          style={{
            background: 'var(--md-surface-container)',
            boxShadow: 'var(--md-elevation-1)'
          }}
        >
          <p
            className="font-semibold mb-3"
            style={{ color: 'var(--md-on-surface)' }}
          >
            {t('welcome.next_steps')}
          </p>
          <ol className="space-y-2.5">
            {steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold mt-0.5"
                  style={{
                    background: 'var(--md-primary-container)',
                    color: 'var(--md-on-primary-container)'
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-sm" style={{ color: 'var(--md-on-surface-variant)' }}>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/login')}
          className="md-btn-filled w-full py-3.5 text-[15px] mb-4"
        >
          {t('welcome.login_now')}
        </button>

        <p className="text-sm text-center" style={{ color: 'var(--md-on-surface-variant)' }}>
          {t('welcome.redirect_prefix')}{' '}
          <span className="font-semibold" style={{ color: 'var(--md-primary)' }}>
            {countdown}
          </span>{' '}
          {t('welcome.redirect_suffix')}
        </p>

        {/* Support */}
        <p className="text-[12px] text-center mt-6" style={{ color: 'var(--md-on-surface-variant)' }}>
          {t('welcome.need_help')}{' '}
          <a
            href="mailto:info@acidia.app"
            className="underline font-medium"
            style={{ color: 'var(--md-primary)' }}
          >
            {t('welcome.contact_us')}
          </a>
        </p>
      </div>
    </div>
  )
}
