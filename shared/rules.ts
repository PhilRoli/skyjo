import { buildDeck, shuffle } from './deck';
import {
  COLUMNS,
  GRID_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROWS,
  WIN_THRESHOLD,
  type Action,
  type Cell,
  type GameEvent,
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
    events: [],
    eventSeq: 0,
  };
  return startRound(state, rng);
}

export function startRound(prev: GameState, rng: Rng): GameState {
  if (prev.phase === 'gameOver') throw new Error('Das Spiel ist beendet, starte eine Revanche');
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
  state.events = [];
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

function requireTurn(state: GameState, idx: number, phase: GameState['phase']): void {
  if (state.phase !== phase) throw new Error('Jetzt nicht möglich');
  if (state.current !== idx) throw new Error('Du bist nicht dran');
}

function drawCard(state: GameState, rng: Rng): number {
  if (state.deck.length === 0) {
    const top = state.discard.pop();
    state.deck = shuffle(state.discard, rng);
    state.discard = top === undefined ? [] : [top];
  }
  const card = state.deck.pop();
  if (card === undefined) throw new Error('Keine Karten mehr');
  return card;
}

export function clearColumns(grid: Cell[], discard: number[]): { column: number; value: number }[] {
  const cleared: { column: number; value: number }[] = [];
  for (let c = 0; c < COLUMNS; c++) {
    const col = grid.slice(c * ROWS, c * ROWS + ROWS);
    if (col.every((x) => x && x.up && x.value === col[0]!.value)) {
      for (const x of col) discard.push(x!.value);
      for (let r = 0; r < ROWS; r++) grid[c * ROWS + r] = null;
      cleared.push({ column: c, value: col[0]!.value });
    }
  }
  return cleared;
}

const clearEvents = (by: string, cleared: { column: number; value: number }[]): GameEvent[] =>
  cleared.map((c) => ({ kind: 'clear', by, column: c.column, value: c.value }));

const allRevealed = (p: PlayerState): boolean => p.grid.every((c) => c === null || c.up);

function endTurn(state: GameState): GameState {
  const player = state.players[state.current];
  state.events.push(...clearEvents(player.id, clearColumns(player.grid, state.discard)));
  if (state.finisher === null) {
    if (allRevealed(player)) {
      state.finisher = player.id;
      state.pendingFinal = activePlayers(state)
        .filter((p) => p.id !== player.id)
        .map((p) => p.id);
    }
  } else {
    state.pendingFinal = state.pendingFinal.filter((id) => id !== player.id);
  }
  return advance(state);
}

export function advance(state: GameState): GameState {
  if (state.finisher !== null && state.pendingFinal.length === 0) return scoreRound(state);
  const n = state.players.length;
  let next = state.current;
  do {
    next = (next + 1) % n;
  } while (state.players[next].left || state.players[next].id === state.finisher);
  state.current = next;
  state.phase = 'draw';
  return state;
}

export function scoreRound(state: GameState): GameState {
  const act = activePlayers(state);
  const scores: Record<string, number> = {};
  for (const p of act) {
    for (const c of p.grid) if (c) c.up = true;
    state.events.push(...clearEvents(p.id, clearColumns(p.grid, state.discard)));
    scores[p.id] = p.grid.reduce((s, c) => s + (c ? c.value : 0), 0);
  }
  let doubled = false;
  if (state.finisher !== null && scores[state.finisher] !== undefined) {
    const mine = scores[state.finisher];
    const strictlyLowest = act.every((p) => p.id === state.finisher || scores[p.id] > mine);
    if (!strictlyLowest && mine > 0) {
      scores[state.finisher] = mine * 2;
      doubled = true;
    }
  }
  for (const p of act) p.total += scores[p.id];
  state.lastRound = { scores, doubled, finisher: state.finisher };
  state.drawn = null;
  state.drawnFrom = null;
  state.phase = act.some((p) => p.total > WIN_THRESHOLD) ? 'gameOver' : 'roundOver';
  return state;
}

export function apply(prev: GameState, playerId: string, action: Action, rng: Rng): GameState {
  const state = applyAction(structuredClone(prev), playerId, action, rng);
  if (action.type !== 'flipInitial') state.eventSeq += 1;
  return state;
}

function applyAction(state: GameState, playerId: string, action: Action, rng: Rng): GameState {
  const idx = state.players.findIndex((p) => p.id === playerId && !p.left);
  if (idx < 0) throw new Error('Unbekannter Spieler');
  const player = state.players[idx];
  switch (action.type) {
    case 'flipInitial':
      return flipInitial(state, player, action.slot);
    case 'drawFromDeck': {
      requireTurn(state, idx, 'draw');
      state.events = [{ kind: 'draw', by: playerId }];
      state.drawn = drawCard(state, rng);
      state.drawnFrom = 'deck';
      state.phase = 'place';
      return state;
    }
    case 'takeDiscard': {
      requireTurn(state, idx, 'draw');
      const card = state.discard.pop();
      if (card === undefined) throw new Error('Ablagestapel ist leer');
      state.events = [{ kind: 'takeDiscard', by: playerId, value: card }];
      state.drawn = card;
      state.drawnFrom = 'discard';
      state.phase = 'place';
      return state;
    }
    case 'swap': {
      requireTurn(state, idx, 'place');
      checkSlot(action.slot);
      const cell = player.grid[action.slot];
      if (!cell) throw new Error('Dieser Platz ist leer');
      state.events.push({ kind: 'swap', by: playerId, value: state.drawn!, replaced: cell.value });
      state.discard.push(cell.value);
      player.grid[action.slot] = { value: state.drawn!, up: true };
      state.drawn = null;
      state.drawnFrom = null;
      return endTurn(state);
    }
    case 'discardDrawn': {
      requireTurn(state, idx, 'place');
      if (state.drawnFrom !== 'deck') throw new Error('Die Karte von der Ablage musst du tauschen');
      state.events.push({ kind: 'discard', by: playerId, value: state.drawn! });
      state.discard.push(state.drawn!);
      state.drawn = null;
      state.drawnFrom = null;
      if (!player.grid.some((c) => c && !c.up)) return endTurn(state);
      state.phase = 'flipAfterDiscard';
      return state;
    }
    case 'flipHidden': {
      requireTurn(state, idx, 'flipAfterDiscard');
      checkSlot(action.slot);
      const cell = player.grid[action.slot];
      if (!cell || cell.up) throw new Error('Wähle eine verdeckte Karte');
      state.events.push({ kind: 'flip', by: playerId, value: cell.value });
      cell.up = true;
      return endTurn(state);
    }
    default:
      throw new Error('Unbekannte Aktion');
  }
}

export function removePlayer(prev: GameState, playerId: string): GameState {
  const state = structuredClone(prev);
  const idx = state.players.findIndex((p) => p.id === playerId && !p.left);
  if (idx < 0) return state;
  const turnPhase = ['draw', 'place', 'flipAfterDiscard'].includes(state.phase);
  const wasCurrent = turnPhase && state.current === idx;
  state.players[idx].left = true;
  state.pendingFinal = state.pendingFinal.filter((id) => id !== playerId);
  if (activePlayers(state).length < 2) {
    state.phase = 'gameOver';
    state.drawn = null;
    state.drawnFrom = null;
    return state;
  }
  if (state.phase === 'roundOver' || state.phase === 'gameOver') return state;
  if (state.phase === 'initialFlip') return maybeFinishInitial(state);
  if (wasCurrent) {
    if (state.drawn !== null) {
      state.discard.push(state.drawn);
      state.drawn = null;
      state.drawnFrom = null;
    }
    return advance(state);
  }
  if (state.finisher !== null && state.pendingFinal.length === 0) return scoreRound(state);
  return state;
}

export function winners(state: GameState): string[] {
  const act = activePlayers(state);
  const best = Math.min(...act.map((p) => p.total));
  return act.filter((p) => p.total === best).map((p) => p.id);
}
