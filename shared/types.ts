export type Cell = { value: number; up: boolean } | null;
export type Rng = () => number;

export const GRID_SIZE = 12;
export const COLUMNS = 4;
export const ROWS = 3;
export const DEFAULT_TARGET = 100;
export type BotLevel = 'easy' | 'normal' | 'hard';
export const BOT_LEVELS: BotLevel[] = ['easy', 'normal', 'hard'];
export const ALLOWED_TARGETS = [50, 100, 150];
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export type Phase =
  | 'initialFlip'
  | 'draw'
  | 'place'
  | 'flipAfterDiscard'
  | 'roundOver'
  | 'gameOver';

export interface PlayerState {
  id: string;
  name: string;
  grid: Cell[];
  total: number;
  left: boolean;
}

/**
 * Public state of one player at a point in the round: face-up sum, number of hidden cards and the
 * lowest/highest total still possible given the cards not yet seen anywhere.
 */
export type TracePoint = Record<string, { sum: number; hidden: number; min: number; max: number }>;

export interface RoundResult {
  scores: Record<string, number>;
  doubled: boolean;
  finisher: string | null;
  /** Course of the round, one point per finished turn. Missing in rounds saved before 1.4.0. */
  trace?: TracePoint[];
}

export type GameEvent =
  | { kind: 'draw'; by: string }
  | { kind: 'takeDiscard'; by: string; value: number }
  | { kind: 'swap'; by: string; value: number; replaced: number }
  | { kind: 'discard'; by: string; value: number }
  | { kind: 'flip'; by: string; value: number }
  | { kind: 'clear'; by: string; column: number; value: number };

export interface GameState {
  phase: Phase;
  round: number;
  players: PlayerState[];
  deck: number[];
  discard: number[];
  current: number;
  drawn: number | null;
  drawnFrom: 'deck' | 'discard' | null;
  finisher: string | null;
  pendingFinal: string[];
  initialDone: string[];
  lastRound: RoundResult | null;
  /** Trace of the running round. Missing in games saved before 1.4.0. */
  trace?: TracePoint[];
  events: GameEvent[];
  eventSeq: number;
  /** The game ends once a total exceeds this value. */
  target: number;
}

export type Action =
  | { type: 'flipInitial'; slot: number }
  | { type: 'drawFromDeck' }
  | { type: 'takeDiscard' }
  | { type: 'swap'; slot: number }
  | { type: 'discardDrawn' }
  | { type: 'flipHidden'; slot: number };

export interface ChatMessage {
  id: string;
  from: string;
  name: string;
  text: string;
  at: number;
}
