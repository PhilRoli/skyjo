import { describe, expect, it } from 'vitest';
import { describeEvents } from './events';

const names: Record<string, string> = { A: 'Anna', B: 'Ben' };
const nameOf = (id: string) => names[id];

describe('describeEvents', () => {
  it('describes each kind of event', () => {
    expect(describeEvents([{ kind: 'draw', by: 'A' }], nameOf)).toBe('Anna zieht eine Karte');
    expect(describeEvents([{ kind: 'takeDiscard', by: 'A', value: 7 }], nameOf)).toBe('Anna nimmt 7 von der Ablage');
    expect(describeEvents([{ kind: 'swap', by: 'A', value: 4, replaced: 9 }], nameOf)).toBe('Anna ersetzt 9 durch 4');
    expect(describeEvents([{ kind: 'discard', by: 'A', value: 4 }], nameOf)).toBe('Anna legt 4 ab');
    expect(describeEvents([{ kind: 'flip', by: 'A', value: 6 }], nameOf)).toBe('Anna deckt 6 auf');
    expect(describeEvents([{ kind: 'clear', by: 'A', column: 1, value: -1 }], nameOf)).toBe('Anna entfernt Spalte (-1)');
  });

  it('names the player only once for consecutive events', () => {
    expect(
      describeEvents(
        [
          { kind: 'draw', by: 'A' },
          { kind: 'discard', by: 'A', value: 4 },
          { kind: 'flip', by: 'A', value: 6 },
        ],
        nameOf,
      ),
    ).toBe('Anna zieht eine Karte, legt 4 ab, deckt 6 auf');
  });

  it('names the player again when a column removal belongs to someone else', () => {
    expect(
      describeEvents(
        [
          { kind: 'flip', by: 'B', value: 4 },
          { kind: 'clear', by: 'A', column: 0, value: 4 },
        ],
        nameOf,
      ),
    ).toBe('Ben deckt 4 auf, Anna entfernt Spalte (4)');
  });

  it('returns an empty string without events', () => {
    expect(describeEvents([], nameOf)).toBe('');
  });
});
