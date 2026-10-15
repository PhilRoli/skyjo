import { buildDeck, shuffle } from './deck';
import {
  GRID_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Action,
  type GameState,
  type PlayerState,
  type Rng,
} from './types';

export const activePlayers = (state: GameState): PlayerState[] =>
  state.players.filter((p) => !p.left);

export const upCount = (player: PlayerState): number =>
  player.grid.filter((c) => c?.up).length;

export function newGame(members: { id: string; name: string }[], rng: Rng): GameState {
  if (members.length < MIN_PLAYERS || members.length > MAX_PLAYERS) {
    throw new Error('2 bis 8 Spieler erforderlich');
  }
  const state: GameState = {
    phase: 'initialFlip',
    round: 0,
    players: members.map((m) => ({ id: m.id, name: m.name, grid: [], total: 0, left: false })),
    deck: [],
    discard: [],
    current: 0,
    drawn: null,
    drawnFrom: null,
    finisher: null,
    pendingFinal: [],
    initialDone: [],
    lastRound: null,
  };
  return startRound(state, rng);
}

export function startRound(prev: GameState, rng: Rng): GameState {
  if (prev.round > 0 && prev.phase !== 'roundOver') throw new Error('Runde läuft noch');
  const state = structuredClone(prev);
  const deck = shuffle(buildDeck(), rng);
  for (const p of state.players) {
    p.grid = p.left ? [] : deck.splice(0, GRID_SIZE).map((value) => ({ value, up: false }));
  }
  state.discard = [deck.pop()!];
  state.deck = deck;
  state.round += 1;
  state.phase = 'initialFlip';
  state.current = 0;
  state.drawn = null;
  state.drawnFrom = null;
  state.finisher = null;
  state.pendingFinal = [];
  state.initialDone = [];
  state.lastRound = null;
  return state;
}

function checkSlot(slot: unknown): asserts slot is number {
  if (!Number.isInteger(slot) || (slot as number) < 0 || (slot as number) >= GRID_SIZE) {
    throw new Error('Ungültiger Platz');
  }
}

function flipInitial(state: GameState, player: PlayerState, slot: unknown): GameState {
  if (state.phase !== 'initialFlip') throw new Error('Jetzt nicht möglich');
  checkSlot(slot);
  const cell = player.grid[slot];
  if (!cell || cell.up) throw new Error('Karte ist bereits aufgedeckt');
  if (upCount(player) >= 2) throw new Error('Du hast schon 2 Karten aufgedeckt');
  cell.up = true;
  if (upCount(player) === 2) state.initialDone.push(player.id);
  return maybeFinishInitial(state);
}

export function maybeFinishInitial(state: GameState): GameState {
  const act = activePlayers(state);
  if (!act.every((p) => upCount(p) >= 2)) return state;
  const sum = (p: PlayerState) => p.grid.reduce((s, c) => s + (c?.up ? c.value : 0), 0);
  const ranked = [...act].sort(
    (a, b) => sum(b) - sum(a) || state.initialDone.indexOf(a.id) - state.initialDone.indexOf(b.id),
  );
  state.current = state.players.indexOf(ranked[0]);
  state.phase = 'draw';
  return state;
}

export function apply(prev: GameState, playerId: string, action: Action, rng: Rng): GameState {
  const state = structuredClone(prev);
  const idx = state.players.findIndex((p) => p.id === playerId && !p.left);
  if (idx < 0) throw new Error('Unbekannter Spieler');
  const player = state.players[idx];
  switch (action.type) {
    case 'flipInitial':
      return flipInitial(state, player, action.slot);
    default:
      throw new Error('Unbekannte Aktion');
  }
}
