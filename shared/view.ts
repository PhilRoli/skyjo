import { winners } from './rules';
import type { BotLevel, GameEvent, GameState, Phase, RoundResult } from './types';

export interface PublicCell {
  up: boolean;
  value: number | null;
}

export interface PlayerView {
  phase: Phase;
  round: number;
  me: string;
  current: string | null;
  players: { id: string; name: string; left: boolean; total: number; grid: (PublicCell | null)[] }[];
  discardTop: number | null;
  deckCount: number;
  drawn: number | null;
  drawnFrom: 'deck' | 'discard' | null;
  finisher: string | null;
  lastRound: RoundResult | null;
  winners: string[];
  events: GameEvent[];
  eventSeq: number;
  target: number;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  started: boolean;
  target: number;
  spectatorCount: number;
  /** Remaining nudge cooldown in ms, shared by the whole room. */
  nudgeCooldownMs: number;
  members: {
    id: string;
    name: string;
    connected: boolean;
    left: boolean;
    spectator: boolean;
    wantsToPlay: boolean;
    bot?: { level: BotLevel };
  }[];
}

/** Debug-only: everything the server knows. Only sent when the server runs with DEV_MODE and the player opted in. */
export interface DevInfo {
  grids: Record<string, (number | null)[]>;
  drawn: number | null;
  /** Top card of the draw pile (the next one drawn). */
  next: number | null;
  /** Cards left in the draw pile as value counts (no order, so the next card stays unknown). */
  deck: { value: number; count: number }[];
}

export interface ClientState {
  me: string;
  role: 'player' | 'spectator';
  room: RoomInfo;
  game: PlayerView | null;
  devAllowed?: boolean;
  dev?: DevInfo;
}

export function viewFor(state: GameState, me: string): PlayerView {
  const turnPhase =
    state.phase === 'draw' || state.phase === 'place' || state.phase === 'flipAfterDiscard';
  const currentId = turnPhase ? state.players[state.current].id : null;
  const mine = currentId === me;
  return {
    phase: state.phase,
    round: state.round,
    me,
    current: currentId,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      left: p.left,
      total: p.total,
      grid: p.grid.map((c) => (c ? { up: c.up, value: c.up ? c.value : null } : null)),
    })),
    discardTop: state.discard.at(-1) ?? null,
    deckCount: state.deck.length,
    drawn: mine ? state.drawn : null,
    drawnFrom: mine ? state.drawnFrom : null,
    finisher: state.finisher,
    lastRound: state.lastRound,
    winners: state.phase === 'gameOver' ? winners(state) : [],
    events: state.events,
    eventSeq: state.eventSeq,
    target: state.target,
  };
}

export function devViewFor(state: GameState): DevInfo {
  const counts = new Map<number, number>();
  for (const v of state.deck) counts.set(v, (counts.get(v) ?? 0) + 1);
  return {
    grids: Object.fromEntries(state.players.map((p) => [p.id, p.grid.map((c) => (c ? c.value : null))])),
    drawn: state.drawn,
    next: state.deck.at(-1) ?? null,
    deck: [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => a.value - b.value),
  };
}
