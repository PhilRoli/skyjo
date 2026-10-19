// The extreme bot: greedy policy of the trained net, plus a guard against endless rounds.
//
// Stall guard: in training, the greedy net and the hard bot were seen to keep one hidden card each forever,
// passing the same discard back and forth, so the round never ended. A live game must never freeze, so every
// decision of a round is checked:
// - the same table (all public grids, discard, held card, phase) comes up REPEAT_LIMIT times, or
// - the bot already had more than TURN_LIMIT turns this round (classic bots: median 12, max 19 in 4341 rounds).
// From then on, for the rest of the round, each own turn must turn a hidden card face up: a held card goes onto a
// hidden slot, or (deck card) is discarded, which forces a flip. The net still picks among those moves. With at most
// 12 hidden cards the bot finishes the round soon after, and the round ends for everyone. In normal play neither
// condition comes up, so the net plays unchanged. The guard is deterministic (it ignores `rng`): same views, same moves.
import type { BotMemory, ExtremeDecider, StallGuard } from '../bot';
import type { PlayerView, PublicCell } from '../view';
import { decodeAction, encodeView, legalMask } from './encode';
import { argmaxLegal, forward, type Net } from './net';

export const REPEAT_LIMIT = 3;
export const TURN_LIMIT = 30;

const ACT_SWAP = 14;
const ACT_DISCARD = 26;

const cellSig = (c: PublicCell | null) => (c === null ? 'x' : c.up ? String(c.value) : 'h');

/** Everything public that matters for a loop; not the deck size or the event log, which move on in a loop too. */
export function tableSignature(view: PlayerView): string {
  const grids = view.players.map((p) => (p.left ? 'L' : p.grid.map(cellSig).join(','))).join('/');
  return `${view.phase}|${view.drawn}|${view.drawnFrom}|${view.discardTop}|${view.finisher}|${grids}`;
}

function guardFor(view: PlayerView, mem: BotMemory): StallGuard {
  if (!mem.stall || mem.stall.round !== view.round) mem.stall = { round: view.round, turns: 0, seen: new Map(), forced: false };
  return mem.stall;
}

/** Records this decision; true once the round counts as stalled. */
function stalled(view: PlayerView, mem: BotMemory): boolean {
  const g = guardFor(view, mem);
  if (view.phase === 'draw') g.turns++;
  const sig = tableSignature(view);
  const n = (g.seen.get(sig) ?? 0) + 1;
  g.seen.set(sig, n);
  if (n >= REPEAT_LIMIT || g.turns > TURN_LIMIT) g.forced = true;
  return g.forced;
}

/** Only moves that turn a hidden card up. Unchanged if there are none (cannot happen while the round runs). */
function progressOnly(view: PlayerView, mask: boolean[]): boolean[] {
  if (view.phase !== 'place') return mask; // drawing is fine either way, flips are progress already
  const grid = view.players.find((p) => p.id === view.me)!.grid;
  const out = mask.map((ok, i) => ok && ((i >= ACT_SWAP && i < ACT_SWAP + 12 && grid[i - ACT_SWAP]?.up === false) || i === ACT_DISCARD));
  return out.some(Boolean) ? out : mask;
}

export function extremeDecider(net: Net, opts: { guard?: boolean } = {}): ExtremeDecider {
  const guard = opts.guard ?? true;
  return (view, _rng, mem) => {
    let mask = legalMask(view);
    if (view.phase === 'initialFlip') mem.stall = undefined; // a new round or a rematch
    else if (guard && stalled(view, mem)) mask = progressOnly(view, mask);
    const index = argmaxLegal(forward(net, encodeView(view, mem)).logits, mask);
    if (index < 0) throw new Error(`extreme bot has no legal action in phase ${view.phase}`);
    return decodeAction(index, view);
  };
}
