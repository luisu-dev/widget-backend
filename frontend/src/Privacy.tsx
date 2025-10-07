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
          <h1 className="text-3xl md:text-4xl font-bold text-[#ff8a00]">Aviso de privacidad</h1>

          <Section title="Responsable del tratamiento de datos" textClass={bodyTone}>
            AcidIA, proyecto operado por Luis Uribe, persona física con actividad empresarial inscrito en el régimen RESICO y RFC: UIML980407F58, con domicilio en AGUAMARINA 07 M70 L1, Facc. Aldea Tulum, Tulum, México, C.P. 77734, es responsable del uso y protección de los datos personales de los usuarios que interactúan con nuestros servicios digitales.
          </Section>

          <Section title="Datos que recolectamos" textClass={bodyTone}>
            <p>Podemos recolectar información como:</p>
            <List className={listTone}>
              <li>Nombre y datos de contacto (teléfono, correo electrónico, usuario en redes sociales).</li>
              <li>Mensajes o interacciones realizadas a través de nuestras plataformas (sitio web, WhatsApp, Facebook Messenger, Instagram, etc.).</li>
              <li>Información técnica básica como dirección IP, navegador y dispositivo usado.</li>
            </List>
          </Section>

          <Section title="Finalidades del uso de los datos" textClass={bodyTone}>
            <p>Los datos personales serán utilizados para:</p>
            <List className={listTone}>
              <li>Responder a consultas o mensajes enviados por el usuario.</li>
              <li>Proporcionar información sobre productos o servicios solicitados.</li>
              <li>Facilitar procesos de compra, pagos o reservas cuando corresponda.</li>
              <li>Mejorar la calidad de nuestros servicios digitales y automatizados.</li>
              <li>Cumplir con requerimientos legales aplicables.</li>
            </List>
          </Section>

          <Section title="Transferencia de datos" textClass={bodyTone}>
            <p>Podemos compartir datos con terceros únicamente para:</p>
            <List className={listTone}>
              <li>Proveedores de servicios tecnológicos (por ejemplo: Meta Platforms, OpenAI, Twilio, Stripe).</li>
              <li>Autoridades competentes en caso de obligación legal.</li>
            </List>
            <p>En ningún caso vendemos ni comercializamos datos personales.</p>
          </Section>

          <Section title="Seguridad" textClass={bodyTone}>
            Implementamos medidas técnicas, administrativas y físicas para proteger los datos contra acceso no autorizado, alteración, pérdida o destrucción.
          </Section>

          <Section title="Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)" textClass={bodyTone}>
            <p>El usuario puede en cualquier momento:</p>
            <List className={listTone}>
              <li>Acceder a sus datos personales.</li>
              <li>Rectificarlos si son inexactos.</li>
              <li>Solicitar la cancelación de su uso.</li>
              <li>Oponerse al tratamiento de los mismos.</li>
            </List>
            <p>
              Las solicitudes se pueden realizar al correo:{' '}
              <a className="text-[#04d9b5]" href="mailto:arco@acidia.app">
                arco@acidia.app
              </a>
            </p>
          </Section>

          <Section title="Cambios en el aviso" textClass={bodyTone}>
            Este aviso puede actualizarse. Publicaremos cualquier cambio en nuestro sitio web y en nuestras plataformas oficiales.
          </Section>

          <Section title="Contacto" textClass={bodyTone}>
            <p>
              Si tienes dudas o deseas ejercer tus derechos, contáctanos en:{' '}
              <a className="text-[#04d9b5]" href="mailto:info@acidia.app">
                info@acidia.app
              </a>{' '}
              /{' '}
              <a className="text-[#04d9b5]" href="mailto:arco@acidia.app">
                arco@acidia.app
              </a>
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
