import { describe, expect, it } from 'vitest';
import { decide, newBotMemory } from '../bot';
import { A, D } from './encode';
import { RELEASE_NOTES } from '../releaseNotes';
import { extremeNet, installExtremeBot, isPlaceholderSource, PLACEHOLDER_SOURCE, WEIGHTS_SOURCE } from './load';
import { loadNet } from './net';
import weights from './weights.json';

/** First release that ships the extreme bot. */
const EXTREME_RELEASE = '1.8.0';
const versionAtLeast = (v: string, min: string): boolean => {
  const [a, b] = [v, min].map((x) => x.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

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

  it('isPlaceholderSource matches exactly the placeholder source and nothing else', () => {
    expect(PLACEHOLDER_SOURCE).toBe('imit.pt placeholder');
    expect(isPlaceholderSource(PLACEHOLDER_SOURCE)).toBe(true);
    expect(isPlaceholderSource(' imit.pt placeholder\n')).toBe(true);
    expect(isPlaceholderSource('ppo final (replaces placeholder)')).toBe(false);
    expect(isPlaceholderSource('ppo run-3 update 1200')).toBe(false);
    expect(isPlaceholderSource('')).toBe(false);
  });

  it('semver compare for the release gate', () => {
    expect(versionAtLeast('1.8.0', EXTREME_RELEASE)).toBe(true);
    expect(versionAtLeast('1.8.1', EXTREME_RELEASE)).toBe(true);
    expect(versionAtLeast('1.10.0', EXTREME_RELEASE)).toBe(true);
    expect(versionAtLeast('2.0.0', EXTREME_RELEASE)).toBe(true);
    expect(versionAtLeast('1.7.9', EXTREME_RELEASE)).toBe(false);
    expect(versionAtLeast('0.9.0', EXTREME_RELEASE)).toBe(false);
  });

  it('release gate: no release from 1.8.0 on (Extrem) with the placeholder weights', () => {
    // Intentionally RED on feature/extreme-bot until the final PPO weights are exported. Then it turns green by itself.
    const blocked = isPlaceholderSource(WEIGHTS_SOURCE) && versionAtLeast(RELEASE_NOTES[0].version, EXTREME_RELEASE);
    expect(
      blocked,
      'final trained weights must be exported before releasing ' + RELEASE_NOTES[0].version + ' (Extrem ships since ' + EXTREME_RELEASE + ') (weights.json still has source "' +
        WEIGHTS_SOURCE +
        '"): in ~/Development/skyjo-ml run `.venv/bin/python -m skyjo.export --ckpt <final.pt> ' +
        '--out ~/Development/skyjo/shared/extreme/weights.json --fixtures ~/Development/skyjo/shared/extreme/fixtures.json ' +
        '--source "ppo <name>"`, then `bunx vitest run` (the strength tests in shared/bot.sim.test.ts must pass)',
    ).toBe(false);
  });

  it('the strength gate only reads the source: a re-export with a non-placeholder source switches the strength tests on', () => {
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
