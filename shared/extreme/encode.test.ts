import { describe, expect, it } from 'vitest';
import { decodeAction, encodeView, legalMask, D, A } from './encode';
import { fixtures } from './fixtures';

describe('extreme encode (Python parity)', () => {
  it('has enough varied fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(200);
    const tags = new Set(fixtures.map((f) => f.tag));
    for (const t of ['plain', 'left', 'reshuffle', 'clear', 'removed']) expect(tags.has(t)).toBe(true);
    const players = new Set(fixtures.map((f) => f.view.players.length));
    expect([...players].sort()).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(fixtures.map((f) => f.view.target))).toEqual(new Set([50, 100, 150]));
  });

  it('encodeView equals the Python vector on all fixtures', () => {
    for (const f of fixtures) {
      const x = encodeView(f.view, f.mem);
      expect(x.length).toBe(D);
      let worst = 0;
      for (let i = 0; i < D; i++) worst = Math.max(worst, Math.abs(x[i] - f.x[i]));
      expect(worst).toBeLessThanOrEqual(1e-6);
    }
  });

  it('legalMask equals the Python mask on all fixtures', () => {
    for (const f of fixtures) expect(legalMask(f.view)).toEqual(f.mask);
  });

  it('decodeAction round-trips every legal index and is accepted by the rules', () => {
    let n = 0;
    for (const f of fixtures) {
      const mask = legalMask(f.view);
      expect(mask.length).toBe(A);
      mask.forEach((legal, i) => {
        if (!legal) return;
        const a = decodeAction(i, f.view);
        n++;
        if (i < 12) expect(a).toEqual({ type: f.view.phase === 'initialFlip' ? 'flipInitial' : 'flipHidden', slot: i });
        else if (i === 12) expect(a).toEqual({ type: 'drawFromDeck' });
        else if (i === 13) expect(a).toEqual({ type: 'takeDiscard' });
        else if (i < 26) expect(a).toEqual({ type: 'swap', slot: i - 14 });
        else expect(a).toEqual({ type: 'discardDrawn' });
      });
    }
    expect(n).toBeGreaterThan(200);
    expect(() => decodeAction(27, fixtures[0].view)).toThrow();
  });
});
