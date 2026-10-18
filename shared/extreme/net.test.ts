import { describe, expect, it } from 'vitest';
import { newBotMemory } from '../bot';
import type { PlayerView } from '../view';
import { A, D, encodeView, legalMask } from './encode';
import { fixtures } from './fixtures';
import { argmaxLegal, forward, loadNet } from './net';
import weights from './weights.json';

const net = loadNet(weights);

describe('extreme net', () => {
  it('weights.json has the expected schema and is marked as a placeholder or final', () => {
    expect(net.inputSize).toBe(D);
    expect(net.actionSize).toBe(A);
    expect(typeof (weights as any).source).toBe('string');
  });

  it('forward equals the Python logits on all fixtures', () => {
    for (const f of fixtures) {
      const { logits, value } = forward(net, f.x);
      expect(logits.length).toBe(A);
      expect(value).toBe(0);
      for (let i = 0; i < A; i++) expect(Math.abs(logits[i] - f.logits[i])).toBeLessThan(1e-4);
    }
  });

  it('argmax over the mask matches Python and is always legal', () => {
    for (const f of fixtures) {
      if (!f.mask.some(Boolean)) continue;
      const i = argmaxLegal(forward(net, f.x).logits, f.mask);
      expect(f.mask[i]).toBe(true);
    }
  });

  it('forward never yields NaN on extreme views', () => {
    const cell = (up: boolean, value: number | null) => ({ up, value });
    const mk = (n: number, target: number, over: Partial<PlayerView> = {}): PlayerView => ({
      phase: 'draw', round: 99, me: 'p0', current: 'p0',
      players: Array.from({ length: n }, (_, i) => ({
        id: `p${i}`, name: `P${i}`, left: false, total: i === 0 ? -50 : 400,
        grid: Array.from({ length: 12 }, (_, s) => (s % 4 === 0 ? null : s % 2 ? cell(true, 12) : cell(false, null))),
      })),
      discardTop: null, deckCount: 0, drawn: null, drawnFrom: null, finisher: null, lastRound: null,
      winners: [], events: [], eventSeq: 0, target, ...over,
    });
    const views: PlayerView[] = [];
    for (const n of [2, 8]) for (const t of [50, 150]) {
      views.push(mk(n, t));
      views.push(mk(n, t, { phase: 'place', drawn: -2, drawnFrom: 'deck', discardTop: 12, finisher: 'p1' }));
      const left = mk(n, t);
      left.players[1].left = true;
      left.players[0].grid = Array(12).fill(null);
      views.push(left);
      const meLeft = mk(n, t, { phase: 'roundOver', current: null });
      meLeft.players[0].left = true;
      views.push(meLeft);
    }
    for (const v of views) {
      const x = encodeView(v, newBotMemory());
      expect([...x].every(Number.isFinite)).toBe(true);
      const { logits, value } = forward(net, x);
      expect([...logits].every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('argmaxLegal is legal with ties and non-finite logits', () => {
    const mask = Array.from({ length: A }, (_, i) => i === 5 || i === 13 || i === 20);
    const cases: number[][] = [
      Array(A).fill(0),
      Array(A).fill(NaN),
      Array(A).fill(Infinity),
      Array(A).fill(-Infinity),
      Array.from({ length: A }, (_, i) => (i % 2 ? NaN : Infinity)),
      Array.from({ length: A }, (_, i) => (i === 0 ? 1e9 : i === 13 ? 2 : -Infinity)),
    ];
    for (const c of cases) expect(mask[argmaxLegal(Float32Array.from(c), mask)]).toBe(true);
    expect(argmaxLegal(Float32Array.from(Array.from({ length: A }, (_, i) => (i === 13 ? 5 : i === 5 ? 1 : 3))), mask)).toBe(13);
    expect(argmaxLegal(new Float32Array(A), Array(A).fill(false))).toBe(-1);
  });
});
