import type { Action, BotLevel, GameEvent, Rng } from './types';
import type { PlayerView, PublicCell } from './view';

export type { BotLevel } from './types';

type Grid = (PublicCell | null)[];
type PlayerEntry = PlayerView['players'][number];

const ROWS = 3;
export const DECK_AVERAGE = 5.07;
export const CARD_VALUES = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const copies = (v: number) => (v === -2 ? 5 : v === -1 ? 10 : v === 0 ? 15 : 10);

const col = (slot: number) => Math.floor(slot / ROWS);
const colSlots = (c: number) => [c * ROWS, c * ROWS + 1, c * ROWS + 2];
const hiddenSlots = (g: Grid) => g.flatMap((c, i) => (c && !c.up ? [i] : []));
const liveSlots = (g: Grid) => g.flatMap((c, i) => (c ? [i] : []));
const upCount = (g: Grid) => g.filter((c) => c?.up).length;
const pick = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];
const estimate = (c: PublicCell | null, e: number): number => (c === null ? 0 : c.up ? (c.value as number) : e);

// ---------------------------------------------------------------- memory

export interface BotMemory {
  round: number;
  seq: number;
  deckCount: number;
  discard: number[];
  prevEvents: GameEvent[];
  /** Repetition guard of the extreme bot (see shared/extreme/policy.ts); unused by the other levels. */
  stall?: StallGuard;
}

export interface StallGuard {
  round: number;
  /** Own turns (draw decisions) in this round. */
  turns: number;
  /** How often each table signature came up at one of my decisions in this round. */
  seen: Map<string, number>;
  /** Once set, every own turn of this round turns a hidden card face up. */
  forced: boolean;
}

export const newBotMemory = (): BotMemory => ({ round: -1, seq: -1, deckCount: Infinity, discard: [], prevEvents: [] });

/** Feed every new view of the bot here; it rebuilds the discard pile from the public events. */
export function observe(mem: BotMemory, view: PlayerView): void {
  const reset = () => {
    mem.round = view.round;
    mem.seq = view.eventSeq;
    mem.deckCount = view.deckCount;
    mem.discard = view.discardTop === null ? [] : [view.discardTop];
    mem.prevEvents = [];
  };
  if (view.phase === 'initialFlip' || view.round !== mem.round) {
    reset();
    return;
  }
  if (view.eventSeq === mem.seq) return;
  if (view.deckCount > mem.deckCount) mem.discard = view.discardTop === null ? [] : [view.discardTop]; // reshuffled
  mem.deckCount = view.deckCount;
  const prev = mem.prevEvents;
  const evs = view.events;
  const continues = evs.length >= prev.length && prev.every((e, i) => JSON.stringify(e) === JSON.stringify(evs[i]));
  for (const e of continues ? evs.slice(prev.length) : evs) {
    if (e.kind === 'takeDiscard') mem.discard.pop();
    else if (e.kind === 'swap') mem.discard.push(e.replaced);
    else if (e.kind === 'discard') mem.discard.push(e.value);
    else if (e.kind === 'clear') mem.discard.push(e.value, e.value, e.value);
  }
  mem.prevEvents = evs;
  mem.seq = view.eventSeq;
}

export interface Info {
  counts: Record<number, number>;
  total: number;
  mean: number;
}

/** Cards that are still unseen to this player: not face up anywhere, not in the discard pile, not in hand. */
export function unseen(view: PlayerView, mem: BotMemory): Info {
  const counts: Record<number, number> = {};
  for (const v of CARD_VALUES) counts[v] = copies(v);
  const take = (v: number | null) => {
    if (v !== null && counts[v] > 0) counts[v] -= 1;
  };
  for (const p of view.players) for (const c of p.grid) if (c?.up) take(c.value);
  for (const v of mem.discard) take(v);
  take(view.drawn);
  const total = CARD_VALUES.reduce((s, v) => s + counts[v], 0);
  const mean = total > 0 ? CARD_VALUES.reduce((s, v) => s + v * counts[v], 0) / total : DECK_AVERAGE;
  return { counts, total, mean };
}

// ---------------------------------------------------------------- helpers

interface Ctx {
  view: PlayerView;
  grid: Grid;
  hidden: number[];
  live: number[];
  others: PlayerEntry[];
  rng: Rng;
  mem: BotMemory;
}

interface Policy {
  draw(c: Ctx): Action;
  place(c: Ctx): Action;
  flip(c: Ctx): number;
}

type Bonus = (c: Ctx, slot: number, v: number) => number;

/** Expected points saved by putting value `v` on `slot` (hidden cards count as `e`). */
function placeGain(g: Grid, slot: number, v: number, e: number): number {
  const slots = colSlots(col(slot));
  const before = slots.reduce((s, i) => s + estimate(g[i], e), 0);
  const after = slots.map((i) => (i === slot ? { up: true, value: v } : g[i]));
  if (after.every((c) => c && c.up && c.value === v)) return before; // the column disappears
  return estimate(g[slot], e) - v;
}

