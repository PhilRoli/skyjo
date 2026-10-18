import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../shared/errors';
import { detectLanguage, loadStoredLang, saveStoredLang, translateError } from './lang';
import de from './locales/de.json';
import en from './locales/en.json';

const flatten = (o: object, prefix = ''): Record<string, unknown> =>
  Object.entries(o).reduce<Record<string, unknown>>((acc, [k, v]) => {
    const key = prefix + k;
    return v !== null && typeof v === 'object' ? { ...acc, ...flatten(v, key + '.') } : { ...acc, [key]: v };
  }, {});

describe('detectLanguage', () => {
  it.each([
    [null, ['de-AT'], 'de'],
    [null, ['DE'], 'de'],
    [null, ['de-CH'], 'de'],
    [null, ['fr'], 'en'],
    [null, ['en-US'], 'en'],
    [null, [], 'en'],
    ['en', ['de'], 'en'],
    ['de', ['en-US'], 'de'],
    ['fr', ['de'], 'de'],
    ['', ['fr', 'de'], 'en'],
  ] as const)('stored %j + navigator %j -> %s', (stored, nav, expected) => {
    expect(detectLanguage(stored, nav)).toBe(expected);
  });
});

describe('locales', () => {
  const [fd, fe] = [flatten(de), flatten(en)];
  it('have identical key sets and no empty strings', () => {
    expect(Object.keys(fe).sort()).toEqual(Object.keys(fd).sort());
    for (const [k, v] of [...Object.entries(fd), ...Object.entries(fe)]) {
      expect(typeof v === 'string' && v.length > 0, k).toBe(true);
    }
  });

  it('have a text for every server error code', () => {
    for (const code of ERROR_CODES) {
      expect(fd['error.' + code], code).toBeTruthy();
      expect(fe['error.' + code], code).toBeTruthy();
    }
  });
});

describe('nudge tab title', () => {
  it('has a localized text with the sender name in both languages', () => {
    expect(flatten(de)['common.nudgeTitle']).toContain('{{name}}');
    expect(flatten(en)['common.nudgeTitle']).toContain('{{name}}');
  });
});

describe('translateError', () => {
  const t = ((key: string) => (key in flatten(en) ? (flatten(en)[key] as string) : key)) as never;
  it('translates known codes', () => {
    expect(translateError(t, 'ROOM_FULL')).toBe(flatten(en)['error.ROOM_FULL']);
  });
  it('falls back to the UNKNOWN text for unknown codes and legacy German strings', () => {
    expect(translateError(t, 'SOMETHING_NEW')).toBe(flatten(en)['error.UNKNOWN']);
    expect(translateError(t, 'Raum ist voll')).toBe(flatten(en)['error.UNKNOWN']);
  });
});

describe('stored language', () => {
  const throwing = () => {
    throw new Error('storage blocked');
  };
  it('reads null when storage throws', () => {
    expect(loadStoredLang({ getItem: throwing })).toBeNull();
  });
  it('ignores a failing write', () => {
    expect(() => saveStoredLang({ setItem: throwing }, 'en')).not.toThrow();
  });
  it('round-trips through working storage', () => {
    const data: Record<string, string> = {};
    saveStoredLang({ setItem: (k, v) => void (data[k] = v) }, 'en');
    expect(loadStoredLang({ getItem: (k) => data[k] ?? null })).toBe('en');
  });
});
