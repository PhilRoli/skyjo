import { describe, expect, it } from 'vitest';
import { decide, newBotMemory } from '../bot';
import { A, D } from './encode';
import { extremeNet, installExtremeBot, isPlaceholderSource, WEIGHTS_SOURCE } from './load';
import { loadNet } from './net';
import weights from './weights.json';

describe('extreme weights', () => {
  it('have the exported schema and a source that says whether they are the trained ones', () => {
    expect(weights.version).toBe(1);
    expect(typeof WEIGHTS_SOURCE).toBe('string');
    expect(WEIGHTS_SOURCE.length).toBeGreaterThan(0);
    const net = extremeNet();
    expect(net.inputSize).toBe(D);
    expect(net.actionSize).toBe(A);
    expect(extremeNet()).toBe(net); // loaded once
  });

  it('the strength gate only reads the source: a re-export with a non-placeholder source switches the strength tests on', () => {
    expect(isPlaceholderSource('imit.pt placeholder')).toBe(true);
    expect(isPlaceholderSource('Placeholder from imitation')).toBe(true);
    expect(isPlaceholderSource('ppo run-3 update 1200')).toBe(false);
    const reexported = { ...weights, source: 'ppo final' };
    expect(isPlaceholderSource(reexported.source)).toBe(false);
    expect(loadNet(reexported).actionSize).toBe(A); // same schema, nothing else to change
  });

  it('installExtremeBot registers the net with decide', () => {
    installExtremeBot();
    installExtremeBot(); // idempotent
    const view = {
      phase: 'initialFlip' as const, round: 1, me: 'a', current: null,
      players: ['a', 'b'].map((id) => ({ id, name: id, left: false, total: 0, grid: Array(12).fill({ up: false, value: null }) })),
      discardTop: 3, deckCount: 100, drawn: null, drawnFrom: null, finisher: null, lastRound: null, winners: [], events: [], eventSeq: 0, target: 100,
    };
    expect(decide(view, 'extreme', () => 0.5, newBotMemory())).toMatchObject({ type: 'flipInitial' });
  });
});
