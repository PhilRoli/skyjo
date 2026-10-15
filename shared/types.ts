export type Cell = { value: number; up: boolean } | null;
export type Rng = () => number;

export const GRID_SIZE = 12;
export const COLUMNS = 4;
export const ROWS = 3;
export const WIN_THRESHOLD = 100;
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

export interface RoundResult {
  scores: Record<string, number>;
  doubled: boolean;
  finisher: string | null;
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
  events: GameEvent[];
  eventSeq: number;
}

export type Action =
  | { type: 'flipInitial'; slot: number }
  | { type: 'drawFromDeck' }
  | { type: 'takeDiscard' }
  | { type: 'swap'; slot: number }
  | { type: 'discardDrawn' }
  | { type: 'flipHidden'; slot: number };
