import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import logoMini from "../images/logo_mini.png";

export default function PrivacyPage() {
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith("en");
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
  const copy = en
    ? {
        plansTitle: "Service Plans and Conditions",
        includesTitle: "What does your plan include?",
        includes: ["24/7 conversational AI bot", "Available channels: WhatsApp, Facebook Messenger, Instagram DMs, and embeddable web widget", "Automatic lead and prospect capture", "Appointment scheduling with Google Calendar integration", "Product catalog (Shopify or manual)", "Payment links and subscriptions (Stripe)", "Admin panel with real-time conversations", "Bot pause and resume per conversation", "Metrics and reporting platform", "Up to 250,000 OpenAI tokens included per month", "Support throughout installation and configuration", "24/7 technical support"],
        tokensTitle: "Additional Tokens",
        tokensText: "If your business exceeds the 250,000 monthly tokens included, you can purchase additional blocks:",
        tokenBlock: "$10 USD — 500,000 additional tokens",
        tokenBlockNote: "You can purchase as many blocks as you need.",
        notIncludedTitle: "Not included",
        notIncluded: ["WhatsApp number rental: $6.25 USD/month (Twilio cost)", "Own-number portability: subject to Meta approval. Support is provided throughout the process.", "External services: Shopify, Stripe, and Google Workspace have their own costs based on the plan you contract directly with each provider."],
        taxNote: "* Prices do not include VAT.",
        privacyTitle: "Privacy Policy and Data Processing",
        responsibleTitle: "Data Controller",
        responsible: "AcidIA, a project operated by Luis Uribe, an individual with business activity registered under the RESICO regime and RFC: UIML980407F58, with address at AGUAMARINA 07 M70 L1, Facc. Aldea Tulum, Tulum, Mexico, C.P. 77734, is responsible for the use and protection of the personal data of users who interact with our digital services.",
        collectedTitle: "Data We Collect",
        collectedIntro: "Through the bot and platform, AcidIA collects:",
        collected: ["Name and contact details (phone, email, social media username)", "Messages or interactions made through our platforms (website, WhatsApp, Facebook Messenger, Instagram, etc.)", "Basic technical information such as IP address, browser, and device used"],
        useTitle: "Use of Data",
        useIntro: "The collected data is used exclusively to:",
        useItems: ["Operate the AI assistant and answer user inquiries", "Generate usage metrics for the client business", "Facilitate purchase, payment, or booking processes when applicable", "Comply with applicable legal requirements"],
        noSale: "We do not sell or share data with third parties, except for the operational services necessary for the platform to function.",
        transfersTitle: "Data Transfers to Third Parties",
        transfersIntro: "AcidIA uses the following external services to operate:",
        transfers: ["OpenAI — natural language processing for bot responses", "Twilio — sending and receiving WhatsApp messages", "Meta (Facebook / Instagram) — social media integration", "Stripe — payment processing"],
        noCommercialization: "Under no circumstances do we sell or commercialize personal data.",
        aiTitle: "Use of Artificial Intelligence",
        ai: "Conversations are processed by OpenAI language models to generate automatic responses. AcidIA does not use its clients' conversations to train its own models.",
        retentionTitle: "Storage and Retention",
        retention: "Data is stored on secure servers. Messages and interactions are retained for a period of 90 days, after which they may be deleted at the request of the client or end user.",
        arcoTitle: "ARCO Rights (Access, Rectification, Cancellation, and Objection)",
        arcoIntro: "The user may at any time:",
        arco: ["Access their personal data", "Rectify it if inaccurate", "Request cancellation of its use", "Object to its processing"],
        arcoRequest: "Requests are handled within a maximum of",
        businessTitle: "Client Business Responsibility",
        business: "Each business that uses AcidIA is responsible for informing its own customers about the use of the AI assistant and complying with applicable local legislation (LFPDPPP in Mexico, GDPR in the European Union, or others as applicable).",
        changesTitle: "Changes to This Policy",
        changes: "AcidIA reserves the right to update this policy. Changes will be notified at least 15 days in advance to the registered email and published on our website.",
        contactTitle: "Contact",
        contact: "For questions, requests, or reports related to privacy and data:"
      }
    : {
        plansTitle: "Planes y condiciones del servicio",
        includesTitle: "¿Qué incluye tu plan?",
        includes: ["Bot de IA conversacional activo 24/7", "Canales disponibles: WhatsApp, Facebook Messenger, Instagram DMs y Widget web embebible", "Captura automática de leads y prospectos", "Agendado de citas con integración a Google Calendar", "Catálogo de productos (Shopify o manual)", "Links de pago y suscripciones (Stripe)", "Panel de administración con conversaciones en tiempo real", "Pausa y reanudación del bot por conversación", "Plataforma de métricas y reportes", "Hasta 250,000 tokens de OpenAI incluidos por mes", "Soporte durante todo el proceso de instalación y configuración", "Soporte técnico 24/7"],
        tokensTitle: "Tokens adicionales",
        tokensText: "Si tu negocio supera los 250,000 tokens mensuales incluidos, puedes adquirir bloques adicionales:",
        tokenBlock: "$10 USD — 500,000 tokens adicionales",
        tokenBlockNote: "Se pueden adquirir tantos bloques como necesites.",
        notIncludedTitle: "No incluye",
        notIncluded: ["Renta de número de WhatsApp: $6.25 USD/mes (costo de Twilio)", "Portabilidad de número propio: sujeta a aprobación de Meta. Se brinda soporte durante todo el proceso.", "Servicios externos: Shopify, Stripe y Google Workspace tienen sus propios costos según el plan que contrates directamente con cada proveedor."],
        taxNote: "* Precios no incluyen IVA.",
        privacyTitle: "Política de privacidad y tratamiento de datos",
        responsibleTitle: "Responsable del tratamiento de datos",
        responsible: "AcidIA, proyecto operado por Luis Uribe, persona física con actividad empresarial inscrito en el régimen RESICO y RFC: UIML980407F58, con domicilio en AGUAMARINA 07 M70 L1, Facc. Aldea Tulum, Tulum, México, C.P. 77734, es responsable del uso y protección de los datos personales de los usuarios que interactúan con nuestros servicios digitales.",
        collectedTitle: "Datos que recopilamos",
        collectedIntro: "A través del bot y la plataforma, AcidIA recopila:",
        collected: ["Nombre y datos de contacto (teléfono, correo electrónico, usuario en redes sociales)", "Mensajes o interacciones realizadas a través de nuestras plataformas (sitio web, WhatsApp, Facebook Messenger, Instagram, etc.)", "Información técnica básica como dirección IP, navegador y dispositivo usado"],
        useTitle: "Uso de los datos",
        useIntro: "Los datos recopilados se utilizan exclusivamente para:",
        useItems: ["Operar el asistente de IA y responder consultas de usuarios", "Generar métricas de uso para el negocio cliente", "Facilitar procesos de compra, pagos o reservas cuando corresponda", "Cumplir con requerimientos legales aplicables"],
        noSale: "No vendemos ni compartimos datos con terceros, salvo los servicios operativos necesarios para el funcionamiento de la plataforma.",
        transfersTitle: "Transferencia de datos a terceros",
        transfersIntro: "AcidIA utiliza los siguientes servicios externos para operar:",
        transfers: ["OpenAI — procesamiento de lenguaje natural para las respuestas del bot", "Twilio — envío y recepción de mensajes por WhatsApp", "Meta (Facebook / Instagram) — integración con redes sociales", "Stripe — procesamiento de pagos"],
        noCommercialization: "En ningún caso vendemos ni comercializamos datos personales.",
        aiTitle: "Uso de inteligencia artificial",
        ai: "Las conversaciones son procesadas por modelos de lenguaje de OpenAI para generar respuestas automáticas. AcidIA no utiliza las conversaciones de sus clientes para entrenar modelos propios.",
        retentionTitle: "Almacenamiento y retención",
        retention: "Los datos se almacenan en servidores seguros. Los mensajes e interacciones se conservan por un período de 90 días, después del cual pueden ser eliminados a solicitud del cliente o usuario final.",
        arcoTitle: "Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)",
        arcoIntro: "El usuario puede en cualquier momento:",
        arco: ["Acceder a sus datos personales", "Rectificarlos si son inexactos", "Solicitar la cancelación de su uso", "Oponerse al tratamiento de los mismos"],
        arcoRequest: "Las solicitudes se atienden en un plazo máximo de",
        businessTitle: "Responsabilidad del negocio cliente",
        business: "Cada negocio que utiliza AcidIA es responsable de informar a sus propios clientes sobre el uso del asistente de IA y de cumplir con la legislación local aplicable (LFPDPPP en México, GDPR en la Unión Europea u otras según corresponda).",
        changesTitle: "Cambios a esta política",
        changes: "AcidIA se reserva el derecho de actualizar esta política. Los cambios serán notificados con al menos 15 días de anticipación al correo registrado y publicados en nuestro sitio web.",
        contactTitle: "Contacto",
        contact: "Para dudas, solicitudes o reportes relacionados con privacidad y datos:"
      };

  return (
    <div className={`min-h-screen px-6 py-16 ${pageTone}`}>
      <div className="mx-auto w-full max-w-4xl" style={shellStyle}>
        <div className={`relative overflow-hidden rounded-[2.5rem] border p-8 md:p-12 ${cardTone}`}>
          <div className="mb-8 flex items-center justify-between gap-6">
            <img src={logoMini} alt="AcidIA" className="h-16 w-auto" />
            <a href="/" className={`text-sm font-medium uppercase tracking-[0.4em] ${linkTone}`}>
              ← {t("legal.back_home")}
            </a>
          </div>

          {/* ── Planes y condiciones ───────────────────────────── */}
          <h1 className="text-3xl md:text-4xl font-bold text-[#ff8a00]">{copy.plansTitle}</h1>

          <Section title={copy.includesTitle} textClass={bodyTone}>
            <List className={listTone}>
              {copy.includes.map((item) => <li key={item}>{item}</li>)}
            </List>
          </Section>

          <Section title={copy.tokensTitle} textClass={bodyTone}>
            <p>{copy.tokensText}</p>
            <div className={`mt-3 rounded-xl border px-6 py-4 ${highlightTone}`}>
              <p className="text-[#04d9b5] font-semibold text-lg">{copy.tokenBlock}</p>
              <p className={`text-sm mt-1 ${listTone}`}>{copy.tokenBlockNote}</p>
            </div>
          </Section>

          <Section title={copy.notIncludedTitle} textClass={bodyTone}>
            <List className={listTone}>
              {copy.notIncluded.map((item) => <li key={item}>{item}</li>)}
            </List>
          </Section>

          <div className={`mt-6 rounded-xl border px-6 py-3 text-sm ${highlightTone} ${listTone}`}>
            {copy.taxNote}
          </div>

          {/* ── Política de privacidad ─────────────────────────── */}
          <h1 className="mt-16 text-3xl md:text-4xl font-bold text-[#ff8a00]">{copy.privacyTitle}</h1>

          <Section title={copy.responsibleTitle} textClass={bodyTone}>{copy.responsible}</Section>

          <Section title={copy.collectedTitle} textClass={bodyTone}>
            <p>{copy.collectedIntro}</p>
            <List className={listTone}>
              {copy.collected.map((item) => <li key={item}>{item}</li>)}
            </List>
          </Section>

          <Section title={copy.useTitle} textClass={bodyTone}>
            <p>{copy.useIntro}</p>
            <List className={listTone}>
              {copy.useItems.map((item) => <li key={item}>{item}</li>)}
            </List>
            <p>{copy.noSale}</p>
          </Section>

          <Section title={copy.transfersTitle} textClass={bodyTone}>
            <p>{copy.transfersIntro}</p>
            <List className={listTone}>
              {copy.transfers.map((item) => <li key={item}>{item}</li>)}
            </List>
            <p>{copy.noCommercialization}</p>
          </Section>

          <Section title={copy.aiTitle} textClass={bodyTone}>{copy.ai}</Section>

          <Section title={copy.retentionTitle} textClass={bodyTone}>{copy.retention}</Section>

          <Section title={copy.arcoTitle} textClass={bodyTone}>
            <p>{copy.arcoIntro}</p>
            <List className={listTone}>
              {copy.arco.map((item) => <li key={item}>{item}</li>)}
            </List>
            <p>
              {copy.arcoRequest} <strong>{en ? "5 business days" : "5 días hábiles"}</strong> {en ? "by email:" : "al correo:"}{' '}
              <a className="text-[#04d9b5]" href="mailto:arco@acidia.app">arco@acidia.app</a>
            </p>
          </Section>

          <Section title={copy.businessTitle} textClass={bodyTone}>{copy.business}</Section>

          <Section title={copy.changesTitle} textClass={bodyTone}>{copy.changes}</Section>

          <Section title={copy.contactTitle} textClass={bodyTone}>
            <p>
              {copy.contact}{' '}
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

          <p className={`mt-12 text-xs ${footerTone}`}>&copy; {new Date().getFullYear()} AcidIA. {t("legal.rights")}</p>
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
