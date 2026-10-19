import type { BotMemory } from '../bot';
import type { PlayerView } from '../view';
import fixturesJson from './fixtures.json';

export interface Fixture {
  tag: string;
  view: PlayerView;
  mem: BotMemory;
  x: Float32Array;
  mask: boolean[];
  logits: number[];
}

/** Reference cases made by `python -m skyjo.export` (see tools/export-extreme-fixtures.ts). */
export const fixtures: Fixture[] = (fixturesJson as any).cases.map((c: any) => {
  const x = new Float32Array((fixturesJson as any).inputSize);
  for (const [i, v] of c.x) x[i] = v;
  return {
    tag: c.tag,
    view: { ...c.view, lastRound: null, winners: [], events: [] } as PlayerView,
    mem: { round: 0, seq: 0, deckCount: 0, discard: c.mem.discard, prevEvents: [] },
    x,
    mask: c.mask.map((m: number) => m === 1),
    logits: c.logits,
  };
});
