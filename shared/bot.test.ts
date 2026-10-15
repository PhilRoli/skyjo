import { describe, expect, it } from 'vitest';
import { canAct, decide, newBotMemory, observe, unseen, DECK_AVERAGE } from './bot';
import { FILL, cells, mkState, seeded } from './testUtils';
import type { BotLevel } from './types';
import { viewFor, type PlayerView, type PublicCell } from './view';

type Spec = number | 'h' | null;
const cellOf = (c: Spec): PublicCell | null => (c === null ? null : c === 'h' ? { up: false, value: null } : { up: true, value: c });
const pad = (c: Spec[]): Spec[] => [...c, ...Array<Spec>(12 - c.length).fill('h')];

/** My grid (value = face up, 'h' = hidden, null = removed), column-major: slot = column * 3 + row. */
function mkView(mine: Spec[], extra: Partial<PlayerView> = {}, theirs: Spec[] = FILL): PlayerView {
  return {
    phase: 'draw',
    round: 1,
    me: 'me',
    current: 'me',
    players: [
      { id: 'me', name: 'Me', left: false, total: 0, grid: pad(mine).map(cellOf) },
      { id: 'opp', name: 'Opp', left: false, total: 0, grid: pad(theirs).map(cellOf) },
    ],
    discardTop: 9,
    deckCount: 80,
    drawn: null,
    drawnFrom: null,
    finisher: null,
    lastRound: null,
    winners: [],
    events: [],
    eventSeq: 0,
    target: 100,
    ...extra,
  };
}

const never = () => 0.99; // never takes a random branch
const mem = () => newBotMemory();

describe('decide: basics', () => {
  it('does nothing when it cannot act', () => {
    expect(decide(mkView([], { current: 'opp' }), 'normal', never, mem())).toBeNull();
    expect(decide(mkView([], { phase: 'roundOver', current: null }), 'normal', never, mem())).toBeNull();
    const left = mkView([]);
    left.players[0].left = true;
    expect(decide(left, 'normal', never, mem())).toBeNull();
    expect(canAct(mkView([]))).toBe(true);
    expect(canAct(mkView([], { current: 'opp' }))).toBe(false);
  });

  it('flips hidden cards during the initial flip and then waits', () => {
    const v = mkView([], { phase: 'initialFlip', current: null });
    for (const level of ['easy', 'normal', 'hard'] as BotLevel[]) {
      const a = decide(v, level, seeded(2), mem());
      expect(a).toMatchObject({ type: 'flipInitial' });
    }
    const done = mkView([4, 5], { phase: 'initialFlip', current: null });
    expect(decide(done, 'normal', never, mem())).toBeNull();
  });

  it('spreads the initial flips over different columns (normal and hard)', () => {
    const v = mkView([4], { phase: 'initialFlip', current: null }); // slot 0 (column 0) is already up
    for (let s = 1; s <= 20; s++) {
      const a = decide(v, 'normal', seeded(s), mem()) as { slot: number };
      expect(Math.floor(a.slot / 3)).not.toBe(0);
    }
  });
});

describe('easy', () => {
  it('takes small discards and draws otherwise', () => {
    expect(decide(mkView([], { discardTop: 3 }), 'easy', never, mem())).toEqual({ type: 'takeDiscard' });
    expect(decide(mkView([], { discardTop: 9 }), 'easy', never, mem())).toEqual({ type: 'drawFromDeck' });
  });

  it('keeps small drawn cards and discards big deck cards', () => {
    const small = decide(mkView([4, 4, 4], { phase: 'place', drawn: 2, drawnFrom: 'deck' }), 'easy', never, mem());
    expect(small).toMatchObject({ type: 'swap' });
    const big = decide(mkView([4, 4, 4], { phase: 'place', drawn: 9, drawnFrom: 'deck' }), 'easy', never, mem());
    expect(big).toEqual({ type: 'discardDrawn' });
    const fromDiscard = decide(mkView([4, 4, 4], { phase: 'place', drawn: 9, drawnFrom: 'discard' }), 'easy', never, mem());
    expect(fromDiscard).toMatchObject({ type: 'swap' });
  });

  it('sometimes makes a random legal choice', () => {
    const always = () => 0; // always takes the random branch (and flips the coin to "true")
    const take = decide(mkView([], { discardTop: 12 }), 'easy', always, mem());
    expect(take).toEqual({ type: 'takeDiscard' });
  });
});

describe('normal', () => {
  it('takes a discard that completes a column of two equal cards', () => {
    const v = mkView([5, 5, 'h'], { discardTop: 5 });
    expect(decide(v, 'normal', never, mem())).toEqual({ type: 'takeDiscard' });
    const place = mkView([5, 5, 'h'], { phase: 'place', drawn: 5, drawnFrom: 'discard' });
    expect(decide(place, 'normal', never, mem())).toEqual({ type: 'swap', slot: 2 });
  });

  it('does not take a high discard', () => {
    expect(decide(mkView([3, 3, 3, 'h'], { discardTop: 9 }), 'normal', never, mem())).toEqual({ type: 'drawFromDeck' });
  });

  it('puts a small drawn card on the highest known card', () => {
    const v = mkView([12, 3, 'h'], { phase: 'place', drawn: 1, drawnFrom: 'deck' });
    expect(decide(v, 'normal', never, mem())).toEqual({ type: 'swap', slot: 0 });
  });

  it('discards a high deck card but must place one taken from the discard pile', () => {
    const grid: Spec[] = [2, 2, 3, 2, 2, 3, 'h', 'h', 'h', 'h', 'h', 'h'];
    expect(decide(mkView(grid, { phase: 'place', drawn: 11, drawnFrom: 'deck' }), 'normal', never, mem())).toEqual({ type: 'discardDrawn' });
    expect(decide(mkView(grid, { phase: 'place', drawn: 11, drawnFrom: 'discard' }), 'normal', never, mem())).toMatchObject({ type: 'swap' });
  });

  it('flips the hidden card in a column that already holds two equal cards', () => {
    const v = mkView([1, 'h', 'h', 4, 4, 'h', 'h', 'h', 'h', 'h', 'h', 'h'], { phase: 'flipAfterDiscard' });
    expect(decide(v, 'normal', never, mem())).toEqual({ type: 'flipHidden', slot: 5 });
  });
});

