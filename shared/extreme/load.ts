// Server side only: loads the net weights (about 2 MB) and registers the extreme bot with `decide`.
// The client never imports this module, so the weights stay out of the browser bundle (see client/bundle.test.ts).
import { registerExtreme } from '../bot';
import { loadNet, type Net } from './net';
import { extremeDecider } from './policy';
import weights from './weights.json';

/** Where the weights come from, as written by the export (`--source`). */
export const WEIGHTS_SOURCE: string = weights.source;

/** Placeholder weights are only good enough for wiring and safety tests, not for the strength tests. */
export const isPlaceholderSource = (source: string): boolean => /placeholder/i.test(source);

let net: Net | null = null;

export function extremeNet(): Net {
  net ??= loadNet(weights);
  return net;
}

/** Idempotent; call before the first `decide(view, 'extreme', …)`. */
export function installExtremeBot(): void {
  registerExtreme(extremeDecider(extremeNet()));
}
