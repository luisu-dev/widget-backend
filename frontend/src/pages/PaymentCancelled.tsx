import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE } from '../config'

const WHATSAPP_URL = 'https://wa.me/525529702270?text=Hola%2C%20tuve%20un%20problema%20con%20mi%20pago%20en%20AcidIA.'

export default function PaymentCancelled() {
  const [searchParams] = useSearchParams()
  const [reported, setReported] = useState(false)

  useEffect(() => {
    const registrationId = searchParams.get('registration_id') || ''
    const sessionId = searchParams.get('session_id') || searchParams.get('sid') || ''
    if (!registrationId && !sessionId) return

    let cancelled = false
    fetch(`${API_BASE}/v1/pre-registration/payment-issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registration_id: registrationId,
        stripe_session_id: sessionId,
        status: 'cancelled',
        reason: 'customer_returned_from_checkout',
      }),
    })
      .then(() => {
        if (!cancelled) setReported(true)
      })
      .catch(() => {
        if (!cancelled) setReported(false)
      })

    return () => {
      cancelled = true
    }
  }, [searchParams])

  return (
    <main
      className="min-h-screen px-4 py-16 flex items-center justify-center"
      style={{ background: 'var(--md-background)', color: 'var(--md-on-surface)' }}
    >
      <section
        className="w-full max-w-[560px] rounded-[28px] p-8 text-center space-y-6"
        style={{
          background: 'var(--md-surface-container)',
          boxShadow: 'var(--md-elevation-2)',
        }}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
          style={{ background: 'rgba(255, 180, 171, .2)', color: 'var(--md-error)' }}
          aria-hidden="true"
        >
          !
        </div>

        <div>
          <h1 className="text-3xl font-bold">Algo salió mal con el pago</h1>
          <p className="mt-3 text-base" style={{ color: 'var(--md-on-surface-variant)' }}>
            No se procesó el pago. Guardamos tu información para poder ayudarte y nuestro equipo fue notificado.
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--md-on-surface-variant)' }}>
            {reported
              ? 'Ya recibimos el aviso de este intento.'
              : 'Si el aviso tarda, puedes contactarnos directamente por WhatsApp.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={WHATSAPP_URL}
            className="rounded-xl px-5 py-3 font-semibold text-black"
            style={{ background: 'var(--md-primary)' }}
          >
            Contactar por WhatsApp
          </a>
          <Link
            to="/"
            className="rounded-xl border px-5 py-3 font-semibold"
            style={{ borderColor: 'var(--md-outline-variant)', color: 'var(--md-on-surface)' }}
          >
            Volver a AcidIA
          </Link>
        </div>

        <p className="text-sm" style={{ color: 'var(--md-on-surface-variant)' }}>
          También puedes escribirnos desde el web chat en la esquina inferior derecha.
        </p>
      </section>
    </main>
  )
}
