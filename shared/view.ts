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

export interface ClientState {
  me: string;
  role: 'player' | 'spectator';
  room: RoomInfo;
  game: PlayerView | null;
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
