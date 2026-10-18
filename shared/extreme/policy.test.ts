import { describe, expect, it } from 'vitest';
import { newBotMemory } from '../bot';
import { playGame, StallError } from '../botSim.testUtils';
import { seeded } from '../testUtils';
import type { BotLevel } from '../types';
import type { PlayerView, PublicCell } from '../view';
import { A, D, legalMask } from './encode';
import { fixtures } from './fixtures';
import type { Net } from './net';
import { extremeDecider, REPEAT_LIMIT, TURN_LIMIT } from './policy';

/** A one-layer net that ignores the input: the logits are just `bias`. */
function biasNet(bias: number[]): Net {
  return { inputSize: D, actionSize: A, layers: [{ w: new Float64Array(A * D), b: Float64Array.from(bias), inSize: D, outSize: A }] };
}

/** Random weights: the guard and the legality must not depend on what the net learned. */
function randomNet(seed: number): Net {
  const rng = seeded(seed);
  const w = Float64Array.from({ length: A * D }, () => (rng() - 0.5) * 0.4);
  const b = Float64Array.from({ length: A }, () => (rng() - 0.5) * 2);
  return { inputSize: D, actionSize: A, layers: [{ w, b, inSize: D, outSize: A }] };
}

/** The loop seen in training: always take the discard and put it on slot 0, never flip anything. */
const STALLER = biasNet([
  ...Array.from({ length: 12 }, (_, s) => 1 - s * 0.01), // flips
  5, // draw from deck
  10, // take discard
  ...Array.from({ length: 12 }, (_, s) => 3 - s * 0.1), // swap: slot 0 first
  -10, // discard the drawn card
]);

const up = (value: number): PublicCell => ({ up: true, value });
const hid: PublicCell = { up: false, value: null };

function placeView(extra: Partial<PlayerView> = {}): PlayerView {
  return {
    phase: 'place',
    round: 2,
    me: 'me',
    current: 'me',
    players: [
      { id: 'me', name: 'Me', left: false, total: 0, grid: [up(5), ...Array(11).fill(hid)] },
      { id: 'opp', name: 'Opp', left: false, total: 0, grid: [up(7), ...Array(11).fill(hid)] },
    ],
    discardTop: 8,
    deckCount: 80,
    drawn: 3,
    drawnFrom: 'discard',
    finisher: null,
    lastRound: null,
    winners: [],
    events: [],
    eventSeq: 4,
    target: 100,
    ...extra,
  };
}