describe('decisions only depend on what the player can see', () => {
  it('gives the same view and the same decision for different hidden cards and deck order', () => {
    const s1 = mkState([cells(FILL, [2, 5]), cells(FILL, [0])]);
    const s2 = mkState(
      [cells([...FILL.slice(0, 2), 12, ...FILL.slice(3, 5), 12, ...FILL.slice(6)], [2, 5]), cells([12, ...FILL.slice(1)], [0])],
      { deck: [1, 1, 1, 1] },
    );
    const v1 = viewFor(s1, 'A');
    const v2 = viewFor(s2, 'A');
    expect(v1).toEqual(v2);
    for (const level of ['easy', 'normal', 'hard'] as BotLevel[]) {
      expect(decide(v1, level, seeded(5), mem())).toEqual(decide(v2, level, seeded(5), mem()));
    }
  });
});

describe('observe / unseen', () => {
  it('starts from the visible state and tracks the discard pile through the events', () => {
    const m = mem();
    observe(m, mkView([], { phase: 'initialFlip', current: null, discardTop: 4 }));
    expect(m.discard).toEqual([4]);
    observe(m, mkView([], { phase: 'place', discardTop: null, eventSeq: 1, events: [{ kind: 'takeDiscard', by: 'opp', value: 4 }] }));
    expect(m.discard).toEqual([]);
    observe(
      m,
      mkView([], {
        discardTop: 9,
        eventSeq: 2,
        events: [
          { kind: 'takeDiscard', by: 'opp', value: 4 },
          { kind: 'swap', by: 'opp', value: 4, replaced: 9 },
        ],
      }),
    );
    expect(m.discard).toEqual([9]);
    observe(m, mkView([], { eventSeq: 3, events: [{ kind: 'draw', by: 'me' }] }));
    observe(
      m,
      mkView([], {
        eventSeq: 4,
        events: [
          { kind: 'draw', by: 'me' },
          { kind: 'discard', by: 'me', value: 6 },
        ],
      }),
    );
    expect(m.discard).toEqual([9, 6]);
    observe(
      m,
      mkView([], {
        eventSeq: 5,
        events: [
          { kind: 'draw', by: 'me' },
          { kind: 'discard', by: 'me', value: 6 },
          { kind: 'clear', by: 'me', column: 0, value: 5 },
        ],
      }),
    );
    expect(m.discard).toEqual([9, 6, 5, 5, 5]);
  });

  it('ignores a state it has already seen', () => {
    const m = mem();
    observe(m, mkView([], { phase: 'initialFlip', current: null, discardTop: 4 }));
    const v = mkView([], { eventSeq: 1, events: [{ kind: 'discard', by: 'opp', value: 2 }] });
    observe(m, v);
    observe(m, v);
    expect(m.discard).toEqual([4, 2]);
  });

  it('resets the discard memory when the deck was reshuffled and when a new round starts', () => {
    const m = mem();
    observe(m, mkView([], { phase: 'initialFlip', current: null, discardTop: 4 }));
    observe(m, mkView([], { eventSeq: 1, events: [{ kind: 'discard', by: 'opp', value: 2 }], deckCount: 70 }));
    expect(m.discard).toEqual([4, 2]);
    observe(m, mkView([], { eventSeq: 2, events: [{ kind: 'draw', by: 'opp' }], deckCount: 100, discardTop: 2 }));
    expect(m.discard).toEqual([2]);
    observe(m, mkView([], { round: 2, phase: 'initialFlip', current: null, discardTop: 7, deckCount: 90 }));
    expect(m.discard).toEqual([7]);
  });

  it('counts the unseen cards from grids, the discard pile and the held card', () => {
    const m = mem();
    const v = mkView([12, 12], { phase: 'initialFlip', current: null, discardTop: 4 }, [0, 1]);
    observe(m, v);
    const u = unseen({ ...v, drawn: 7 }, m);
    expect(u.counts[12]).toBe(8);
    expect(u.counts[0]).toBe(14);
    expect(u.counts[1]).toBe(9);
    expect(u.counts[4]).toBe(9);
    expect(u.counts[7]).toBe(9);
    expect(u.total).toBe(150 - 2 - 2 - 1 - 1);
    expect(u.mean).toBeGreaterThan(0);
  });

  it('falls back to the deck average when nothing is left to count', () => {
    const u = unseen(mkView([]), { ...mem(), discard: [] });
    expect(u.total).toBeGreaterThan(0);
    expect(DECK_AVERAGE).toBeCloseTo(5.07, 2);
  });
});
