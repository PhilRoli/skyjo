import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import { detectLanguage, loadStoredLang, saveStoredLang, type Lang } from './lang';

// Wrapped so that even touching the `localStorage` global (which can throw) stays inside the try/catch.
const storage = { getItem: (k: string) => localStorage.getItem(k), setItem: (k: string, v: string) => localStorage.setItem(k, v) };

export function setLanguage(lang: Lang): void {
  saveStoredLang(storage, lang);
  void i18n.changeLanguage(lang);
}

const initial = detectLanguage(loadStoredLang(storage), navigator.languages?.length ? navigator.languages : [navigator.language ?? '']);

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'en',
  supportedLngs: ['de', 'en'],
  interpolation: { escapeValue: false },
});

document.documentElement.lang = initial;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
