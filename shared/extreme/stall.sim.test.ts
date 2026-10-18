import { describe, expect, it } from 'vitest';
import { playGame } from '../botSim';
import type { BotLevel } from '../types';
import { installExtremeBot, WEIGHTS_SOURCE } from './load';

installExtremeBot();

const TARGETS = [50, 100, 150];
const KINDS = ['extreme+hard', 'extreme+extreme', 'extreme+normal', 'extreme+easy'] as const;

/** Game g: 2–8 players, every target, four kinds of tables, and the extreme seats rotate through every position. */
function table(g: number): { levels: BotLevel[]; target: number } {
  const n = 2 + (g % 7);
  const k = Math.floor(g / 7);
  const target = TARGETS[k % 3];
  const kind = KINDS[Math.floor(k / 3) % 4];
  const other: BotLevel = kind === 'extreme+normal' ? 'normal' : kind === 'extreme+easy' ? 'easy' : 'hard';
  const extremes = kind === 'extreme+extreme' ? Math.ceil(n / 2) : 1;
  const first = (k + Math.floor(k / 12)) % n; // decoupled from target and kind
  const levels = Array.from({ length: n }, (_, s): BotLevel => ((s - first + n) % n < extremes ? 'extreme' : other));
  return { levels, target };
}

describe('extreme never stalls', () => {
  it('finishes 504 games (2–8 players, targets 50/100/150, mixed tables, all seats) within 3000 actions per round', () => {
    let rounds = 0;
    let forced = 0;
    let maxRoundSteps = 0;
    for (let g = 0; g < 504; g++) {
      const { levels, target } = table(g);
      const r = playGame(levels, 90_000 + g, { target, roundStepCap: 3000 }); // throws StallError on a hang
      rounds += r.rounds;
      forced += r.forcedRounds;
      maxRoundSteps = Math.max(maxRoundSteps, r.maxRoundSteps);
    }
    console.log(`extreme (${WEIGHTS_SOURCE}): ${rounds} rounds, guard took over in ${forced}, longest round ${maxRoundSteps} actions`);
    expect(rounds).toBeGreaterThan(504);
  }, 600_000);

  it('the table list covers every player count, target, kind and extreme seat', () => {
    const seen = new Set<string>();
    for (let g = 0; g < 504; g++) {
      const { levels, target } = table(g);
      seen.add(`n${levels.length}`).add(`t${target}`);
      levels.forEach((l, s) => l === 'extreme' && seen.add(`seat${s}`));
      seen.add(levels.filter((l) => l === 'extreme').length > 1 ? 'multi' : `with-${levels.find((l) => l !== 'extreme')}`);
    }
    for (let n = 2; n <= 8; n++) expect(seen).toContain(`n${n}`);
    for (const t of TARGETS) expect(seen).toContain(`t${t}`);
    for (let s = 0; s < 8; s++) expect(seen).toContain(`seat${s}`);
    for (const k of ['multi', 'with-hard', 'with-normal', 'with-easy']) expect(seen).toContain(k);
  });
});