/** True if putting `v` on `slot` makes a column with two equal face-up cards and one hidden card. */
function pairShape(g: Grid, slot: number, v: number): boolean {
  const others = colSlots(col(slot))
    .filter((i) => i !== slot)
    .map((i) => g[i]);
  const equalUp = others.filter((c) => c && c.up && c.value === v).length;
  const hid = others.filter((c) => c && !c.up).length;
  return equalUp === 1 && hid === 1;
}

function bestSwap(c: Ctx, v: number, e: number, bonus: Bonus): { slot: number; gain: number; score: number } {
  let best = { slot: c.live[0], gain: -Infinity, score: -Infinity };
  for (const slot of c.live) {
    const gain = placeGain(c.grid, slot, v, e);
    const score = gain + bonus(c, slot, v);
    if (score > best.score) best = { slot, gain, score };
  }
  return best;
}

function flipScore(c: Ctx, slot: number, info?: Info): number {
  const others = colSlots(col(slot))
    .filter((i) => i !== slot)
    .map((i) => c.grid[i]);
  const ups = others.filter((x): x is PublicCell => !!x && x.up);
  if (ups.length === 2 && ups[0].value === ups[1].value) {
    if (!info) return 3;
    const x = ups[0].value as number;
    return (info.counts[x] / Math.max(info.total, 1)) * 3 * x; // chance to complete the column, signed by its value
  }
  return ups.length * 0.5;
}

