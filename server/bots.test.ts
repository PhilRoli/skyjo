import { describe, expect, it } from 'vitest';
import { decide, extremeFallbackCount, newBotMemory, observe, resetExtremeFallback } from '../shared/bot';
import { seeded } from '../shared/testUtils';
import type { BotLevel, Rng } from '../shared/types';
import { BotRunner } from './bots';
import { RoomManager } from './rooms';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, ms = 4000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timeout');
    await sleep(5);
  }
}

function setup(levels: BotLevel[], delayMs = 0, onError: (e: unknown) => void = (e) => { throw e; }) {
  const m = new RoomManager(seeded(3));
  const runner = new BotRunner(m, { delayMs, rng: seeded(9), onError });
  m.onRoomChange = (code) => runner.notify(code);
  const h = m.create('Anna');
  const botIds = levels.map((l) => m.addBot(h.code, h.playerId, l));
  return { m, runner, h, code: h.code, botIds };
}

/** The human: plays like the easy bot, straight through the manager. */
function humanStep(m: RoomManager, code: string, id: string, mem: ReturnType<typeof newBotMemory>, rng: Rng): boolean {
  const view = m.stateFor(code, id).game!;
  observe(mem, view);
  const action = decide(view, 'easy', rng, mem);
  if (action) m.act(code, id, action);
  return !!action;
}

async function playOut(m: RoomManager, code: string, humanId: string) {
  const mem = newBotMemory();
  const rng = seeded(11);
  const end = Date.now() + 20_000;
  for (;;) {
    const g = m.stateFor(code, humanId).game!;
    if (g.phase === 'gameOver') return g;
    if (g.phase === 'roundOver') {
      m.next(code, humanId);
      continue;
    }
    if (!humanStep(m, code, humanId, mem, rng)) await sleep(2);
    if (Date.now() > end) throw new Error('game did not finish');
  }
}

describe('BotRunner', () => {
  it('plays the bots through a whole game next to a human and waits for the host between rounds', async () => {
    const { m, h, code, botIds, runner } = setup(['easy', 'normal', 'hard', 'extreme']);
    resetExtremeFallback();
    const acted = new Set<string>();
    const act = m.act.bind(m);
    m.act = (c: string, id: string, a: unknown) => {
      acted.add(id);
      return act(c, id, a);
    };
    m.start(code, h.playerId);
    const final = await playOut(m, code, h.playerId);
    expect(final.phase).toBe('gameOver');
    expect(final.winners.length).toBeGreaterThan(0);
    for (const id of botIds) expect(acted.has(id)).toBe(true);
    expect(extremeFallbackCount()).toBe(0); // the extreme bot moved through the net
    runner.dispose();
  });

  it('resumes pending bot moves after a restore', async () => {
    const m1 = new RoomManager(seeded(3));
    const h = m1.create('Anna');
    const botId = m1.addBot(h.code, h.playerId, 'extreme');
    m1.start(h.code, h.playerId); // no runner: the bot has not moved yet
    const m2 = new RoomManager(seeded(3));
    const runner = new BotRunner(m2, { delayMs: 0, rng: seeded(9) });
    m2.onRoomChange = (code) => runner.notify(code);
    m2.restore(JSON.parse(JSON.stringify(m1.snapshot())));
    runner.resumeAll();
    await until(() => (m2.stateFor(h.code, h.playerId).game!.players.find((p) => p.id === botId)!.grid.filter((c) => c?.up).length ?? 0) >= 2);
    runner.dispose();
  });

  it('does not act or throw after the room was deleted or the runner disposed', async () => {
    const errors: unknown[] = [];
    const { m, h, code, runner } = setup(['easy'], 30, (e) => errors.push(e));
    m.start(code, h.playerId);
    m.leave(code, h.playerId); // last human leaves: room is gone, timers are still pending
    await sleep(120);
    expect(errors).toEqual([]);
    const second = setup(['easy'], 30, (e) => errors.push(e));
    second.m.start(second.code, second.h.playerId);
    second.runner.dispose();
    await sleep(120);
    expect(errors).toEqual([]);
    runner.dispose();
  });

  it('calls onActed with the room code after every successful bot move', async () => {
    const m = new RoomManager(seeded(3));
    const acted: string[] = [];
    const runner = new BotRunner(m, { delayMs: 0, rng: seeded(9), onActed: (code) => acted.push(code) });
    m.onRoomChange = (code) => runner.notify(code);
    const h = m.create('Anna');
    m.addBot(h.code, h.playerId, 'easy');
    m.start(h.code, h.playerId);
    await until(() => acted.length >= 2); // the bot's two initial flips
    expect(new Set(acted)).toEqual(new Set([h.code]));
    runner.dispose();
  });

  it('prune forgets the memories and timers of rooms that no longer exist', async () => {
    let t = 0;
    const m = new RoomManager(seeded(3), () => t);
    const runner = new BotRunner(m, { delayMs: 60_000, rng: seeded(9) });
    m.onRoomChange = (code) => runner.notify(code);
    const h = m.create('Anna');
    m.addBot(h.code, h.playerId, 'easy');
    m.start(h.code, h.playerId);
    expect(runner.tracked).toBeGreaterThan(0);
    m.setConnected(h.code, h.playerId, false);
    t = 3 * 3600 * 1000;
    expect(m.sweep()).toBe(1);
    runner.prune();
    expect(runner.tracked).toBe(0);
    runner.dispose();
  });

  it('reports an unexpected failure inside a bot timer instead of crashing the process', async () => {
    const errors: unknown[] = [];
    const { m, h, code, runner } = setup(['easy'], 20, (e) => errors.push(e));
    m.start(code, h.playerId); // schedules the bot's first flip
    m.botViews = () => {
      throw new Error('boom');
    };
    await until(() => errors.length > 0);
    expect((errors[0] as Error).message).toBe('boom');
    runner.dispose();
  });

  it('reports a bot error instead of throwing', async () => {
    const errors: unknown[] = [];
    const { m, h, code, runner } = setup(['easy'], 0, (e) => errors.push(e));
    const act = m.act.bind(m);
    m.act = (c: string, id: string, a: unknown) => {
      if (id.startsWith('bot-')) throw new Error('nope');
      return act(c, id, a);
    };
    m.start(code, h.playerId);
    await until(() => errors.length > 0);
    expect((errors[0] as Error).message).toBe('nope');
    runner.dispose();
  });
});
