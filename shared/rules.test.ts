import { describe, expect, it } from 'vitest';
import { apply, newGame } from './rules';
import { ALL_HIDDEN, FILL, cells, mkState, seeded } from './testUtils';

const rng = seeded(1);
const two = [
  { id: 'A', name: 'A' },
  { id: 'B', name: 'B' },
];
const flip = (s: ReturnType<typeof newGame>, id: string, slot: number) =>
  apply(s, id, { type: 'flipInitial', slot }, rng);

describe('newGame', () => {
  it('deals 12 hidden cards each and one discard card', () => {
    const s = newGame(two, seeded(1));
    expect(s.players.every((p) => p.grid.length === 12 && p.grid.every((c) => c && !c.up))).toBe(true);
    expect(s.discard).toHaveLength(1);
    expect(s.deck).toHaveLength(150 - 24 - 1);
    expect(s.phase).toBe('initialFlip');
    expect(s.round).toBe(1);
  });

  it('requires 2 to 8 players', () => {
    expect(() => newGame([two[0]], rng)).toThrow('2 bis 8');
    const nine = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `p${i}` }));
    expect(() => newGame(nine, rng)).toThrow('2 bis 8');
  });
});

describe('initial flip', () => {
  it('lets each player flip exactly 2 cards', () => {
    let s = newGame(two, seeded(1));
    s = flip(s, 'A', 0);
    s = flip(s, 'A', 1);
    expect(() => flip(s, 'A', 2)).toThrow('schon 2 Karten');
    expect(() => flip(s, 'A', 0)).toThrow('bereits aufgedeckt');
    expect(() => apply(s, 'Z', { type: 'flipInitial', slot: 0 }, rng)).toThrow('Unbekannter Spieler');
    expect(() => flip(s, 'B', 12)).toThrow('Ungültiger Platz');
  });

  it('starts with the highest sum of the two flipped cards', () => {
    let s = mkState(
      [cells([12, -2, ...FILL.slice(2)], ALL_HIDDEN), cells([4, 2, ...FILL.slice(2)], ALL_HIDDEN)],
      { phase: 'initialFlip' },
    );
    for (const id of ['A', 'B']) {
      s = flip(s, id, 0);
      s = flip(s, id, 1);
    }
    expect(s.phase).toBe('draw');
    expect(s.current).toBe(0);
  });

  it('breaks a tie in favour of whoever finished flipping first', () => {
    let s = mkState(
      [cells([3, 3, ...FILL.slice(2)], ALL_HIDDEN), cells([4, 2, ...FILL.slice(2)], ALL_HIDDEN)],
      { phase: 'initialFlip' },
    );
    s = flip(s, 'B', 0);
    s = flip(s, 'B', 1);
    s = flip(s, 'A', 0);
    s = flip(s, 'A', 1);
    expect(s.current).toBe(1);
  });

  it('rejects turn actions during the initial flip', () => {
    const s = newGame(two, seeded(1));
    expect(() => apply(s, 'A', { type: 'drawFromDeck' }, rng)).toThrow();
  });
});
