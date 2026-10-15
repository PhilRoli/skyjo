export type CardColor = 'red' | 'yellow' | 'green' | 'lightblue' | 'darkblue';

export function cardColor(value: number): CardColor {
  if (value >= 10) return 'red';
  if (value >= 5) return 'yellow';
  if (value >= 1) return 'green';
  if (value === 0) return 'lightblue';
  return 'darkblue';
}