describe('extreme policy: stall guard', () => {
  it('breaks a forced loop: the same view over and over makes it turn a hidden card up', () => {
    const decide = extremeDecider(STALLER);
    const mem = newBotMemory();
    const view = placeView();
    const actions = Array.from({ length: REPEAT_LIMIT + 2 }, () => decide(view, seeded(1), mem));
    expect(actions[0]).toEqual({ type: 'swap', slot: 0 }); // the net's own choice
    const changed = actions.findIndex((a) => !(a.type === 'swap' && a.slot === 0));
    expect(changed).toBe(REPEAT_LIMIT - 1);
    for (const a of actions.slice(changed)) {
      expect(a.type).toBe('swap');
      expect(view.players[0].grid[(a as { slot: number }).slot]?.up).toBe(false); // a hidden card: progress
      expect(legalMask(view)[14 + (a as { slot: number }).slot]).toBe(true);
    }
  });

  it('forces progress after too many own turns in one round, even without an exact repeat', () => {
    const decide = extremeDecider(STALLER);
    const mem = newBotMemory();
    // A different table every turn: the opponent's first two cards change.
    const table = (t: number, extra: Partial<PlayerView>) => {
      const v = placeView(extra);
      v.players[1].grid = [up((t % 13) - 2), up(Math.floor(t / 13) - 2), ...Array(10).fill(hid)];
      return v;
    };
    for (let t = 0; t <= TURN_LIMIT; t++) {
      expect(decide(table(t, { phase: 'draw', drawn: null, drawnFrom: null }), seeded(t), mem)).toEqual({ type: 'takeDiscard' });
      const a = decide(table(t, {}), seeded(t), mem);
      expect(a).toEqual(t < TURN_LIMIT ? { type: 'swap', slot: 0 } : { type: 'swap', slot: 1 });
    }
    expect(mem.stall?.forced).toBe(true);
  });

  it('with a deck card it may also discard and flip: the restriction keeps that option', () => {
    const net = biasNet([...Array(12).fill(0), 0, 0, ...Array(12).fill(1), 9]); // prefers discarding
    const decide = extremeDecider(net);
    const mem = newBotMemory();
    const view = placeView({ drawnFrom: 'deck' });
    for (let i = 0; i < REPEAT_LIMIT + 1; i++) expect(decide(view, seeded(i), mem)).toEqual({ type: 'discardDrawn' });
  });

  it('starts over in a new round and after the initial flip of a rematch', () => {
    const decide = extremeDecider(STALLER);
    const mem = newBotMemory();
    for (let i = 0; i < REPEAT_LIMIT; i++) decide(placeView(), seeded(i), mem);
    expect(mem.stall?.forced).toBe(true);
    expect(decide(placeView({ round: 3 }), seeded(0), mem)).toEqual({ type: 'swap', slot: 0 });
    expect(mem.stall?.forced).toBe(false);
    for (let i = 0; i < REPEAT_LIMIT; i++) decide(placeView(), seeded(i), mem);
    expect(mem.stall?.forced).toBe(true);
    const flip = placeView({ phase: 'initialFlip', current: null, drawn: null, drawnFrom: null, round: 2 });
    flip.players[0].grid = Array(12).fill(hid);
    expect(decide(flip, seeded(0), mem)).toEqual({ type: 'flipInitial', slot: 0 });
    expect(mem.stall).toBeUndefined();
  });

  it('without the guard the looping net never ends a round (this is what the guard is for)', () => {
    expect(() => playGame(['extreme', 'extreme'], 1, { deciders: [extremeDecider(STALLER, { guard: false }), extremeDecider(STALLER, { guard: false })] })).toThrow(StallError);
  });

  it('with the guard even looping and random nets always finish their games, with every move legal', () => {
    const tables: BotLevel[][] = [
      ['extreme', 'extreme'],
      ['extreme', 'hard'],
      ['hard', 'extreme', 'hard'],
      ['extreme', 'extreme', 'extreme', 'normal'],
      ['easy', 'extreme', 'hard', 'extreme', 'normal', 'hard', 'extreme', 'hard'],
    ];
    let g = 0;
    let forced = 0;
    for (const levels of tables) {
      for (const target of [50, 100, 150]) {
        for (const kind of ['staller', 'random'] as const) {
          g++;
          const deciders = levels.map((l, i) => (l === 'extreme' ? extremeDecider(kind === 'staller' ? STALLER : randomNet(g * 10 + i)) : undefined));
          const r = playGame(levels, 7000 + g, { target, deciders, roundStepCap: 3000 });
          expect(r.rounds).toBeGreaterThan(0);
          if (kind === 'staller') forced += r.forcedRounds;
        }
      }
    }
    expect(forced).toBeGreaterThan(0); // the looping net really needed the guard
  }, 120_000);

  it('only ever picks legal actions, whatever the weights (fixture views)', () => {
    const nets = [STALLER, randomNet(1), randomNet(2), biasNet(Array(A).fill(NaN))];
    for (const net of nets) {
      const decide = extremeDecider(net);
      for (const f of fixtures) {
        if (!f.mask.some(Boolean)) continue;
        const mem = structuredClone(f.mem);
        for (let rep = 0; rep < REPEAT_LIMIT + 1; rep++) {
          const a = decide(f.view, seeded(rep), mem);
          const mask = legalMask(f.view);
          const idx = a.type === 'drawFromDeck' ? 12 : a.type === 'takeDiscard' ? 13 : a.type === 'discardDrawn' ? 26 : a.type === 'swap' ? 14 + a.slot : a.slot;
          expect(mask[idx]).toBe(true);
        }
      }
    }
  });
});
