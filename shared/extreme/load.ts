// Server side only: loads the net weights (about 2 MB) and registers the extreme bot with `decide`.
// The client never imports this module, so the weights stay out of the browser bundle (see client/bundle.test.ts).
import { registerExtreme } from '../bot';
import { loadNet, type Net } from './net';
import { extremeDecider } from './policy';
import weights from './weights.json';

/** Where the weights come from, as written by the export (`--source`). */
export const WEIGHTS_SOURCE: string = weights.source;

/** `source` of the placeholder weights (imitation net, exported in Task 9). The final export uses
 * `--source "ppo <name>"`; any other source counts as the trained weights. */
export const PLACEHOLDER_SOURCE = 'imit.pt placeholder';

/** Placeholder weights are only good enough for wiring and safety tests, not for the strength tests. Exact match. */
export const isPlaceholderSource = (source: string): boolean => source.trim() === PLACEHOLDER_SOURCE;

let net: Net | null = null;

export function extremeNet(): Net {
  net ??= loadNet(weights);
  return net;
}

/** Idempotent; call before the first `decide(view, 'extreme', …)`. */
export function installExtremeBot(): void {
  registerExtreme(extremeDecider(extremeNet()));
}