function bestFlip(c: Ctx, info?: Info): number {
  let best = c.hidden[0];
  let bestScore = -Infinity;
  for (const s of c.hidden) {
    const score = flipScore(c, s, info) + c.rng() * 0.01; // random tie-break
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

function spreadSlot(c: Ctx): number {
  const upCols = new Set(c.grid.flatMap((cell, i) => (cell?.up ? [col(i)] : [])));
  const fresh = c.hidden.filter((s) => !upCols.has(col(s)));
  return pick(fresh.length ? fresh : c.hidden, c.rng);
}

// ---------------------------------------------------------------- policies

const easyPolicy: Policy = {
  draw(c) {
    const top = c.view.discardTop;
    if (top === null) return { type: 'drawFromDeck' };
    const take = c.rng() < 0.25 ? c.rng() < 0.5 : top <= 4;
    return { type: take ? 'takeDiscard' : 'drawFromDeck' };
  },
  place(c) {
    const v = c.view.drawn as number;
    const fromDeck = c.view.drawnFrom === 'deck';
    if (c.rng() < 0.25) {
      if (fromDeck && c.rng() < 0.5) return { type: 'discardDrawn' };
      return { type: 'swap', slot: pick(c.live, c.rng) };
    }
    if (v <= 5 || !fromDeck) return { type: 'swap', slot: pick(c.live, c.rng) };
    return { type: 'discardDrawn' };
  },
  flip: (c) => pick(c.hidden, c.rng),
};

const PAIR_BONUS = 1.2;
const TAKE_MIN_GAIN = 3;
const SWAP_MIN_SCORE = 1;

const normalBonus: Bonus = (c, slot, v) => (pairShape(c.grid, slot, v) ? PAIR_BONUS : 0);

const normalPolicy: Policy = {
  draw(c) {
    const top = c.view.discardTop;
    if (top === null) return { type: 'drawFromDeck' };
    const best = bestSwap(c, top, DECK_AVERAGE, normalBonus);
    return { type: best.gain >= TAKE_MIN_GAIN ? 'takeDiscard' : 'drawFromDeck' };
  },
  place(c) {
    const best = bestSwap(c, c.view.drawn as number, DECK_AVERAGE, normalBonus);
    if (c.view.drawnFrom === 'discard') return { type: 'swap', slot: best.slot };
    return best.score >= SWAP_MIN_SCORE ? { type: 'swap', slot: best.slot } : { type: 'discardDrawn' };
  },
  flip: (c) => bestFlip(c),
};

// ---------------------------------------------------------------- hard: counts cards

const FLIP_VALUE = 0.3; // small value of seeing one more card
const PENALTY_MARGIN = 0.5;

const projected = (g: Grid, e: number) => g.reduce((s, cell) => s + estimate(cell, e), 0);

function swapped(g: Grid, slot: number, v: number): Grid {
  const next: Grid = g.map((cell, i) => (i === slot ? { up: true, value: v } : cell));
  const slots = colSlots(col(slot));
  if (slots.every((i) => next[i] && next[i]!.up && next[i]!.value === v)) for (const i of slots) next[i] = null;
  return next;
}

function lowestOther(c: Ctx, e: number): number {
  const scores = c.others.filter((p) => !p.left).map((p) => projected(p.grid, e));
  return scores.length ? Math.min(...scores) : Infinity;
}

/** Ending the round without clearly having the lowest score doubles a positive score: count that as a cost. */
function endPenalty(c: Ctx, mine: number, e: number): number {
  if (c.view.finisher !== null) return 0;
  return mine > 0 && mine >= lowestOther(c, e) - PENALTY_MARGIN ? mine : 0;
}

function hardBonus(info: Info): Bonus {
  return (c, slot, v) => (pairShape(c.grid, slot, v) ? (info.counts[v] / Math.max(info.total, 1)) * 3 * v : 0);
}

function hardSwap(c: Ctx, v: number, info: Info): { slot: number; score: number } {
  const bonus = hardBonus(info);
  let best = { slot: c.live[0], score: -Infinity };
  for (const slot of c.live) {
    const after = swapped(c.grid, slot, v);
    const finishing = hiddenSlots(after).length === 0;
    const penalty = finishing ? endPenalty(c, projected(after, info.mean), info.mean) : 0;
    const score = placeGain(c.grid, slot, v, info.mean) + bonus(c, slot, v) - penalty;
    if (score > best.score) best = { slot, score };
  }
  return best;
}

/** Score of throwing the drawn deck card away and flipping a hidden card instead. */
function hardDiscardScore(c: Ctx, info: Info): number {
  const finishing = c.hidden.length === 1;
  return FLIP_VALUE - (finishing ? endPenalty(c, projected(c.grid, info.mean), info.mean) : 0);
}

const hardPolicy: Policy = {
  draw(c) {
    const top = c.view.discardTop;
    if (top === null) return { type: 'drawFromDeck' };
    const info = unseen(c.view, c.mem);
    const takeScore = hardSwap(c, top, info).score;
    let deckScore = 0;
    for (const v of CARD_VALUES) {
      const p = info.counts[v] / Math.max(info.total, 1);
      if (p > 0) deckScore += p * Math.max(hardSwap(c, v, info).score, hardDiscardScore(c, info));
    }
    return { type: takeScore >= deckScore ? 'takeDiscard' : 'drawFromDeck' };
  },
  place(c) {
    const info = unseen(c.view, c.mem);
    const best = hardSwap(c, c.view.drawn as number, info);
    if (c.view.drawnFrom === 'discard') return { type: 'swap', slot: best.slot };
    return best.score >= hardDiscardScore(c, info) ? { type: 'swap', slot: best.slot } : { type: 'discardDrawn' };
  },
  flip: (c) => bestFlip(c, unseen(c.view, c.mem)),
};

const POLICIES: Record<Exclude<BotLevel, 'extreme'>, Policy> = { easy: easyPolicy, normal: normalPolicy, hard: hardPolicy };

// ---------------------------------------------------------------- extreme: neural net, registered by the server

export type ExtremeDecider = (view: PlayerView, rng: Rng, mem: BotMemory) => Action;

let extremeDecider: ExtremeDecider | null = null;
let extremeFailureLogged = false;
let extremeFallbacks = 0;

/** How many extreme moves were played by the hard policy because the net path failed (simulations assert 0). */
export const extremeFallbackCount = (): number => extremeFallbacks;

/** Test hook: zero the counter and log the next failure again. */
export function resetExtremeFallback(): void {
  extremeFallbacks = 0;
  extremeFailureLogged = false;
}

/** The net weights are large and must stay out of the browser bundle, so this module never imports them:
 * the server (and tests) register the extreme bot here, see `installExtremeBot` in shared/extreme/load.ts. */
export function registerExtreme(decider: ExtremeDecider | null): void {
  extremeDecider = decider;
}

// ---------------------------------------------------------------- public API

export function canAct(view: PlayerView): boolean {
  const me = view.players.find((p) => p.id === view.me);
  if (!me || me.left) return false;
  if (view.phase === 'initialFlip') return upCount(me.grid) < 2 && hiddenSlots(me.grid).length > 0;
  return view.current === view.me && (view.phase === 'draw' || view.phase === 'place' || view.phase === 'flipAfterDiscard');
}

export function decide(view: PlayerView, level: BotLevel, rng: Rng, mem: BotMemory): Action | null {
  if (!canAct(view)) return null;
  if (level === 'extreme') {
    try {
      if (!extremeDecider) throw new Error('extreme bot is not installed (installExtremeBot)');
      return extremeDecider(view, rng, mem);
    } catch (e) {
      // A bot that cannot move would freeze the table: play this move like the hard bot instead.
      if (!extremeFailureLogged) console.error('extreme bot failed, playing as hard instead', e);
      extremeFailureLogged = true;
      extremeFallbacks++;
      level = 'hard';
    }
  }
  const me = view.players.find((p) => p.id === view.me)!;
  const ctx: Ctx = {
    view,
    grid: me.grid,
    hidden: hiddenSlots(me.grid),
    live: liveSlots(me.grid),
    others: view.players.filter((p) => p.id !== view.me),
    rng,
    mem,
  };
  if (view.phase === 'initialFlip') {
    return { type: 'flipInitial', slot: level === 'easy' ? pick(ctx.hidden, rng) : spreadSlot(ctx) };
  }
  const policy = POLICIES[level];
  switch (view.phase) {
    case 'draw':
      return policy.draw(ctx);
    case 'place':
      return policy.place(ctx);
    case 'flipAfterDiscard':
      return { type: 'flipHidden', slot: policy.flip(ctx) };
    default:
      return null;
  }
}
