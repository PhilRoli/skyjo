import type { TFunction } from 'i18next';
import { ERROR_CODES } from '../shared/errors';

export type Lang = 'de' | 'en';
export const LANG_KEY = 'skyjo-lang';

const isLang = (v: string | null): v is Lang => v === 'de' || v === 'en';

/** A stored choice wins; otherwise German browsers get German and everything else English. */
export function detectLanguage(stored: string | null, navigatorLanguages: readonly string[]): Lang {
  if (isLang(stored)) return stored;
  return navigatorLanguages[0]?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function translateError(t: TFunction, code: string): string {
  return t(`error.${(ERROR_CODES as readonly string[]).includes(code) ? code : 'UNKNOWN'}`);
}
