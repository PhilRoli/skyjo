import { afterEach, describe, expect, it } from 'vitest';
import { connectBot, waitFor, type Bot } from './bot';
import { freePort, startServer, tempDataDir, type RunningServer } from './server';

let server: RunningServer | null = null;
const bots: Bot[] = [];

afterEach(async () => {
  bots.forEach((b) => b.socket.close());
  bots.length = 0;
  await server?.stop();
  server = null;
});

async function setup(playerCount: number, target = 50) {
  const port = await freePort();
  const dataDir = tempDataDir();
  server = await startServer(port, dataDir);
  for (let i = 0; i < playerCount; i++) bots.push(connectBot(server.url, `Bot${i + 1}`));
  const host = bots[0];
  const created = await host.request('room:create', { name: host.name });
  host.session = { code: created.code, token: created.token };
  for (const b of bots.slice(1)) {
    const joined = await b.request('room:join', { code: created.code, name: b.name });
    b.session = { code: joined.code, token: joined.token };
  }
  expect((await host.request('room:settings', { target })).ok).toBe(true);
  return { host, port, dataDir };
}

const gameOver = (bot: Bot) => bot.last()?.game?.phase === 'gameOver';

function expectNoHiddenValueLeaked(bot: Bot) {
  for (const st of bot.states) {
    for (const p of st.game?.players ?? []) {
      for (const c of p.grid) if (c && !c.up) expect(c.value).toBeNull();
    }
  }
}

describe('full game against the real server process', () => {
  it('plays to the end with consistent scores and no leaked cards', async () => {
    const { host } = await setup(4);
    expect((await host.request('game:start')).ok).toBe(true);
    await waitFor(() => gameOver(host), 60_000, 'game over');

    const final = host.last()!.game!;
    expect(final.winners.length).toBeGreaterThan(0);

    // Totals must equal the sum of the round scores we saw, and the game must only end above the target.
    const perRound = new Map<number, Record<string, number>>();
    for (const st of host.states) {
      const g = st.game;
      if (g && (g.phase === 'roundOver' || g.phase === 'gameOver') && g.lastRound) perRound.set(g.round, g.lastRound.scores);
    }
    for (const p of final.players) {
      const sum = [...perRound.values()].reduce((s, scores) => s + (scores[p.id] ?? 0), 0);
      expect(p.total).toBe(sum);
    }
    expect(Math.max(...final.players.map((p) => p.total))).toBeGreaterThan(50);
    const lastRoundNo = Math.max(...perRound.keys());
    for (const p of final.players) {
      const before = [...perRound.entries()].filter(([r]) => r < lastRoundNo).reduce((s, [, sc]) => s + (sc[p.id] ?? 0), 0);
      expect(before).toBeLessThanOrEqual(50);
    }
    bots.forEach(expectNoHiddenValueLeaked);
  });

  it('lets a spectator watch a whole game and play the rematch', async () => {
    const { host } = await setup(2);
    expect((await host.request('game:start')).ok).toBe(true);

    const spec = connectBot(server!.url, 'Zoe');
    bots.push(spec);
    const joined = await spec.request('room:join', { code: host.session!.code, name: 'Zoe' });
    expect(joined.role).toBe('spectator');
    spec.session = { code: joined.code, token: joined.token };

    await waitFor(() => gameOver(host), 60_000, 'game over');
    await waitFor(() => gameOver(spec), 5_000, 'spectator sees game over');
    for (const st of spec.states) {
      expect(st.role).toBe('spectator');
      for (const p of st.game?.players ?? []) for (const c of p.grid) if (c && !c.up) expect(c.value).toBeNull();
    }

    expect((await spec.request('room:play')).wantsToPlay).toBe(true);
    expect((await host.request('game:rematch')).ok).toBe(true);
    await waitFor(() => spec.last()?.role === 'player', 5_000, 'spectator became a player');
    expect(spec.last()!.game!.players.map((p) => p.name)).toContain('Zoe');

    // The new game (now with 3 players) is played to the end by the bots.
    await waitFor(() => gameOver(host) && host.last()!.game!.players.length === 3, 60_000, 'second game over');
  });

  it('plays a full game against server bots, also across a restart', async () => {
    const { host, port, dataDir } = await setup(1);
    expect((await host.request('room:addBot', { level: 'normal' })).ok).toBe(true);
    expect((await host.request('room:addBot', { level: 'hard' })).ok).toBe(true);
    expect((await host.request('room:addBot', { level: 'extreme' })).ok).toBe(true); // restored from rooms.json after the restart
    expect((await host.request('game:start')).ok).toBe(true);

    await waitFor(() => (host.last()?.game?.eventSeq ?? 0) >= 12, 30_000, 'some turns');
    expect(host.last()!.game!.phase).not.toBe('gameOver');

    await server!.stop();
    server = await startServer(port, dataDir);
    await waitFor(() => host.last()?.room.members.find((m) => !m.bot)?.connected, 20_000, 'host reconnected');
    await waitFor(() => gameOver(host), 60_000, 'game over after the restart');

    const botIds = host.last()!.room.members.filter((m) => m.bot).map((m) => m.id);
    expect(botIds).toHaveLength(3);
    for (const id of botIds) expect(host.states.some((s) => s.game?.events.some((e) => e.by === id))).toBe(true);
    expect(host.last()!.game!.players).toHaveLength(4);
    expect(host.last()!.game!.winners.length).toBeGreaterThan(0);
    bots.forEach(expectNoHiddenValueLeaked);
  });

  it('keeps a running game alive across a server restart', async () => {
    const { host, port, dataDir } = await setup(4);
    await host.request('game:start');
    await waitFor(() => (host.last()?.game?.eventSeq ?? 0) >= 8, 30_000, 'a few turns');
    const before = host.last()!.game!;
    expect(before.phase).not.toBe('gameOver');

    await server!.stop();
    server = await startServer(port, dataDir);

    // The bots reconnect on their own and rejoin; the game carries on from where it was.
    await waitFor(() => host.last()?.room.members.every((m) => m.connected), 20_000, 'everyone reconnected');
    const after = host.last()!.game!;
    expect(after.round).toBeGreaterThanOrEqual(before.round);
    expect(after.eventSeq).toBeGreaterThanOrEqual(before.eventSeq);
    await waitFor(() => gameOver(host), 60_000, 'game over after restart');
    expect(host.last()!.game!.winners.length).toBeGreaterThan(0);
    bots.forEach(expectNoHiddenValueLeaked);
  });
});
