import type { Rng } from './types';

export function buildDeck(): number[] {
  const deck: number[] = [];
  const add = (value: number, n: number) => {
    for (let i = 0; i < n; i++) deck.push(value);
  };
  add(-2, 5);
  add(-1, 10);
  add(0, 15);
  for (let v = 1; v <= 12; v++) add(v, 10);
  return deck;
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
