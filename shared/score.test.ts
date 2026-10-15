import { describe, expect, it } from 'vitest';
import { visibleSum } from './score';

describe('visibleSum', () => {
  it('adds only face-up cards and ignores hidden and removed ones', () => {
    expect(
      visibleSum([
        { up: true, value: 12 },
        { up: true, value: -2 },
        { up: false, value: null },
        null,
        { up: true, value: 0 },
      ]),
    ).toBe(10);
  });

  it('is 0 for an all-hidden or empty grid', () => {
    expect(visibleSum([{ up: false, value: null }])).toBe(0);
    expect(visibleSum([])).toBe(0);
  });
});
