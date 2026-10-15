import { describe, expect, it } from 'vitest';
import { buildDeck, shuffle } from './deck';
import { cardColor } from './colors';
import { seeded } from './testUtils';

describe('buildDeck', () => {
  it('has 150 cards with the right distribution', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(150);
    const count = (v: number) => deck.filter((c) => c === v).length;
    expect(count(-2)).toBe(5);
    expect(count(-1)).toBe(10);
    expect(count(0)).toBe(15);
    for (let v = 1; v <= 12; v++) expect(count(v)).toBe(10);
  });
});

describe('shuffle', () => {
  it('returns a permutation and does not mutate the input', () => {
    const input = buildDeck();
    const copy = [...input];
    const out = shuffle(input, seeded(3));
    expect(input).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
    expect(out).not.toEqual(input);
  });
});

describe('cardColor', () => {
  it('maps values to the rule colors', () => {
    expect([12, 10].map(cardColor)).toEqual(['red', 'red']);
    expect([9, 5].map(cardColor)).toEqual(['yellow', 'yellow']);
    expect([4, 1].map(cardColor)).toEqual(['green', 'green']);
    expect(cardColor(0)).toBe('lightblue');
    expect([-1, -2].map(cardColor)).toEqual(['darkblue', 'darkblue']);
  });
});
