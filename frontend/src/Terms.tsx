import { useEffect, useState, type ReactNode } from "react";
import logoMini from "../images/logo_mini.png";

export default function TermsPage() {
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
          <h1 className="text-3xl md:text-4xl font-bold text-[#ff8a00]">Términos y condiciones</h1>

          <Section title="1. Aceptación de los términos" textClass={bodyTone}>
            Al acceder y utilizar los servicios digitales de AcidIA (sitio web, aplicaciones, chatbots y plataformas integradas), el usuario acepta estos Términos y Condiciones. Si no está de acuerdo, debe abstenerse de usar nuestros servicios.
          </Section>

          <Section title="2. Descripción del servicio" textClass={bodyTone}>
            AcidIA ofrece un asistente digital y soluciones automatizadas para responder consultas, mostrar información sobre productos o servicios y facilitar procesos de comunicación y comercio electrónico.
          </Section>

          <Section title="3. Uso permitido" textClass={bodyTone}>
            <p>El usuario se compromete a utilizar los servicios únicamente con fines lícitos y conforme a estos Términos. No está permitido:</p>
            <List className={listTone}>
              <li>Usar los servicios para enviar spam, mensajes fraudulentos o contenido ilegal.</li>
              <li>Intentar dañar, interrumpir o sobrecargar los sistemas que soportan el servicio.</li>
              <li>Suplantar la identidad de otra persona o entidad.</li>
            </List>
          </Section>

          <Section title="4. Información de usuarios" textClass={bodyTone}>
            Al interactuar con nuestros servicios, el usuario acepta que sus datos personales sean tratados conforme a nuestro{' '}
            <a className="text-[#04d9b5]" href="https://acidia.app/privacy" target="_blank" rel="noreferrer">
              Aviso de Privacidad
            </a>
            .
          </Section>

          <Section title="5. Propiedad intelectual" textClass={bodyTone}>
            Todo el contenido, software y tecnología que forman parte de AcidIA son propiedad de Luis Uribe / AcidIA y están protegidos por las leyes aplicables. No se otorgan licencias implícitas sobre dicho contenido.
          </Section>

          <Section title="6. Responsabilidad" textClass={bodyTone}>
            <p>
              Los servicios se proporcionan “tal cual”. AcidIA no garantiza que sean libres de errores o interrupciones, aunque implementamos medidas razonables para asegurar su funcionamiento.
            </p>
            <p>No nos hacemos responsables por:</p>
            <List className={listTone}>
              <li>El uso indebido que los usuarios hagan del servicio.</li>
              <li>Fallas ocasionadas por terceros proveedores de servicios tecnológicos (Meta, OpenAI, Twilio, Stripe, etc.).</li>
            </List>
          </Section>

          <Section title="7. Modificaciones" textClass={bodyTone}>
            Podemos modificar estos Términos en cualquier momento. Las actualizaciones se publicarán en esta misma página y serán efectivas desde su publicación.
          </Section>

          <Section title="8. Ley aplicable y jurisdicción" textClass={bodyTone}>
            Estos Términos se rigen por las leyes de México. Cualquier controversia se resolverá ante los tribunales competentes de Quintana Roo, México.
          </Section>

          <Section title="Contacto" textClass={bodyTone}>
            <p>Si tienes dudas sobre estos Términos y Condiciones, contáctanos en:</p>
            <p>
              <a className="text-[#04d9b5]" href="mailto:info@acidia.app">
                info@acidia.app
              </a>
            </p>
            <p>
              <a className="text-[#04d9b5]" href="https://acidia.app" target="_blank" rel="noreferrer">
                https://acidia.app
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
