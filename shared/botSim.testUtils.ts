// Test-only helper (never imported by app code): whole games with bots only, straight through the rules (no network).
import { canAct, decide, newBotMemory, observe, type BotMemory, type ExtremeDecider } from './bot';
import { apply, newGame, startRound } from './rules';
import { seeded } from './testUtils';
import type { BotLevel, GameState } from './types';
import { viewFor } from './view';

export interface SimOptions {
  target?: number;
  /** A round with more actions than this counts as a stall and throws. */
  roundStepCap?: number;
  /** Per seat: plays this seat with the given decider instead of `decide` (e.g. an extreme bot with test weights). */
  deciders?: (ExtremeDecider | undefined)[];
}

export interface SimResult {
  /** One entry per seat and round. */
  scores: { seat: number; level: BotLevel; score: number }[];
  /** Seats with the lowest final total. */
  winners: number[];
  rounds: number;
  /** Rounds in which an extreme bot's stall guard took over (per seat). */
  forcedRounds: number;
  /** Most actions any round needed. */
  maxRoundSteps: number;
  mems: BotMemory[];
}

export class StallError extends Error {}

export function playGame(levels: BotLevel[], seed: number, opts: SimOptions = {}): SimResult {
  const { target = 100, roundStepCap = 3000, deciders = [] } = opts;
  const rng = seeded(seed);
  const members = levels.map((_, i) => ({ id: `p${i}`, name: `P${i}` }));
  let state: GameState = newGame(members, rng, target);
  const mems = members.map(() => newBotMemory());
  const scores: SimResult['scores'] = [];
  let rounds = 0;
  let forcedRounds = 0;
  let maxRoundSteps = 0;
  let roundSteps = 0;
  for (let steps = 0; steps < 1_000_000; steps++) {
    if (state.phase === 'roundOver' || state.phase === 'gameOver') {
      rounds++;
      maxRoundSteps = Math.max(maxRoundSteps, roundSteps);
      roundSteps = 0;
      forcedRounds += mems.filter((m) => m.stall?.forced && m.stall.round === state.round).length;
      state.players.forEach((p, i) => scores.push({ seat: i, level: levels[i], score: state.lastRound!.scores[p.id] }));
      if (state.phase === 'gameOver') {
        const best = Math.min(...state.players.map((p) => p.total));
        const winners = state.players.flatMap((p, i) => (p.total === best ? [i] : []));
        return { scores, winners, rounds, forcedRounds, maxRoundSteps, mems };
      }
      state = startRound(state, rng);
      continue;
    }
    if (++roundSteps > roundStepCap) throw new StallError(`round ${state.round} exceeded ${roundStepCap} actions (${levels.join(',')}, seed ${seed})`);
    state.players.forEach((p, i) => observe(mems[i], viewFor(state, p.id)));
    let acted = false;
    for (const [i, p] of state.players.entries()) {
      const view = viewFor(state, p.id);
      const custom = deciders[i];
      const action = custom ? (canAct(view) ? custom(view, rng, mems[i]) : null) : decide(view, levels[i], rng, mems[i]);
      if (action) {
        state = apply(state, p.id, action, rng);
        acted = true;
        break;
      }
    }
    if (!acted) throw new Error(`stuck in phase ${state.phase}`);
  }
  throw new Error('game did not finish');
}
