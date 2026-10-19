// Samples PlayerView + BotMemory snapshots from real TS games (Stark bots, 2-8 players, targets 50/100/150,
// players removed mid-game, cleared columns, reshuffles) for the extreme-bot port.
// Usage: bun tools/export-extreme-fixtures.ts <samples.json>
// Then (in ~/Development/skyjo-ml) compute vectors/masks/logits and write shared/extreme/fixtures.json:
//   .venv/bin/python -m skyjo.export --ckpt <ckpt.pt> --out <skyjo>/shared/extreme/weights.json \
//       --samples <samples.json> --fixtures <skyjo>/shared/extreme/fixtures.json
// For a re-export of new weights alone, --samples can be omitted (the existing fixtures.json is reused).
import { writeFileSync } from 'node:fs';
import { canAct, decide, newBotMemory, observe, type BotMemory } from '../shared/bot';
import { apply, newGame, removePlayer, startRound } from '../shared/rules';
import { seeded } from '../shared/testUtils';
import type { Action, GameState } from '../shared/types';
import { viewFor } from '../shared/view';

const out = process.argv[2];
if (!out) {
  console.error('usage: bun tools/export-extreme-fixtures.ts <outfile>');
  process.exit(1);
}

const GAMES = 63;
const TARGETS = [50, 100, 150];
const samples: unknown[] = [];

for (let g = 0; g < GAMES; g++) {
  const n = 2 + (g % 7);
  const target = TARGETS[Math.floor(g / 7) % 3];
  const rng = seeded(5000 + g);
  const botRng = seeded(9000 + g);
  const pick = seeded(13000 + g);
  const members = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const mems = new Map<string, BotMemory>(members.map((m) => [m.id, newBotMemory()]));
  let state: GameState = newGame(members, rng, target);
  const observeAll = () => {
    for (const m of members) observe(mems.get(m.id)!, viewFor(state, m.id));
  };
  // every 3rd game with >= 3 players loses a player at a random step
  const removeAt = g % 3 === 0 && n >= 3 ? 20 + Math.floor(pick() * 150) : -1;
  observeAll();
  let prevDeck = state.deck.length;
  let prevClear = 0;
  let steps = 0;
  const sample = (id: string, tag: string) => {
    const v = viewFor(state, id);
    samples.push({
      game: g,
      tag,
      view: {
        phase: v.phase, round: v.round, me: v.me, current: v.current, players: v.players,
        discardTop: v.discardTop, deckCount: v.deckCount, drawn: v.drawn, drawnFrom: v.drawnFrom,
        finisher: v.finisher, eventSeq: v.eventSeq, target: v.target,
      },
      mem: { discard: [...mems.get(id)!.discard] },
    });
  };
  for (let guard = 0; guard < 5000 && state.phase !== 'gameOver'; guard++) {
    if (state.phase === 'roundOver') {
      state = startRound(state, rng);
      observeAll();
      continue;
    }
    if (steps === removeAt) {
      const victim = members[1 + Math.floor(pick() * (n - 1))].id;
      state = removePlayer(state, victim);
      observeAll();
      sample(members[0].id, 'removed');
      if (state.phase === 'gameOver') break;
    }
    let acted = false;
    for (const m of members) {
      const view = viewFor(state, m.id);
      if (!canAct(view)) continue;
      const reshuffled = state.deck.length > prevDeck;
      const cleared = state.events.filter((e) => e.kind === 'clear').length > prevClear;
      const hasLeft = state.players.some((p) => p.left);
      if (reshuffled) sample(m.id, 'reshuffle');
      else if (cleared && pick() < 0.4) sample(m.id, 'clear');
      else if (hasLeft && pick() < 0.1) sample(m.id, 'left');
      else if (pick() < 0.012) sample(m.id, 'plain');
      const action = decide(view, 'hard', botRng, mems.get(m.id)!) as Action;
      prevDeck = state.deck.length;
      prevClear = state.events.filter((e) => e.kind === 'clear').length;
      state = apply(state, m.id, action, rng);
      steps++;
      observeAll();
      // also a view of a random other seat (mostly all-illegal masks; checks encoding from any seat)
      if (pick() < 0.003) sample(members[Math.floor(pick() * n)].id, 'other-seat');
      acted = true;
      break;
    }
    if (!acted) throw new Error(`stuck game ${g}`);
  }
}
writeFileSync(out, JSON.stringify({ samples }));
console.log(`wrote ${samples.length} samples to ${out}`);
