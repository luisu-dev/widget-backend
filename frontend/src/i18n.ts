import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from '../locales/en.json';
import esTranslations from '../locales/es.json';

const supportedLanguages = ['es', 'en'] as const;
type SupportedLanguage = (typeof supportedLanguages)[number];

// Detectar idioma del navegador
const getBrowserLanguage = (): SupportedLanguage => {
  const browserLanguages =
    typeof navigator !== 'undefined'
      ? [navigator.language, ...(navigator.languages || [])]
      : [];

  const browserLang = browserLanguages
    .map((lang) => lang?.split('-')[0]?.toLowerCase())
    .find((lang): lang is SupportedLanguage =>
      supportedLanguages.includes(lang as SupportedLanguage)
    );

  return browserLang || 'es';
};

const initialLanguage = getBrowserLanguage();

document.documentElement.lang = initialLanguage;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      es: { translation: esTranslations },
    },
    lng: initialLanguage,
    fallbackLng: 'es',
    supportedLngs: [...supportedLanguages],
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language.split('-')[0] || 'es';
});

export default i18n;
