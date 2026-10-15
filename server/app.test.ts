import { mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { createSkyjoServer } from './app';
import { RoomManager } from './rooms';
import { seeded } from '../shared/testUtils';
import type { ClientState } from '../shared/view';

let server: ReturnType<typeof createSkyjoServer>;
let url: string;
const sockets: Socket[] = [];

const serverOpts: { maxSocketsPerIp?: number } = {};

beforeEach(async () => {
  server = createSkyjoServer({ manager: new RoomManager(seeded(7)), ...serverOpts });
  await new Promise<void>((r) => server.httpServer.listen(0, r));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  sockets.forEach((s) => s.close());
  sockets.length = 0;
  await new Promise<void>((r) => server.io.close(() => r()));
});

function client(headers: Record<string, string> = {}) {
  const socket = connect(url, { transports: ['websocket'], forceNew: true, extraHeaders: headers });
  sockets.push(socket);
  let last: ClientState | null = null;
  const waiters: (() => void)[] = [];
  socket.on('state', (s: ClientState) => {
    last = s;
    waiters.splice(0).forEach((w) => w());
  });
  return {
    socket,
    get state() {
      return last;
    },
    request: (event: string, payload: object = {}) =>
      new Promise<any>((resolve) => socket.emit(event, payload, resolve)),
    async until(pred: (s: ClientState) => boolean): Promise<ClientState> {
      const deadline = Date.now() + 2000;
      while (!(last && pred(last))) {
        if (Date.now() > deadline) throw new Error('timeout waiting for state');
        await new Promise<void>((r) => {
          waiters.push(r);
          setTimeout(r, 50);
        });
      }
      return last;
    },
  };
}

async function twoPlayers() {
  const a = client();
  const b = client();
  const created = await a.request('room:create', { name: 'Anna' });
  const joined = await b.request('room:join', { code: created.code, name: 'Ben' });
  await a.until((s) => s.room.members.length === 2);
  return { a, b, created, joined };
}

describe('socket server', () => {
  it('serves a health check', async () => {
    const res = await fetch(`${url}/healthz`);
    expect(await res.text()).toBe('ok');
  });

  it('creates and joins rooms and broadcasts the lobby', async () => {
    const { a, b, created, joined } = await twoPlayers();
    expect(created.ok && joined.ok).toBe(true);
    expect(created.code).toMatch(/^[A-Z2-9]{4}$/);
    const sb = await b.until((s) => s.room.members.length === 2);
    expect(sb.me).toBe(joined.playerId);
    expect(sb.room.hostId).toBe(created.playerId);
    expect(a.state?.game).toBeNull();
  });

  it('only the host can start; both players then get their own view without hidden values', async () => {
    const { a, b } = await twoPlayers();
    expect((await b.request('game:start')).error).toBe('Nur der Host kann das');
    expect((await a.request('game:start')).ok).toBe(true);
    for (const c of [a, b]) {
      const s = await c.until((x) => x.game?.phase === 'initialFlip');
      for (const p of s.game!.players) {
        expect(p.grid.every((cell) => cell === null || cell.up || cell.value === null)).toBe(true);
      }
    }
  });

  it('rejects joining a running game and invalid actions with readable errors', async () => {
    const { a, created } = await twoPlayers();
    await a.request('game:start');
    const late = client();
    const joinedLate = await late.request('room:join', { code: created.code, name: 'Cara' });
    expect(joinedLate.role).toBe('spectator');
    expect((await a.request('game:action', { type: 'drawFromDeck' })).ok).toBe(false);
    expect((await a.request('game:action', {})).error).toBe('Unbekannte Aktion');
    const stranger = client();
    expect((await stranger.request('game:start')).error).toBe('Nicht in einem Raum');
  });

  it('a reload (new socket + token) restores the same view', async () => {
    const { a, b, created, joined } = await twoPlayers();
    await a.request('game:start');
    await a.request('game:action', { type: 'flipInitial', slot: 0 });
    const before = await b.until((s) => s.game?.players[0].grid[0]?.up === true);
    b.socket.close();
    await a.until((s) => s.room.members.find((m) => m.id === joined.playerId)?.connected === false);
    const b2 = client();
    const res = await b2.request('room:rejoin', { code: created.code, token: joined.token });
    expect(res.playerId).toBe(joined.playerId);
    const after = await b2.until((s) => s.game !== null);
    expect(after.me).toBe(before.me);
    expect(after.game?.players).toEqual(before.game?.players);
    await a.until((s) => s.room.members.find((m) => m.id === joined.playerId)?.connected === true);
  });

  it('keeps a player connected while another tab of theirs is still open', async () => {
    const { a, created, joined } = await twoPlayers();
    const tab2 = client();
    await tab2.request('room:rejoin', { code: created.code, token: joined.token });
    tab2.socket.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(a.state?.room.members.find((m) => m.id === joined.playerId)?.connected).toBe(true);
  });
});

describe('robustness and leaving', () => {
  it('survives a client that sends a non-function ack', async () => {
    const a = client();
    a.socket.emit('room:create', { name: 'Anna' }, 'junk');
    a.socket.emit('room:create', { name: 'Anna' }, 42);
    await new Promise((r) => setTimeout(r, 150));
    const b = client();
    expect((await b.request('room:create', { name: 'Ben' })).ok).toBe(true);
  });

  it('room:leave removes the player from the room and stops their updates', async () => {
    const { a, b, created } = await twoPlayers();
    expect((await b.request('room:leave')).ok).toBe(true);
    const s = await a.until((x) => x.room.members.length === 1);
    expect(s.room.members.map((m) => m.name)).toEqual(['Anna']);
    const c = client();
    await c.request('room:join', { code: created.code, name: 'Cara' });
    await a.until((x) => x.room.members.length === 2);
    expect(b.state?.room.members.length).toBe(2);
  });

  it('tells a removed player with a kicked event', async () => {
    const { a, b, joined } = await twoPlayers();
    const kicked = new Promise<void>((resolve) => b.socket.once('kicked', () => resolve()));
    expect((await a.request('room:remove', { targetId: joined.playerId })).ok).toBe(true);
    await kicked;
  });
});

describe('session handling per socket', () => {
  it('a second room event detaches the previous session', async () => {
    const { a, b, created } = await twoPlayers();
    await b.until((s) => s.room.members.length === 2);
    const second = await a.request('room:create', { name: 'Anna2' });
    expect(second.ok).toBe(true);
    const s = await b.until((x) => x.room.members.find((m) => m.id === created.playerId)?.connected === false);
    expect(s.room.code).toBe(created.code);
  });

  it('rate limits room creation per socket', async () => {
    const a = client();
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) results.push((await a.request('room:create', { name: `P${i}` })).ok);
    expect(results).toEqual([true, true, true, true, true, false]);
    expect((await a.request('room:create', { name: 'again' })).error).toBe('Zu viele Räume erstellt');
  });
});

