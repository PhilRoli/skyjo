import type { PublicCell } from './view';

/** Sum of the face-up cards in a grid (what everyone can currently see). */
export function visibleSum(grid: (PublicCell | null)[]): number {
  return grid.reduce((sum, c) => sum + (c?.up && c.value !== null ? c.value : 0), 0);
}
