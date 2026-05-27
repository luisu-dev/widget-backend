import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import logoMini from "../images/logo_mini.png";

export default function TermsPage() {
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
  const copy = en
    ? {
        title: "Terms and Conditions",
        acceptTitle: "1. Acceptance of Terms",
        accept: "By accessing and using AcidIA digital services (website, applications, chatbots, and integrated platforms), the user accepts these Terms and Conditions. If they do not agree, they must refrain from using our services.",
        serviceTitle: "2. Service Description",
        service: "AcidIA offers a digital assistant and automated solutions to answer questions, show information about products or services, and facilitate communication and e-commerce processes.",
        allowedTitle: "3. Permitted Use",
        allowed: "The user agrees to use the services only for lawful purposes and in accordance with these Terms. It is not permitted to:",
        allowedItems: ["Use the services to send spam, fraudulent messages, or illegal content.", "Attempt to damage, interrupt, or overload the systems that support the service.", "Impersonate another person or entity."],
        usersTitle: "4. User Information",
        users: "By interacting with our services, the user accepts that their personal data will be processed according to our",
        privacy: "Privacy Notice",
        ipTitle: "5. Intellectual Property",
        ip: "All content, software, and technology that are part of AcidIA are owned by Luis Uribe / AcidIA and protected by applicable laws. No implied licenses are granted over that content.",
        liabilityTitle: "6. Liability",
        liability1: "The services are provided “as is”. AcidIA does not guarantee that they will be error-free or uninterrupted, although we implement reasonable measures to ensure operation.",
        liability2: "We are not responsible for:",
        liabilityItems: ["Misuse of the service by users.", "Failures caused by third-party technology providers (Meta, OpenAI, Twilio, Stripe, etc.)."],
        changesTitle: "7. Changes",
        changes: "We may modify these Terms at any time. Updates will be published on this page and become effective upon publication.",
        lawTitle: "8. Governing Law and Jurisdiction",
        law: "These Terms are governed by the laws of Mexico. Any dispute will be resolved before the competent courts of Quintana Roo, Mexico.",
        contactTitle: "Contact",
        contact: "If you have questions about these Terms and Conditions, contact us at:"
      }
    : {
        title: "Términos y condiciones",
        acceptTitle: "1. Aceptación de los términos",
        accept: "Al acceder y utilizar los servicios digitales de AcidIA (sitio web, aplicaciones, chatbots y plataformas integradas), el usuario acepta estos Términos y Condiciones. Si no está de acuerdo, debe abstenerse de usar nuestros servicios.",
        serviceTitle: "2. Descripción del servicio",
        service: "AcidIA ofrece un asistente digital y soluciones automatizadas para responder consultas, mostrar información sobre productos o servicios y facilitar procesos de comunicación y comercio electrónico.",
        allowedTitle: "3. Uso permitido",
        allowed: "El usuario se compromete a utilizar los servicios únicamente con fines lícitos y conforme a estos Términos. No está permitido:",
        allowedItems: ["Usar los servicios para enviar spam, mensajes fraudulentos o contenido ilegal.", "Intentar dañar, interrumpir o sobrecargar los sistemas que soportan el servicio.", "Suplantar la identidad de otra persona o entidad."],
        usersTitle: "4. Información de usuarios",
        users: "Al interactuar con nuestros servicios, el usuario acepta que sus datos personales sean tratados conforme a nuestro",
        privacy: "Aviso de Privacidad",
        ipTitle: "5. Propiedad intelectual",
        ip: "Todo el contenido, software y tecnología que forman parte de AcidIA son propiedad de Luis Uribe / AcidIA y están protegidos por las leyes aplicables. No se otorgan licencias implícitas sobre dicho contenido.",
        liabilityTitle: "6. Responsabilidad",
        liability1: "Los servicios se proporcionan “tal cual”. AcidIA no garantiza que sean libres de errores o interrupciones, aunque implementamos medidas razonables para asegurar su funcionamiento.",
        liability2: "No nos hacemos responsables por:",
        liabilityItems: ["El uso indebido que los usuarios hagan del servicio.", "Fallas ocasionadas por terceros proveedores de servicios tecnológicos (Meta, OpenAI, Twilio, Stripe, etc.)."],
        changesTitle: "7. Modificaciones",
        changes: "Podemos modificar estos Términos en cualquier momento. Las actualizaciones se publicarán en esta misma página y serán efectivas desde su publicación.",
        lawTitle: "8. Ley aplicable y jurisdicción",
        law: "Estos Términos se rigen por las leyes de México. Cualquier controversia se resolverá ante los tribunales competentes de Quintana Roo, México.",
        contactTitle: "Contacto",
        contact: "Si tienes dudas sobre estos Términos y Condiciones, contáctanos en:"
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
          <h1 className="text-3xl md:text-4xl font-bold text-[#ff8a00]">{copy.title}</h1>

          <Section title={copy.acceptTitle} textClass={bodyTone}>{copy.accept}</Section>

          <Section title={copy.serviceTitle} textClass={bodyTone}>{copy.service}</Section>

          <Section title={copy.allowedTitle} textClass={bodyTone}>
            <p>{copy.allowed}</p>
            <List className={listTone}>
              {copy.allowedItems.map((item) => <li key={item}>{item}</li>)}
            </List>
          </Section>

          <Section title={copy.usersTitle} textClass={bodyTone}>
            {copy.users}{' '}
            <a className="text-[#04d9b5]" href="https://acidia.app/privacy" target="_blank" rel="noreferrer">
              {copy.privacy}
            </a>
            .
          </Section>

          <Section title={copy.ipTitle} textClass={bodyTone}>{copy.ip}</Section>

          <Section title={copy.liabilityTitle} textClass={bodyTone}>
            <p>{copy.liability1}</p>
            <p>{copy.liability2}</p>
            <List className={listTone}>
              {copy.liabilityItems.map((item) => <li key={item}>{item}</li>)}
            </List>
          </Section>

          <Section title={copy.changesTitle} textClass={bodyTone}>{copy.changes}</Section>

          <Section title={copy.lawTitle} textClass={bodyTone}>{copy.law}</Section>

          <Section title={copy.contactTitle} textClass={bodyTone}>
            <p>{copy.contact}</p>
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