describe('per-IP limits', () => {
  afterEach(() => {
    delete serverOpts.maxSocketsPerIp;
  });

  it('shares the room creation limit across all sockets of one IP', async () => {
    const a = client();
    const b = client();
    const results: boolean[] = [];
    for (let i = 0; i < 3; i++) results.push((await a.request('room:create', { name: `A${i}` })).ok);
    for (let i = 0; i < 3; i++) results.push((await b.request('room:create', { name: `B${i}` })).ok);
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it('counts different forwarded client IPs separately', async () => {
    const a = client({ 'x-forwarded-for': '203.0.113.1' });
    const b = client({ 'x-forwarded-for': '203.0.113.2' });
    for (let i = 0; i < 5; i++) expect((await a.request('room:create', { name: `A${i}` })).ok).toBe(true);
    expect((await a.request('room:create', { name: 'A5' })).ok).toBe(false);
    expect((await b.request('room:create', { name: 'B0' })).ok).toBe(true);
  });

  it('disconnects sockets beyond the per-IP maximum and frees slots on disconnect', async () => {
    await new Promise<void>((r) => server.io.close(() => r()));
    serverOpts.maxSocketsPerIp = 2;
    server = createSkyjoServer({ manager: new RoomManager(seeded(7)), ...serverOpts });
    await new Promise<void>((r) => server.httpServer.listen(0, r));
    url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
    const a = client();
    const b = client();
    await a.request('room:create', { name: 'A' });
    await b.request('room:create', { name: 'B' });
    const c = client();
    await new Promise<void>((resolve) => c.socket.once('disconnect', () => resolve()));
    a.socket.close();
    await new Promise((r) => setTimeout(r, 100));
    const d = client();
    expect((await d.request('room:create', { name: 'D' })).ok).toBe(true);
  });
});

describe('room settings', () => {
  it('the host sets the target score and everyone sees it', async () => {
    const { a, b } = await twoPlayers();
    expect((await b.request('room:settings', { target: 50 })).error).toBe('Nur der Host kann das');
    expect((await a.request('room:settings', { target: 50 })).ok).toBe(true);
    const s = await b.until((x) => x.room.target === 50);
    expect(s.room.target).toBe(50);
  });
});

describe('nudge over sockets', () => {
  it('delivers a nudged event with the sender name to the player whose turn it is', async () => {
    const { a, b, joined, created } = await twoPlayers();
    await a.request('game:start');
    for (const c of [a, b]) {
      await c.request('game:action', { type: 'flipInitial', slot: 0 });
      await c.request('game:action', { type: 'flipInitial', slot: 1 });
    }
    const s = await a.until((x) => x.game?.phase === 'draw');
    const aIsCurrent = s.game!.current === created.playerId;
    const [current, other, otherName] = aIsCurrent ? [a, b, 'Ben'] : [b, a, 'Anna'];
    const got = new Promise<{ from: string }>((resolve) => current.socket.once('nudged', resolve));
    expect((await other.request('game:nudge')).ok).toBe(true);
    expect((await got).from).toBe(otherName);
    expect((await current.request('game:nudge')).error).toBe('Du bist selbst dran');
    expect(joined.playerId).toBeTruthy();
  });
});

describe('static files', () => {
  it('serves the manifest with the right type and falls back to index.html for unknown paths', async () => {
    await new Promise<void>((r) => server.io.close(() => r()));
    const dir = mkdtempSync(path.join(tmpdir(), 'skyjo-static-'));
    writeFileSync(path.join(dir, 'index.html'), '<title>Skyjo</title>');
    writeFileSync(path.join(dir, 'manifest.webmanifest'), '{"name":"Skyjo"}');
    server = createSkyjoServer({ manager: new RoomManager(seeded(7)), staticDir: dir });
    await new Promise<void>((r) => server.httpServer.listen(0, r));
    url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
    const manifest = await fetch(`${url}/manifest.webmanifest`);
    expect(manifest.headers.get('content-type')).toContain('manifest+json');
    expect(await (await fetch(`${url}/some/room/path`)).text()).toBe('<title>Skyjo</title>');
  });
});
