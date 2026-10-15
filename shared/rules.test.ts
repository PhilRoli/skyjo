import { describe, expect, it } from 'vitest';
import { apply, newGame, startRound } from './rules';
import type { Cell } from './types';
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

const act = (s: ReturnType<typeof newGame>, id: string, a: Parameters<typeof apply>[2]) =>
  apply(s, id, a, rng);

describe('turn actions', () => {
  const fresh = () => mkState([cells(FILL), cells(FILL)]);

  it('draws from the deck and enforces turn order', () => {
    const s = act(fresh(), 'A', { type: 'drawFromDeck' });
    expect(s.drawn).toBe(4);
    expect(s.drawnFrom).toBe('deck');
    expect(s.phase).toBe('place');
    expect(s.deck).toHaveLength(3);
    expect(() => act(fresh(), 'B', { type: 'drawFromDeck' })).toThrow('nicht dran');
    expect(() => act(s, 'A', { type: 'drawFromDeck' })).toThrow('Jetzt nicht möglich');
  });

  it('a card taken from the discard pile must be swapped', () => {
    const s = act(fresh(), 'A', { type: 'takeDiscard' });
    expect(s.drawn).toBe(9);
    expect(s.discard).toEqual([]);
    expect(() => act(s, 'A', { type: 'discardDrawn' })).toThrow('tauschen');
  });

  it('swap puts the old card on the discard pile and passes the turn', () => {
    let s = act(fresh(), 'A', { type: 'drawFromDeck' });
    s = act(s, 'A', { type: 'swap', slot: 0 });
    expect(s.players[0].grid[0]).toEqual({ value: 4, up: true });
    expect(s.discard).toEqual([9, 1]);
    expect(s.current).toBe(1);
    expect(s.phase).toBe('draw');
    expect(s.drawn).toBeNull();
  });

  it('can swap with a hidden card without looking at it', () => {
    let s = mkState([cells(FILL, ALL_HIDDEN), cells(FILL)]);
    s = act(s, 'A', { type: 'drawFromDeck' });
    s = act(s, 'A', { type: 'swap', slot: 7 });
    expect(s.players[0].grid[7]).toEqual({ value: 4, up: true });
    expect(s.discard.at(-1)).toBe(FILL[7]);
  });

  it('discarding a deck card requires flipping a hidden card', () => {
    let s = mkState([cells(FILL, ALL_HIDDEN), cells(FILL)]);
    s = act(s, 'A', { type: 'drawFromDeck' });
    s = act(s, 'A', { type: 'discardDrawn' });
    expect(s.phase).toBe('flipAfterDiscard');
    expect(s.discard.at(-1)).toBe(4);
    s = act(s, 'A', { type: 'flipHidden', slot: 5 });
    expect(s.players[0].grid[5]?.up).toBe(true);
    expect(s.current).toBe(1);
    expect(() =>
      act(mkState([cells(FILL, ALL_HIDDEN), cells(FILL)], { phase: 'flipAfterDiscard' }), 'A', {
        type: 'flipHidden',
        slot: 99,
      }),
    ).toThrow('Ungültiger Platz');
  });

  it('refuses to flip a card that is already face up', () => {
    let s = mkState([cells(FILL, [3]), cells(FILL)]);
    s = act(s, 'A', { type: 'drawFromDeck' });
    s = act(s, 'A', { type: 'discardDrawn' });
    expect(() => act(s, 'A', { type: 'flipHidden', slot: 0 })).toThrow('verdeckte');
  });

  it('reshuffles the discard pile (except the top card) when the deck is empty', () => {
    const s0 = mkState([cells(FILL), cells(FILL)], { deck: [], discard: [1, 2, 3, 9] });
    const s = act(s0, 'A', { type: 'drawFromDeck' });
    expect([1, 2, 3]).toContain(s.drawn);
    expect(s.deck).toHaveLength(2);
    expect(s.discard).toEqual([9]);
  });
});

describe('columns', () => {
  it('removes three equal face-up cards in a column after a swap', () => {
    let s = mkState([cells([5, 5, 7, ...FILL.slice(3)], [2, 11]), cells(FILL)], {
      phase: 'place',
      drawn: 5,
      drawnFrom: 'deck',
    });
    s = act(s, 'A', { type: 'swap', slot: 2 });
    expect(s.players[0].grid.slice(0, 3)).toEqual([null, null, null]);
    expect(s.discard).toEqual([9, 7, 5, 5, 5]);
    expect(s.finisher).toBeNull();
  });

  it('does not remove a column while one of its cards is hidden', () => {
    let s = mkState([cells([5, 5, 5, ...FILL.slice(3)], [0, 11]), cells(FILL)], {
      phase: 'place',
      drawn: 8,
      drawnFrom: 'deck',
    });
    s = act(s, 'A', { type: 'swap', slot: 11 });
    expect(s.players[0].grid[0]).toEqual({ value: 5, up: false });
  });

  it('counts a grid emptied by a column removal as fully revealed', () => {
    const grid = cells([...Array(9).fill(null), 5, 5, 7], [11]);
    let s = mkState([grid, cells(FILL, [0])], { phase: 'place', drawn: 5, drawnFrom: 'deck' });
    s = act(s, 'A', { type: 'swap', slot: 11 });
    expect(s.players[0].grid.every((c) => c === null)).toBe(true);
    expect(s.finisher).toBe('A');
    expect(s.pendingFinal).toEqual(['B']);
    expect(s.current).toBe(1);
  });
});

