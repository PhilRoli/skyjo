import { beforeEach, describe, expect, it } from 'vitest';
import { extremeFallbackCount, resetExtremeFallback } from './bot';
import { playGame } from './botSim.testUtils';
import { installExtremeBot, isPlaceholderSource, WEIGHTS_SOURCE } from './extreme/load';
import type { BotLevel } from './types';

installExtremeBot();

const POOL: BotLevel[] = ['easy', 'normal', 'hard', 'extreme'];
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** All orders of the given seats: a bot's result must not depend on who sits before it (the next player sees its discards). */
function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

function pointsPerRound(orders: BotLevel[][], games: number, seed: number): Partial<Record<BotLevel, number>> {
  const per: Partial<Record<BotLevel, number[]>> = {};
  for (let g = 0; g < games; g++) {
    for (const s of playGame(orders[g % orders.length], seed + g).scores) (per[s.level] ??= []).push(s.score);
  }
  return Object.fromEntries(Object.entries(per).map(([l, xs]) => [l, mean(xs)]));
}

// The strength of the extreme bot depends on the trained weights. shared/extreme/weights.json may still hold the
// placeholder from the imitation net (its `source` says so); then the numbers are only logged and the assertions are
// skipped. Re-exporting the trained weights with a non-placeholder source switches these assertions on by itself.
const PLACEHOLDER = isPlaceholderSource(WEIGHTS_SOURCE);
const GATE_NOTE = `weights.json is a placeholder ("${WEIGHTS_SOURCE}"): strength not asserted`;
/** Win share above the fair share 1/n that the extreme bot must reach against hard bots. */
const DUEL_MARGIN = 0.2;

describe('bot simulation', () => {
  // Every extreme move must come from the net: a silent fallback to hard would fake the results.
  beforeEach(() => resetExtremeFallback());
  const noFallback = () => expect(extremeFallbackCount(), 'extreme moves played by the hard fallback').toBe(0);

  it('never makes an illegal move and always finishes the game', () => {
    for (let g = 0; g < 60; g++) {
      const count = 2 + (g % 3);
      const levels = Array.from({ length: count }, (_, i) => POOL[(g + i * 3) % 4]);
      expect(() => playGame(levels, 500 + g)).not.toThrow();
    }
    noFallback();
  }, 120_000);

  it('plays better the higher the level: hard < normal < easy (average points per round)', () => {
    const m = pointsPerRound(permutations<BotLevel>(['easy', 'normal', 'hard']), 180, 1000);
    console.log('average points per round', m);
    expect(m.easy!).toBeGreaterThan(30); // easy is tuned to about 35 points per round
    expect(m.easy!).toBeLessThan(40);
    expect(m.normal!).toBeLessThan(m.easy! * 0.9);
    expect(m.hard!).toBeLessThan(m.normal! * 0.92);
  }, 180_000);

  it('extreme scores at least 10 % fewer points per round than hard (extreme + hard + normal)', (ctx) => {
    const m = pointsPerRound(permutations<BotLevel>(['extreme', 'hard', 'normal']), 120, 3000);
    console.log(`average points per round (weights: ${WEIGHTS_SOURCE})`, m);
    noFallback();
    if (PLACEHOLDER) ctx.skip(GATE_NOTE);
    expect(m.extreme!).toBeLessThan(m.hard! * 0.9);
  }, 180_000);

  it(`extreme wins clearly more than its fair share against hard bots (2, 3, 4 players, margin ${DUEL_MARGIN})`, (ctx) => {
    const rates: Record<number, number> = {};
    for (const n of [2, 3, 4]) {
      let wins = 0;
      const games = 120;
      for (let g = 0; g < games; g++) {
        const levels: BotLevel[] = Array.from({ length: n }, (_, i) => (i === g % n ? 'extreme' : 'hard')); // every seat
        const r = playGame(levels, 5000 + n * 1000 + g);
        if (r.winners.includes(g % n)) wins += 1 / r.winners.length; // a shared win counts in part
      }
      rates[n] = wins / games;
    }
    console.log(`extreme win share against hard (weights: ${WEIGHTS_SOURCE})`, rates);
    noFallback();
    if (PLACEHOLDER) ctx.skip(GATE_NOTE);
    for (const n of [2, 3, 4]) expect(rates[n]).toBeGreaterThan(1 / n + DUEL_MARGIN);
  }, 300_000);
});
