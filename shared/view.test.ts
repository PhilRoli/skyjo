import { describe, expect, it } from 'vitest';
import { viewFor } from './view';
import { ALL_HIDDEN, FILL, cells, mkState } from './testUtils';

describe('viewFor', () => {
  const base = () =>
    mkState([cells(FILL, [0, 1]), cells(FILL, ALL_HIDDEN)], {
      phase: 'place',
      drawn: 6,
      drawnFrom: 'deck',
      current: 0,
    });

  it('never exposes hidden card values', () => {
    const v = viewFor(base(), 'B');
    for (const p of v.players) {
      for (const c of p.grid) {
        if (c && !c.up) expect(c.value).toBeNull();
      }
    }
    expect(JSON.stringify(v)).not.toContain('"deck"');
  });

  it('shows the drawn card only to the player whose turn it is', () => {
    expect(viewFor(base(), 'A').drawn).toBe(6);
    expect(viewFor(base(), 'A').drawnFrom).toBe('deck');
    expect(viewFor(base(), 'B').drawn).toBeNull();
    expect(viewFor(base(), 'B').current).toBe('A');
  });

  it('exposes pile info and no current player after the round', () => {
    const v = viewFor({ ...base(), phase: 'roundOver' }, 'A');
    expect(v.discardTop).toBe(9);
    expect(v.deckCount).toBe(4);
    expect(v.current).toBeNull();
    expect(v.winners).toEqual([]);
  });
});
