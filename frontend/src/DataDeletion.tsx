import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import logoMini from "../images/logo_mini.png";

export default function DataDeletionPage() {
  const { t } = useTranslation();
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
  const textTone = isDark ? "text-white/85" : "text-slate-700";

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
          <h1 className="text-3xl md:text-4xl font-bold text-[#ff8a00]">{t("legal.data_deletion_title")}</h1>

          <div className={`mt-10 space-y-6 leading-relaxed ${textTone}`}>
            <p>{t("legal.data_deletion_p1")}</p>
            <p>
              {t("legal.data_deletion_p2a")}{' '}
              <a className="text-[#04d9b5]" href="mailto:arco@acidia.app">
                arco@acidia.app
              </a>{' '}
              {t("legal.data_deletion_p2b")}
            </p>
            <p>{t("legal.data_deletion_p3")}</p>
            <p>
              {t("legal.contact")}:<br />
              📧{' '}
              <a className="text-[#04d9b5]" href="mailto:info@acidia.app">
                info@acidia.app
              </a>{' '}
              /{' '}
              <a className="text-[#04d9b5]" href="mailto:arco@acidia.app">
                arco@acidia.app
              </a>
              <br />
              🌐{' '}
              <a className="text-[#04d9b5]" href="https://acidia.app" target="_blank" rel="noreferrer">
                https://acidia.app
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
