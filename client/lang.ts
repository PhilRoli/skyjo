import type { TFunction } from 'i18next';
import { ERROR_CODES, type ErrorCode } from '../shared/errors';

export type Lang = 'de' | 'en';
export const LANG_KEY = 'skyjo-lang';

const isLang = (v: string | null): v is Lang => v === 'de' || v === 'en';

/** A stored choice wins; otherwise German browsers get German and everything else English. */
export function detectLanguage(stored: string | null, navigatorLanguages: readonly string[]): Lang {
  if (isLang(stored)) return stored;
  return navigatorLanguages[0]?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function translateError(t: TFunction, code: string): string {
  const known: ErrorCode = (ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : 'UNKNOWN';
  return t(`error.${known}`);
}

/** Storage access can throw (blocked cookies, private mode); the language choice is then just not remembered. */
export function loadStoredLang(storage: Pick<Storage, 'getItem'>): string | null {
  try {
    return storage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

export function saveStoredLang(storage: Pick<Storage, 'setItem'>, lang: Lang): void {
  try {
    storage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable: the choice just won't survive a reload */
  }
}
