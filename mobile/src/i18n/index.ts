import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'fr';

export const resources = { fr: { translation: fr }, en: { translation: en } } as const;

/** Device language if supported, French otherwise. */
export function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? DEFAULT_LANGUAGE;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
    ? (code as Language)
    : DEFAULT_LANGUAGE;
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
