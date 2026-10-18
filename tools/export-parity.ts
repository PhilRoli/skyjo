// Records deterministic full games played by the TS bots, for the Python parity test (skyjo-ml).
// Usage: bun tools/export-parity.ts <outfile>
// RNG streams: the game rng (newGame/startRound/apply) is seeded(seed); the bots get their own
// stream seeded(botSeed = seed + 1_000_003), so Python replay of the rules only needs `seed`.
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { canAct, decide, newBotMemory, observe, type BotMemory } from '../shared/bot';
import { apply, newGame, startRound } from '../shared/rules';
import { seeded } from '../shared/testUtils';
import type { Action, BotLevel, GameState } from '../shared/types';
import { viewFor } from '../shared/view';

const out = process.argv[2];
if (!out) {
  console.error('usage: bun tools/export-parity.ts <outfile>');
  process.exit(1);
}

const GAMES = 210;
const TARGETS = [50, 100, 150];
const LEVELS: BotLevel[] = ['easy', 'normal', 'hard'];

// Cell as two chars: 'xx' removed, else U/d (face up/down) + hex(value + 2).
const enc = (c: { value: number; up: boolean } | null) =>
  c ? (c.up ? 'U' : 'd') + (c.value + 2).toString(16) : 'xx';

const fields = (s: GameState) => ({
  phase: s.phase,
  round: s.round,
  current: s.current,
  grids: s.players.map((p) => p.grid.map(enc).join('')),
  discard: s.discard.map((v) => (v + 2).toString(16)).join(''),
  deckLen: s.deck.length,
  totals: s.players.map((p) => p.total),
  eventSeq: s.eventSeq,
});

// View of every seat at one step. Everything except `me`, `drawn`, `drawnFrom` is identical for all
// seats (masking does not depend on the viewer), so it is stored once (checked here) plus per-seat
// [drawn, drawnFrom]. Grids use 'U'+hex(value+2) face up, 'D_' face down, 'xx' removed.
const encPub = (c: { up: boolean; value: number | null } | null) =>
  c ? (c.up ? 'U' + (c.value! + 2).toString(16) : 'D_') : 'xx';
const viewRec = (state: GameState, ids: string[]) => {
  const shared = (id: string) => {
    const { me: _me, drawn: _d, drawnFrom: _f, players, ...rest } = viewFor(state, id);
    return { ...rest, players: players.map((p) => ({ id: p.id, name: p.name, left: p.left, total: p.total, grid: p.grid.map(encPub).join('') })) };
  };
  const base = JSON.stringify(shared(ids[0]));
  for (const id of ids) if (JSON.stringify(shared(id)) !== base) throw new Error('view differs between seats');
  return { shared: JSON.parse(base), seats: ids.map((id) => { const v = viewFor(state, id); return [v.drawn, v.drawnFrom]; }) };
};

const games = [];
for (let g = 0; g < GAMES; g++) {
  const n = 2 + (g % 7);
  const target = TARGETS[Math.floor(g / 7) % 3];
  const seed = 1000 + g;
  const botSeed = seed + 1_000_003;
  const rng = seeded(seed);
  const botRng = seeded(botSeed);
  const members = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
  const levels = members.map((_, i) => LEVELS[(g + i * 2 + Math.floor(g / 3)) % 3]);
  const mems = new Map<string, BotMemory>(members.map((m) => [m.id, newBotMemory()]));

  let state = newGame(members, rng, target);
  const steps: unknown[] = [];
  const rounds: unknown[] = [];
  const observeAll = () => {
    for (const m of members) observe(mems.get(m.id)!, viewFor(state, m.id));
  };
  observeAll();
  for (let guard = 0; guard < 5000 && state.phase !== 'gameOver'; guard++) {
    if (state.phase === 'roundOver') {
      state = startRound(state, rng);
      steps.push({ player: null, action: { type: 'startRound' }, state: fields(state), view: viewRec(state, members.map((m) => m.id)) });
      observeAll();
      continue;
    }
    let acted = false;
    for (let i = 0; i < members.length; i++) {
      const id = members[i].id;
      const view = viewFor(state, id);
      if (!canAct(view)) continue;
      const action = decide(view, levels[i], botRng, mems.get(id)!) as Action;
      state = apply(state, id, action, rng);
      steps.push({ player: id, action, state: fields(state), view: viewRec(state, members.map((m) => m.id)) });
      if (state.phase === 'roundOver' || state.phase === 'gameOver') {
        rounds.push({ round: state.round, lastRound: state.lastRound, totals: state.players.map((p) => p.total) });
      }
      observeAll();
      acted = true;
      break;
    }
    if (!acted) throw new Error(`stuck game ${g} phase ${state.phase}`);
  }
  if (state.phase !== 'gameOver') throw new Error(`game ${g} did not finish`);
  games.push({ seed, botSeed, target, members, levels, steps, rounds });
}
writeFileSync(out, gzipSync(JSON.stringify({ games })));
console.log(`wrote ${games.length} games to ${out}`);