describe('round end and scoring', () => {
  it('gives everyone else one last turn, then scores', () => {
    let s = mkState([cells(FILL, [0]), cells(FILL, [0, 5])], {
      phase: 'place',
      drawn: 0,
      drawnFrom: 'deck',
    });
    s = act(s, 'A', { type: 'swap', slot: 0 });
    expect(s.finisher).toBe('A');
    expect(s.pendingFinal).toEqual(['B']);
    expect(s.current).toBe(1);
    s = act(s, 'B', { type: 'drawFromDeck' });
    s = act(s, 'B', { type: 'discardDrawn' });
    expect(s.phase).toBe('flipAfterDiscard');
    s = act(s, 'B', { type: 'flipHidden', slot: 0 });
    expect(s.phase).toBe('roundOver');
    expect(s.lastRound).toEqual({ scores: { A: 23, B: 24 }, doubled: false, finisher: 'A' });
    expect(s.players.map((p) => p.total)).toEqual([23, 24]);
  });

  const lastTurn = (a: Cell[], b: Cell[]) =>
    mkState([a, b], { phase: 'flipAfterDiscard', current: 1, finisher: 'A', pendingFinal: ['B'] });
  const flipB = (s: ReturnType<typeof mkState>, slot: number) =>
    act(s, 'B', { type: 'flipHidden', slot });

  it('doubles a positive sum when the finisher is not strictly lowest (8 -> 16)', () => {
    const a = cells([...Array(6).fill(null), -2, 3, 3, -2, 3, 3]);
    const b = cells([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0]);
    const s = flipB(lastTurn(a, b), 0);
    expect(s.lastRound).toEqual({ scores: { A: 16, B: 4 }, doubled: true, finisher: 'A' });
  });

  it('does not double a negative sum', () => {
    const a = cells([...Array(9).fill(null), -2, -1, -1]);
    const b = cells([-2, -2, 0, -2, -2, 0, -2, -2, 0, -2, -2, 0], [0]);
    const s = flipB(lastTurn(a, b), 0);
    expect(s.lastRound?.scores).toEqual({ A: -4, B: -16 });
    expect(s.lastRound?.doubled).toBe(false);
  });

  it('a tie is not enough: the finisher is doubled', () => {
    const a = cells([...Array(6).fill(null), 1, 1, 2, 1, 1, 2]);
    const b = cells([...Array(6).fill(null), 1, 1, 2, 1, 1, 2], [6]);
    const s = flipB(lastTurn(a, b), 6);
    expect(s.lastRound?.scores).toEqual({ A: 16, B: 8 });
  });

  it('does not double when the finisher is strictly lowest', () => {
    const a = cells([...Array(9).fill(null), 0, 0, 1]);
    const b = cells(FILL, [0]);
    const s = flipB(lastTurn(a, b), 0);
    expect(s.lastRound?.scores).toEqual({ A: 1, B: 24 });
    expect(s.lastRound?.doubled).toBe(false);
  });

  it('removes columns that become equal when hidden cards are revealed at scoring', () => {
    const a = cells([...Array(9).fill(null), 0, 0, 1]);
    const b = cells([4, 4, 4, ...FILL.slice(3)], [0, 1]);
    const s = flipB(lastTurn(a, b), 0);
    expect(s.lastRound?.scores.B).toBe(18);
  });

  it('ends the game when someone is over 100, but not at exactly 100', () => {
    const make = (bTotal: number) => {
      const s = lastTurn(cells([...Array(9).fill(null), 0, 0, 1]), cells(FILL, [0]));
      s.players[1].total = bTotal;
      return flipB(s, 0);
    };
    expect(make(80).phase).toBe('gameOver');
    expect(make(76).phase).toBe('roundOver');
  });

  it('startRound after roundOver keeps totals and deals a fresh round', () => {
    const over = flipB(lastTurn(cells([...Array(9).fill(null), 0, 0, 1]), cells(FILL, [0])), 0);
    const s = startRound(over, seeded(2));
    expect(s.round).toBe(2);
    expect(s.phase).toBe('initialFlip');
    expect(s.players.map((p) => p.total)).toEqual([1, 24]);
    expect(s.players.every((p) => p.grid.length === 12 && p.grid.every((c) => c && !c.up))).toBe(true);
    expect(s.finisher).toBeNull();
    expect(() => startRound(mkState([cells(FILL), cells(FILL)]), rng)).toThrow('Runde läuft noch');
  });
});
