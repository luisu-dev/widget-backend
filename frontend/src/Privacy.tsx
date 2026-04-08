import { useEffect, useState, type ReactNode } from "react";
import logoMini from "../images/logo_mini.png";

export default function PrivacyPage() {
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true
      : true
  );

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    setIsDark(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsDark(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const pageTone = isDark ? "bg-[#060606] text-white" : "bg-[#f5f6ff] text-slate-900";
  const shellStyle: { background: string } = {
    background: isDark
      ? "radial-gradient(circle at 20% 20%, rgba(162,0,255,0.24), transparent 55%), radial-gradient(circle at 80% 0%, rgba(255,138,0,0.22), transparent 50%), #060606"
      : "radial-gradient(circle at 16% 18%, rgba(255,162,0,0.16), transparent 55%), radial-gradient(circle at 78% 6%, rgba(162,0,255,0.12), transparent 60%), #ffffff",
  };
  const cardTone = isDark
    ? "border-white/10 bg-black/40"
    : "border-black/10 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]";
  const linkTone = isDark ? "text-white/60 hover:text-white" : "text-slate-500 hover:text-slate-900";
  const bodyTone = isDark ? "text-white/85" : "text-slate-700";
  const listTone = isDark ? "text-white/80" : "text-slate-600";
  const footerTone = isDark ? "text-white/60" : "text-slate-500";
  const highlightTone = isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200";

  return (
    <div className={`min-h-screen px-6 py-16 ${pageTone}`}>
      <div className="mx-auto w-full max-w-4xl" style={shellStyle}>
        <div className={`relative overflow-hidden rounded-[2.5rem] border p-8 md:p-12 ${cardTone}`}>
          <div className="mb-8 flex items-center justify-between gap-6">
            <img src={logoMini} alt="Acid IA" className="h-16 w-auto" />
            <a href="/" className={`text-sm font-medium uppercase tracking-[0.4em] ${linkTone}`}>
              ← Volver al inicio
            </a>
          </div>

          {/* ── Planes y condiciones ───────────────────────────── */}
          <h1 className="text-3xl md:text-4xl font-bold text-[#ff8a00]">Planes y condiciones del servicio</h1>

          <Section title="¿Qué incluye tu plan?" textClass={bodyTone}>
            <List className={listTone}>
              <li>Bot de IA conversacional activo 24/7</li>
              <li>Canales disponibles: WhatsApp, Facebook Messenger, Instagram DMs y Widget web embebible</li>
              <li>Captura automática de leads y prospectos</li>
              <li>Agendado de citas con integración a Google Calendar</li>
              <li>Catálogo de productos (Shopify o manual)</li>
              <li>Links de pago y suscripciones (Stripe)</li>
              <li>Panel de administración con conversaciones en tiempo real</li>
              <li>Pausa y reanudación del bot por conversación</li>
              <li>Plataforma de métricas y reportes</li>
              <li>Hasta <strong>250,000 tokens de OpenAI</strong> incluidos por mes</li>
              <li>Soporte durante todo el proceso de instalación y configuración</li>
              <li>Soporte técnico 24/7</li>
            </List>
          </Section>

          <Section title="Tokens adicionales" textClass={bodyTone}>
            <p>
              Si tu negocio supera los 250,000 tokens mensuales incluidos, puedes adquirir bloques adicionales:
            </p>
            <div className={`mt-3 rounded-xl border px-6 py-4 ${highlightTone}`}>
              <p className="text-[#04d9b5] font-semibold text-lg">$10 USD — 500,000 tokens adicionales</p>
              <p className={`text-sm mt-1 ${listTone}`}>Se pueden adquirir tantos bloques como necesites.</p>
            </div>
          </Section>

          <Section title="No incluye" textClass={bodyTone}>
            <List className={listTone}>
              <li>
                <strong>Renta de número de WhatsApp:</strong> $6.25 USD/mes (costo de Twilio)
              </li>
              <li>
                <strong>Portabilidad de número propio:</strong> sujeta a aprobación de Meta. Se brinda soporte durante todo el proceso.
              </li>
              <li>
                <strong>Servicios externos:</strong> Shopify, Stripe y Google Workspace tienen sus propios costos según el plan que contrates directamente con cada proveedor.
              </li>
            </List>
          </Section>

          <div className={`mt-6 rounded-xl border px-6 py-3 text-sm ${highlightTone} ${listTone}`}>
            * Precios no incluyen IVA.
          </div>

          {/* ── Política de privacidad ─────────────────────────── */}
          <h1 className="mt-16 text-3xl md:text-4xl font-bold text-[#ff8a00]">Política de privacidad y tratamiento de datos</h1>

          <Section title="Responsable del tratamiento de datos" textClass={bodyTone}>
            AcidIA, proyecto operado por Luis Uribe, persona física con actividad empresarial inscrito en el régimen RESICO y RFC: UIML980407F58, con domicilio en AGUAMARINA 07 M70 L1, Facc. Aldea Tulum, Tulum, México, C.P. 77734, es responsable del uso y protección de los datos personales de los usuarios que interactúan con nuestros servicios digitales.
          </Section>

          <Section title="Datos que recopilamos" textClass={bodyTone}>
            <p>A través del bot y la plataforma, Acidia recopila:</p>
            <List className={listTone}>
              <li>Nombre y datos de contacto (teléfono, correo electrónico, usuario en redes sociales)</li>
              <li>Mensajes o interacciones realizadas a través de nuestras plataformas (sitio web, WhatsApp, Facebook Messenger, Instagram, etc.)</li>
              <li>Información técnica básica como dirección IP, navegador y dispositivo usado</li>
            </List>
          </Section>

          <Section title="Uso de los datos" textClass={bodyTone}>
            <p>Los datos recopilados se utilizan exclusivamente para:</p>
            <List className={listTone}>
              <li>Operar el asistente de IA y responder consultas de usuarios</li>
              <li>Generar métricas de uso para el negocio cliente</li>
              <li>Facilitar procesos de compra, pagos o reservas cuando corresponda</li>
              <li>Cumplir con requerimientos legales aplicables</li>
            </List>
            <p>No vendemos ni compartimos datos con terceros, salvo los servicios operativos necesarios para el funcionamiento de la plataforma.</p>
          </Section>

          <Section title="Transferencia de datos a terceros" textClass={bodyTone}>
            <p>Acidia utiliza los siguientes servicios externos para operar:</p>
            <List className={listTone}>
              <li><strong>OpenAI</strong> — procesamiento de lenguaje natural para las respuestas del bot</li>
              <li><strong>Twilio</strong> — envío y recepción de mensajes por WhatsApp</li>
              <li><strong>Meta (Facebook / Instagram)</strong> — integración con redes sociales</li>
              <li><strong>Stripe</strong> — procesamiento de pagos</li>
            </List>
            <p>En ningún caso vendemos ni comercializamos datos personales.</p>
          </Section>

          <Section title="Uso de inteligencia artificial" textClass={bodyTone}>
            Las conversaciones son procesadas por modelos de lenguaje de OpenAI para generar respuestas automáticas. Acidia no utiliza las conversaciones de sus clientes para entrenar modelos propios.
          </Section>

          <Section title="Almacenamiento y retención" textClass={bodyTone}>
            Los datos se almacenan en servidores seguros. Los mensajes e interacciones se conservan por un período de 90 días, después del cual pueden ser eliminados a solicitud del cliente o usuario final.
          </Section>

          <Section title="Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)" textClass={bodyTone}>
            <p>El usuario puede en cualquier momento:</p>
            <List className={listTone}>
              <li>Acceder a sus datos personales</li>
              <li>Rectificarlos si son inexactos</li>
              <li>Solicitar la cancelación de su uso</li>
              <li>Oponerse al tratamiento de los mismos</li>
            </List>
            <p>
              Las solicitudes se atienden en un plazo máximo de <strong>5 días hábiles</strong> al correo:{' '}
              <a className="text-[#04d9b5]" href="mailto:arco@acidia.app">arco@acidia.app</a>
            </p>
          </Section>

          <Section title="Responsabilidad del negocio cliente" textClass={bodyTone}>
            Cada negocio que utiliza Acidia es responsable de informar a sus propios clientes sobre el uso del asistente de IA y de cumplir con la legislación local aplicable (LFPDPPP en México, GDPR en la Unión Europea u otras según corresponda).
          </Section>

          <Section title="Cambios a esta política" textClass={bodyTone}>
            Acidia se reserva el derecho de actualizar esta política. Los cambios serán notificados con al menos <strong>15 días de anticipación</strong> al correo registrado y publicados en nuestro sitio web.
          </Section>

          <Section title="Contacto" textClass={bodyTone}>
            <p>
              Para dudas, solicitudes o reportes relacionados con privacidad y datos:{' '}
              <a className="text-[#04d9b5]" href="mailto:info@acidia.app">info@acidia.app</a>
              {' '}/{' '}
              <a className="text-[#04d9b5]" href="mailto:arco@acidia.app">arco@acidia.app</a>
            </p>
            <p>
              <a className="text-[#04d9b5]" href="https://acidia.app" target="_blank" rel="noreferrer">
                acidia.app
              </a>
            </p>
          </Section>

          <p className={`mt-12 text-xs ${footerTone}`}>&copy; {new Date().getFullYear()} AcidIA. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, textClass }: { title: string; children: ReactNode; textClass: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold text-[#a200ff]">{title}</h2>
      <div className={`mt-4 space-y-3 leading-relaxed ${textClass}`}>{children}</div>
    </section>
  );
}

function List({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ul className={`list-disc space-y-2 pl-6 ${className}`}>{children}</ul>;
}
