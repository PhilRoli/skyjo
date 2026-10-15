import type { Cell, GameState, Rng } from './types';

export function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FILL = [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3];
export const ALL_HIDDEN = Array.from({ length: 12 }, (_, i) => i);

/** null stays null (removed); indices in `hidden` are face-down, the rest face-up. */
export function cells(values: (number | null)[], hidden: number[] = []): Cell[] {
  return values.map((v, i) => (v === null ? null : { value: v, up: !hidden.includes(i) }));
}

export function mkState(grids: Cell[][], extra: Partial<GameState> = {}): GameState {
  return {
    phase: 'draw',
    round: 1,
    players: grids.map((grid, i) => ({ id: 'ABC'[i], name: `P${i}`, grid, total: 0, left: false })),
    deck: [4, 4, 4, 4],
    discard: [9],
    current: 0,
    drawn: null,
    drawnFrom: null,
    finisher: null,
    pendingFinal: [],
    initialDone: [],
    lastRound: null,
    ...extra,
  };
}
