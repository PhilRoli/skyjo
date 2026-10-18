import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import de from '../client/locales/de.json';
import en from '../client/locales/en.json';
import { describeEvents, type Translate } from './events';

const names: Record<string, string> = { A: 'Anna', B: 'Ben' };
const nameOf = (id: string) => names[id];

function translator(lng: 'de' | 'en'): Translate {
  const i18n = createInstance();
  void i18n.init({ lng, resources: { de: { translation: de }, en: { translation: en } }, interpolation: { escapeValue: false }, initAsync: false });
  return i18n.t.bind(i18n) as Translate;
}
const [tde, ten] = [translator('de'), translator('en')];

describe('describeEvents', () => {
  it('describes each kind of event in German', () => {
    expect(describeEvents([{ kind: 'draw', by: 'A' }], nameOf, tde)).toBe('Anna zieht eine Karte');
    expect(describeEvents([{ kind: 'takeDiscard', by: 'A', value: 7 }], nameOf, tde)).toBe('Anna nimmt 7 von der Ablage');
    expect(describeEvents([{ kind: 'swap', by: 'A', value: 4, replaced: 9 }], nameOf, tde)).toBe('Anna ersetzt 9 durch 4');
    expect(describeEvents([{ kind: 'discard', by: 'A', value: 4 }], nameOf, tde)).toBe('Anna legt 4 ab');
    expect(describeEvents([{ kind: 'flip', by: 'A', value: 6 }], nameOf, tde)).toBe('Anna deckt 6 auf');
    expect(describeEvents([{ kind: 'clear', by: 'A', column: 1, value: -1 }], nameOf, tde)).toBe('Anna entfernt Spalte (-1)');
  });

  it('describes each kind of event in English', () => {
    expect(describeEvents([{ kind: 'draw', by: 'A' }], nameOf, ten)).toBe('Anna draws a card');
    expect(describeEvents([{ kind: 'takeDiscard', by: 'A', value: 7 }], nameOf, ten)).toBe('Anna takes 7 from the discard pile');
    expect(describeEvents([{ kind: 'swap', by: 'A', value: 4, replaced: 9 }], nameOf, ten)).toBe('Anna replaces 9 with 4');
    expect(describeEvents([{ kind: 'discard', by: 'A', value: 4 }], nameOf, ten)).toBe('Anna discards 4');
    expect(describeEvents([{ kind: 'flip', by: 'A', value: 6 }], nameOf, ten)).toBe('Anna reveals 6');
    expect(describeEvents([{ kind: 'clear', by: 'A', column: 1, value: -1 }], nameOf, ten)).toBe('Anna removes a column (-1)');
  });

  it('names the player only once for consecutive events', () => {
    const events = [
      { kind: 'draw', by: 'A' },
      { kind: 'discard', by: 'A', value: 4 },
      { kind: 'flip', by: 'A', value: 6 },
    ] as const;
    expect(describeEvents([...events], nameOf, tde)).toBe('Anna zieht eine Karte, legt 4 ab, deckt 6 auf');
    expect(describeEvents([...events], nameOf, ten)).toBe('Anna draws a card, discards 4, reveals 6');
  });

  it('names the player again when a column removal belongs to someone else', () => {
    expect(
      describeEvents(
        [
          { kind: 'flip', by: 'B', value: 4 },
          { kind: 'clear', by: 'A', column: 0, value: 4 },
        ],
        nameOf,
        tde,
      ),
    ).toBe('Ben deckt 4 auf, Anna entfernt Spalte (4)');
  });

  it('returns an empty string without events', () => {
    expect(describeEvents([], nameOf, tde)).toBe('');
  });
});
