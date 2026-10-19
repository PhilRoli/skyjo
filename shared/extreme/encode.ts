// Port of skyjo-ml `skyjo/encode.py` (the layout table in its module docstring is the contract).
// Features are computed in float64 and rounded once into a Float32Array.
import { CARD_VALUES, unseen, type BotMemory } from '../bot';
import type { Action } from '../types';
import type { PlayerView } from '../view';

export const A = 27;
const N_SLOTS = 12;
const MAX_OPPONENTS = 7;
const OWN_CELL = 7;
const OPP_OFFSET = N_SLOTS * OWN_CELL + 5; // 89
const OPP_SIZE = 1 + N_SLOTS * 3 + 5; // 42
const G = OPP_OFFSET + MAX_OPPONENTS * OPP_SIZE; // 383
export const D = G + 72; // 455

const PHASES = ['initialFlip', 'draw', 'place', 'flipAfterDiscard', 'roundOver', 'gameOver'];
const TARGETS = [50, 100, 150];
const copies = (v: number) => (v === -2 ? 5 : v === -1 ? 10 : v === 0 ? 15 : 10);

const ACT_DRAW = 12;
const ACT_TAKE = 13;
const ACT_SWAP = 14;
const ACT_DISCARD = 26;

type PlayerEntry = PlayerView['players'][number];

/** Ids of the players that still get a final turn after mine. */
function finalWalk(view: PlayerView, myIdx: number): Set<string> {
  const out = new Set<string>();
  const fin = view.finisher;
  if (fin === null || fin === view.me) return out;
  const n = view.players.length;
  for (let k = 1; k < n; k++) {
    const p = view.players[(myIdx + k) % n];
    if (p.id === fin) break;
    if (!p.left) out.add(p.id);
  }
  return out;
}

export function encodeView(view: PlayerView, mem: BotMemory): Float32Array {
  const x = new Float64Array(D);
  const players = view.players;
  const myIdx = players.findIndex((p) => p.id === view.me);
  if (myIdx < 0) throw new Error('view.me is not a player');
  const me = players[myIdx];
  const { target, drawn } = view;
  const top = view.discardTop;

  const info = unseen(view, mem);

  // own block
  if (!me.left && me.grid.length === N_SLOTS) {
    const grid = me.grid;
    let visible = 0;
    let hidden = 0;
    for (const b of [0, 3, 6, 9]) {
      const col = [grid[b], grid[b + 1], grid[b + 2]];
      for (let r = 0; r < 3; r++) {
        const c = col[r];
        const o = (b + r) * OWN_CELL;
        if (c === null) {
          x[o + 2] = 1;
          continue;
        }
        if (c.up) {
          const v = c.value as number;
          visible += v;
          x[o] = 1;
          x[o + 1] = v / 12;
          if (v === drawn) x[o + 3] = 1;
          if (v === top) x[o + 4] = 1;
        } else {
          hidden += 1;
        }
        const a = col[(r + 1) % 3];
        const z = col[(r + 2) % 3];
        if (a !== null && z !== null && a.up && z.up && a.value === z.value) {
          if (a.value === drawn) x[o + 5] = 1;
          if (a.value === top) x[o + 6] = 1;
        }
      }
    }
    x[85] = visible / 60;
    x[86] = hidden / 12;
    x[88] = (visible + hidden * info.mean) / 60;
  }
  x[84] = me.total / target;

  // opponents: active others in seat order after mine
  const n = players.length;
  const opps: PlayerEntry[] = [];
  for (let k = 1; k < n; k++) {
    const p = players[(myIdx + k) % n];
    if (!p.left) opps.push(p);
  }
  if (opps.length > 0) x[87] = (Math.min(...opps.map((p) => p.total)) - me.total) / target;
  const pending = finalWalk(view, myIdx);
  const fin = view.finisher;
  opps.slice(0, MAX_OPPONENTS).forEach((p, k) => {
    const o = OPP_OFFSET + k * OPP_SIZE;
    x[o] = 1;
    if (p.grid.length === N_SLOTS) {
      let visible = 0;
      let hidden = 0;
      let q = o + 1;
      for (const c of p.grid) {
        if (c === null) x[q + 2] = 1;
        else if (c.up) {
          visible += c.value as number;
          x[q] = 1;
          x[q + 1] = (c.value as number) / 12;
        } else hidden += 1;
        q += 3;
      }
      x[o + 38] = visible / 60;
      x[o + 39] = hidden / 12;
    }
    x[o + 37] = p.total / target;
    if (p.id === fin) x[o + 40] = 1;
    if (pending.has(p.id)) x[o + 41] = 1;
  });

  // global block
  x[G + (top === null ? 15 : top + 2)] = 1;
  x[G + 16 + (drawn === null ? 15 : drawn + 2)] = 1;
  if (view.drawnFrom === 'deck') x[G + 32] = 1;
  else if (view.drawnFrom === 'discard') x[G + 33] = 1;
  const ph = PHASES.indexOf(view.phase);
  if (ph >= 0) x[G + 34 + ph] = 1;
  const ti = TARGETS.indexOf(target);
  if (ti >= 0) x[G + 40 + ti] = 1;
  x[G + 43] = view.deckCount / 150;
  x[G + 44] = Math.min(view.round, 20) / 20;
  const active = me.left ? opps.length : 1 + opps.length;
  if (active >= 2 && active <= 8) x[G + 45 + active - 2] = 1;
  CARD_VALUES.forEach((v, i) => {
    x[G + 52 + i] = info.counts[v] / copies(v);
  });
  x[G + 67] = info.total / 150;
  x[G + 68] = info.mean / 12;
  if (fin !== null) {
    x[G + 69] = 1;
    if (fin === view.me) x[G + 70] = 1;
  }
  x[G + 71] = pending.size / 7;
  return Float32Array.from(x);
}

/** Exactly the actions the rules accept for `view.me` in this view. */
export function legalMask(view: PlayerView): boolean[] {
  const m = new Array<boolean>(A).fill(false);
  const me = view.players.find((p) => p.id === view.me);
  if (!me || me.left) return m;
  const grid = me.grid;
  if (view.phase === 'initialFlip') {
    if (grid.filter((c) => c?.up).length < 2) grid.forEach((c, s) => { if (c && !c.up) m[s] = true; });
    return m;
  }
  if (view.current !== view.me) return m;
  if (view.phase === 'draw') {
    m[ACT_DRAW] = true;
    if (view.discardTop !== null) m[ACT_TAKE] = true;
  } else if (view.phase === 'place') {
    grid.forEach((c, s) => { if (c) m[ACT_SWAP + s] = true; });
    if (view.drawnFrom === 'deck') m[ACT_DISCARD] = true;
  } else if (view.phase === 'flipAfterDiscard') {
    grid.forEach((c, s) => { if (c && !c.up) m[s] = true; });
  }
  return m;
}

export function decodeAction(index: number, view: PlayerView): Action {
  if (index >= 0 && index < N_SLOTS) {
    return { type: view.phase === 'initialFlip' ? 'flipInitial' : 'flipHidden', slot: index };
  }
  if (index === ACT_DRAW) return { type: 'drawFromDeck' };
  if (index === ACT_TAKE) return { type: 'takeDiscard' };
  if (index >= ACT_SWAP && index < ACT_SWAP + N_SLOTS) return { type: 'swap', slot: index - ACT_SWAP };
  if (index === ACT_DISCARD) return { type: 'discardDrawn' };
  throw new Error(`action index out of range: ${index}`);
}
