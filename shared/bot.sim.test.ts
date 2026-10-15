import { describe, expect, it } from 'vitest';
import { newBotMemory, decide, observe, type BotMemory } from './bot';
import { apply, newGame, startRound } from './rules';
import { seeded } from './testUtils';
import type { BotLevel, GameState } from './types';
import { viewFor } from './view';

/** Plays a whole game with bots only, straight through the rules (no network). */
function playGame(levels: BotLevel[], seed: number, target = 100) {
  const rng = seeded(seed);
  const members = levels.map((_, i) => ({ id: `p${i}`, name: `P${i}` }));
  let state: GameState = newGame(members, rng, target);
  const mem = new Map<string, BotMemory>(members.map((m) => [m.id, newBotMemory()]));
  const scores: { level: BotLevel; score: number }[] = [];
  for (let steps = 0; steps < 100_000; steps++) {
    if (state.phase === 'roundOver' || state.phase === 'gameOver') {
      state.players.forEach((p, i) => scores.push({ level: levels[i], score: state.lastRound!.scores[p.id] }));
      if (state.phase === 'gameOver') return scores;
      state = startRound(state, rng);
      continue;
    }
    for (const p of state.players) observe(mem.get(p.id)!, viewFor(state, p.id));
    let acted = false;
    for (const [i, p] of state.players.entries()) {
      const action = decide(viewFor(state, p.id), levels[i], rng, mem.get(p.id)!);
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

const POOL: BotLevel[] = ['easy', 'normal', 'hard'];
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('bot simulation', () => {
  it('never makes an illegal move and always finishes the game', () => {
    for (let g = 0; g < 60; g++) {
      const count = 2 + (g % 3);
      const levels = Array.from({ length: count }, (_, i) => POOL[(g + i * 2) % 3]);
      expect(() => playGame(levels, 500 + g)).not.toThrow();
    }
  }, 120_000);

  it('plays better the higher the level: hard < normal < easy (average points per round)', () => {
    const per: Record<BotLevel, number[]> = { easy: [], normal: [], hard: [] };
    // All six seat orders, equally often: a bot's result must not depend on who sits before it
    // (the next player sees its discards).
    const orders: BotLevel[][] = [
      ['easy', 'normal', 'hard'],
      ['easy', 'hard', 'normal'],
      ['normal', 'easy', 'hard'],
      ['normal', 'hard', 'easy'],
      ['hard', 'easy', 'normal'],
      ['hard', 'normal', 'easy'],
    ];
    for (let g = 0; g < 180; g++) {
      for (const s of playGame(orders[g % 6], 1000 + g)) per[s.level].push(s.score);
    }
    const m = { easy: mean(per.easy), normal: mean(per.normal), hard: mean(per.hard) };
    console.log('average points per round', m);
    expect(m.normal).toBeLessThan(m.easy * 0.9);
    expect(m.hard).toBeLessThan(m.normal * 0.92);
  }, 180_000);
});
