import { describe, expect, it } from 'vitest';
import { RoomManager } from './rooms';
import { seeded } from '../shared/testUtils';

const mk = (now = () => 0) => new RoomManager(seeded(5), now);

function lobby(names: string[]) {
  const m = mk();
  const host = m.create(names[0]);
  const rest = names.slice(1).map((n) => m.join(host.code, n));
  return { m, code: host.code, host, rest };
}

describe('create / join', () => {
  it('creates a 4 character code and puts the creator in the lobby as host', () => {
    const { m, code, host } = lobby(['Anna']);
    expect(code).toMatch(/^[A-Z2-9]{4}$/);
    const s = m.stateFor(code, host.playerId);
    expect(s.room.hostId).toBe(host.playerId);
    expect(s.room.started).toBe(false);
    expect(s.game).toBeNull();
  });

  it('normalizes the room code and trims names', () => {
    const { m, code } = lobby(['Anna']);
    const j = m.join(`  ${code.toLowerCase()} `, '  Ben  ');
    expect(j.code).toBe(code);
    expect(m.stateFor(code, j.playerId).room.members.map((x) => x.name)).toEqual(['Anna', 'Ben']);
  });

  it('validates names', () => {
    const { m, code } = lobby(['Anna']);
    expect(() => m.create('   ')).toThrow('NAME_LENGTH');
    expect(() => m.join(code, 'x'.repeat(17))).toThrow('NAME_LENGTH');
    expect(() => m.join(code, 'anna')).toThrow('NAME_TAKEN');
    expect(() => m.join(code, 42 as unknown as string)).toThrow('NAME_LENGTH');
  });

  it('rejects unknown rooms and full rooms', () => {
    const { m, code } = lobby(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(() => m.join(code, 'I')).toThrow('ROOM_FULL');
    expect(() => m.join('ZZZZ', 'X')).toThrow('ROOM_NOT_FOUND');
  });
});

describe('start and play', () => {
  it('only the host can start, needs 2 players, and nobody joins afterwards', () => {
    const { m, code, host } = lobby(['Anna']);
    expect(() => m.start(code, host.playerId)).toThrow('PLAYER_COUNT');
    const b = m.join(code, 'Ben');
    expect(() => m.start(code, b.playerId)).toThrow('HOST_ONLY');
    m.start(code, host.playerId);
    expect(m.stateFor(code, host.playerId).game?.phase).toBe('initialFlip');
    expect(m.join(code, 'Cara').role).toBe('spectator');
    expect(() => m.start(code, host.playerId)).toThrow('GAME_RUNNING');
  });

  it('act validates the payload and forwards to the rules', () => {
    const { m, code, host } = lobby(['Anna', 'Ben']);
    expect(() => m.act(code, host.playerId, { type: 'flipInitial', slot: 0 })).toThrow('GAME_NOT_STARTED');
    m.start(code, host.playerId);
    expect(() => m.act(code, host.playerId, null)).toThrow('INVALID_ACTION');
    expect(() => m.act(code, host.playerId, { type: 'nope' })).toThrow('UNKNOWN_ACTION');
    m.act(code, host.playerId, { type: 'flipInitial', slot: 0 });
    const me = m.stateFor(code, host.playerId).game!.players[0].grid[0];
    expect(me?.up).toBe(true);
  });

  it('next and rematch are host-only and phase-checked', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.start(code, host.playerId);
    expect(() => m.next(code, rest[0].playerId)).toThrow('HOST_ONLY');
    expect(() => m.next(code, host.playerId)).toThrow('ROUND_RUNNING');
    expect(() => m.rematch(code, rest[0].playerId)).toThrow('HOST_ONLY');
  });
});

describe('connection handling', () => {
  it('moves the host role to the next connected player when the host disconnects', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben', 'Cara']);
    m.setConnected(code, rest[0].playerId, false);
    m.setConnected(code, host.playerId, false);
    expect(m.stateFor(code, rest[1].playerId).room.hostId).toBe(rest[1].playerId);
    m.setConnected(code, host.playerId, true);
    expect(m.stateFor(code, host.playerId).room.hostId).toBe(rest[1].playerId);
  });

  it('rejoin with the token restores the player and marks them connected', () => {
    const { m, code, rest } = lobby(['Anna', 'Ben']);
    m.setConnected(code, rest[0].playerId, false);
    const r = m.rejoin(code, rest[0].token);
    expect(r.playerId).toBe(rest[0].playerId);
    const member = m.stateFor(code, r.playerId).room.members.find((x) => x.id === r.playerId);
    expect(member?.connected).toBe(true);
    expect(() => m.rejoin(code, 'bad-token')).toThrow('SESSION_EXPIRED');
  });

  it('setConnected and memberIds tolerate unknown rooms', () => {
    const m = mk();
    expect(() => m.setConnected('ZZZZ', 'x', false)).not.toThrow();
    expect(m.memberIds('ZZZZ')).toEqual([]);
  });
});

describe('remove', () => {
  it('removes a player from the lobby', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.remove(code, host.playerId, rest[0].playerId);
    expect(m.stateFor(code, host.playerId).room.members).toHaveLength(1);
    expect(() => m.remove(code, host.playerId, host.playerId)).toThrow('CANNOT_REMOVE_SELF');
  });

  it('only the host can remove; a removed player cannot rejoin', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben', 'Cara']);
    m.start(code, host.playerId);
    expect(() => m.remove(code, rest[0].playerId, rest[1].playerId)).toThrow('HOST_ONLY');
    m.remove(code, host.playerId, rest[0].playerId);
    const g = m.stateFor(code, host.playerId);
    expect(g.room.members.find((x) => x.id === rest[0].playerId)?.left).toBe(true);
    expect(() => m.rejoin(code, rest[0].token)).toThrow('REMOVED_FROM_GAME');
  });
});

describe('sweep', () => {
  it('drops rooms idle for more than 2 hours', () => {
    let t = 0;
    const m = new RoomManager(seeded(1), () => t);
    const h = m.create('Anna');
    m.setConnected(h.code, h.playerId, false);
    t = 3 * 3600 * 1000;
    expect(m.sweep()).toBe(1);
    expect(() => m.stateFor(h.code, h.playerId)).toThrow('ROOM_NOT_FOUND');
  });

  it('keeps rooms with recent activity', () => {
    let t = 0;
    const m = new RoomManager(seeded(1), () => t);
    const h = m.create('Anna');
    t = 90 * 60 * 1000;
    m.setConnected(h.code, h.playerId, true);
    t = 3 * 3600 * 1000 - 1;
    expect(m.sweep()).toBe(0);
  });
});

describe('host reassignment on reconnect', () => {
  it('gives the host role to a returning player when the current host is offline', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.setConnected(code, host.playerId, false);
    expect(m.stateFor(code, rest[0].playerId).room.hostId).toBe(rest[0].playerId);
    m.setConnected(code, rest[0].playerId, false);
    m.setConnected(code, host.playerId, true);
    expect(m.stateFor(code, host.playerId).room.hostId).toBe(host.playerId);
  });
});

describe('leave', () => {
  it('removes a lobby member and passes the host role on', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.leave(code, host.playerId);
    const s = m.stateFor(code, rest[0].playerId);
    expect(s.room.members.map((x) => x.name)).toEqual(['Ben']);
    expect(s.room.hostId).toBe(rest[0].playerId);
  });

  it('deletes the room when the last member leaves', () => {
    const { m, code, host } = lobby(['Anna']);
    m.leave(code, host.playerId);
    expect(() => m.stateFor(code, host.playerId)).toThrow('ROOM_NOT_FOUND');
  });

  it('marks a player in a running game as left, passes the host role and blocks rejoin', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben', 'Cara']);
    m.start(code, host.playerId);
    m.leave(code, host.playerId);
    const s = m.stateFor(code, rest[0].playerId);
    expect(s.room.hostId).toBe(rest[0].playerId);
    expect(s.game?.players.find((p) => p.id === host.playerId)?.left).toBe(true);
    expect(() => m.rejoin(code, host.token)).toThrow('REMOVED_FROM_GAME');
  });

  it('ends the game when only one player is left', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.start(code, host.playerId);
    m.leave(code, rest[0].playerId);
    expect(m.stateFor(code, host.playerId).game?.phase).toBe('gameOver');
  });
});

describe('minors', () => {
  it('sweep keeps idle rooms while a member is still connected', () => {
    let t = 0;
    const m = new RoomManager(seeded(1), () => t);
    m.create('Anna');
    t = 5 * 3600 * 1000;
    expect(m.sweep()).toBe(0);
  });

  it('points to the rematch when the next round is requested after the game ended', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.start(code, host.playerId);
    m.leave(code, rest[0].playerId);
    expect(() => m.next(code, host.playerId)).toThrow('GAME_OVER_REMATCH');
  });

  it('caps the number of rooms', () => {
    const m = new RoomManager(seeded(1), () => 0, 2);
    m.create('A');
    m.create('B');
    expect(() => m.create('C')).toThrow('SERVER_FULL');
  });
});

describe('snapshot / restore', () => {
  it('restores rooms, members, tokens and the running game', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.start(code, host.playerId);
    m.act(code, host.playerId, { type: 'flipInitial', slot: 0 });
    const before = m.stateFor(code, host.playerId);

    const m2 = mk();
    m2.restore(JSON.parse(JSON.stringify(m.snapshot())));
    const r = m2.rejoin(code, rest[0].token);
    expect(r.playerId).toBe(rest[0].playerId);
    const after = m2.stateFor(code, host.playerId);
    expect(after.game?.players).toEqual(before.game?.players);
    expect(after.room.hostId).toBe(before.room.hostId);
  });

  it('marks everyone as disconnected after a restore', () => {
    const { m, code, host } = lobby(['Anna', 'Ben']);
    const m2 = mk();
    m2.restore(JSON.parse(JSON.stringify(m.snapshot())));
    expect(m2.stateFor(code, host.playerId).room.members.every((x) => !x.connected)).toBe(true);
  });

  it('keeps the original host for a grace period after a restore', () => {
    let t = 0;
    const m = new RoomManager(seeded(5), () => t);
    const host = m.create('Anna');
    const ben = m.join(host.code, 'Ben');
    const m2 = new RoomManager(seeded(5), () => t);
    m2.restore(JSON.parse(JSON.stringify(m.snapshot())));
    m2.setConnected(host.code, ben.playerId, true);
    expect(m2.stateFor(host.code, ben.playerId).room.hostId).toBe(host.playerId);
    t = 60_000;
    m2.setConnected(host.code, ben.playerId, true);
    expect(m2.stateFor(host.code, ben.playerId).room.hostId).toBe(ben.playerId);
  });

  it('calls onChange for mutations and removals', () => {
    let calls = 0;
    const m = mk();
    m.onChange = () => calls++;
    const h = m.create('Anna');
    const afterCreate = calls;
    expect(afterCreate).toBeGreaterThan(0);
    m.leave(h.code, h.playerId);
    expect(calls).toBeGreaterThan(afterCreate);
  });
});

describe('target score setting', () => {
  it('lets only the host change it, only before the game, and only to allowed values', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    expect(m.stateFor(code, host.playerId).room.target).toBe(100);
    expect(() => m.setTarget(code, rest[0].playerId, 50)).toThrow('HOST_ONLY');
    expect(() => m.setTarget(code, host.playerId, 75)).toThrow('INVALID_TARGET');
    m.setTarget(code, host.playerId, 50);
    expect(m.stateFor(code, rest[0].playerId).room.target).toBe(50);
    m.start(code, host.playerId);
    expect(m.stateFor(code, host.playerId).game?.target).toBe(50);
    expect(() => m.setTarget(code, host.playerId, 150)).toThrow('GAME_RUNNING');
  });

  it('survives a snapshot restore', () => {
    const { m, code, host } = lobby(['Anna', 'Ben']);
    m.setTarget(code, host.playerId, 150);
    const m2 = mk();
    m2.restore(JSON.parse(JSON.stringify(m.snapshot())));
    expect(m2.stateFor(code, host.playerId).room.target).toBe(150);
  });
});

describe('nudge', () => {
  function inTurnPhase(now: () => number) {
    const m = new RoomManager(seeded(5), now);
    const host = m.create('Anna');
    const ben = m.join(host.code, 'Ben');
    m.start(host.code, host.playerId);
    for (const id of [host.playerId, ben.playerId]) {
      m.act(host.code, id, { type: 'flipInitial', slot: 0 });
      m.act(host.code, id, { type: 'flipInitial', slot: 1 });
    }
    const game = m.stateFor(host.code, host.playerId).game!;
    const current = game.current === host.playerId ? host : ben;
    const other = current === host ? ben : host;
    return { m, code: host.code, current, other };
  }

  it('returns the current player and the sender name', () => {
    const { m, code, current, other } = inTurnPhase(() => 0);
    const r = m.nudge(code, other.playerId);
    expect(r.targetId).toBe(current.playerId);
    expect(r.fromName).toBe(m.stateFor(code, other.playerId).room.members.find((x) => x.id === other.playerId)!.name);
  });

  it('refuses to nudge yourself, outside a turn, or without a game', () => {
    const { m, code, current } = inTurnPhase(() => 0);
    expect(() => m.nudge(code, current.playerId)).toThrow('SELF_TURN');
    const lobbyOnly = lobby(['Anna', 'Ben']);
    expect(() => lobbyOnly.m.nudge(lobbyOnly.code, lobbyOnly.rest[0].playerId)).toThrow('NOT_POSSIBLE_NOW');
  });

  it('allows one nudge per room every 10 seconds', () => {
    let t = 0;
    const { m, code, other } = inTurnPhase(() => t);
    m.nudge(code, other.playerId);
    expect(() => m.nudge(code, other.playerId)).toThrow('PLEASE_WAIT');
    t = 10_001;
    expect(m.nudge(code, other.playerId).targetId).toBeTruthy();
  });
});

describe('spectators', () => {
  function running(names: string[]) {
    const l = lobby(names);
    l.m.start(l.code, l.host.playerId);
    return l;
  }
  const NOT_ALLOWED = 'SPECTATOR_CANNOT_PLAY';

  it('joins a running game as spectator and sees the table without an own grid', () => {
    const { m, code } = running(['Anna', 'Ben']);
    const s = m.join(code, 'Zoe');
    expect(s.role).toBe('spectator');
    const st = m.stateFor(code, s.playerId);
    expect(st.role).toBe('spectator');
    expect(st.game?.me).toBe(s.playerId);
    expect(st.game?.players.map((p) => p.name)).toEqual(['Anna', 'Ben']);
    for (const p of st.game!.players) for (const c of p.grid) if (c && !c.up) expect(c.value).toBeNull();
    expect(st.room.spectatorCount).toBe(1);
    expect(st.room.members.find((x) => x.id === s.playerId)?.spectator).toBe(true);
  });

  it('lobby joiners stay players and spectators never take one of the 8 player seats', () => {
    const l = lobby(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    l.m.start(l.code, l.host.playerId);
    expect(l.m.join(l.code, 'S1').role).toBe('spectator');
    const lobbyOnly = lobby(['Anna']);
    expect(lobbyOnly.m.join(lobbyOnly.code, 'Ben').role).toBe('player');
  });

  it('keeps names unique across players and spectators and caps spectators at 20', () => {
    const { m, code } = running(['Anna', 'Ben']);
    m.join(code, 'Zoe');
    expect(() => m.join(code, 'zoe')).toThrow('NAME_TAKEN');
    expect(() => m.join(code, 'ANNA')).toThrow('NAME_TAKEN');
    for (let i = 1; i < 20; i++) m.join(code, `S${i}`);
    expect(() => m.join(code, 'Zu viel')).toThrow('TOO_MANY_SPECTATORS');
  });

  it('cannot act, nudge or use any host control', () => {
    const { m, code } = running(['Anna', 'Ben']);
    const s = m.join(code, 'Zoe').playerId;
    expect(() => m.act(code, s, { type: 'flipInitial', slot: 0 })).toThrow(NOT_ALLOWED);
    expect(() => m.nudge(code, s)).toThrow(NOT_ALLOWED);
    expect(() => m.start(code, s)).toThrow(NOT_ALLOWED);
    expect(() => m.next(code, s)).toThrow(NOT_ALLOWED);
    expect(() => m.rematch(code, s)).toThrow(NOT_ALLOWED);
    expect(() => m.setTarget(code, s, 50)).toThrow(NOT_ALLOWED);
    expect(() => m.remove(code, s, s)).toThrow(NOT_ALLOWED);
  });

  it('never becomes host, neither when the host drops nor when the spectator reconnects', () => {
    const { m, code, host, rest } = running(['Anna', 'Ben']);
    const s = m.join(code, 'Zoe').playerId;
    m.setConnected(code, rest[0].playerId, false);
    m.setConnected(code, host.playerId, false);
    expect(m.stateFor(code, s).room.hostId).toBe(host.playerId);
    m.setConnected(code, s, false);
    m.setConnected(code, s, true);
    expect(m.stateFor(code, s).room.hostId).toBe(host.playerId);
  });

  it('a spectator can leave without touching the game, and the host can remove spectators', () => {
    const { m, code, host } = running(['Anna', 'Ben']);
    const a = m.join(code, 'Zoe').playerId;
    const b = m.join(code, 'Yan').playerId;
    expect(m.leave(code, a)).toEqual({ closedFor: [] });
    m.remove(code, host.playerId, b);
    const st = m.stateFor(code, host.playerId);
    expect(st.room.spectatorCount).toBe(0);
    expect(st.game?.players).toHaveLength(2);
    expect(st.game?.phase).toBe('initialFlip');
  });

  it('closes the room and reports the spectators when the last player leaves', () => {
    const { m, code, host, rest } = running(['Anna', 'Ben']);
    const s = m.join(code, 'Zoe').playerId;
    m.leave(code, rest[0].playerId);
    expect(m.leave(code, host.playerId).closedFor).toEqual([s]);
    expect(() => m.stateFor(code, s)).toThrow('ROOM_NOT_FOUND');
  });

  it('rejoin restores the spectator role', () => {
    const { m, code } = running(['Anna', 'Ben']);
    const s = m.join(code, 'Zoe');
    m.setConnected(code, s.playerId, false);
    const r = m.rejoin(code, s.token);
    expect(r.role).toBe('spectator');
    expect(m.stateFor(code, r.playerId).role).toBe('spectator');
  });

  it('survives a snapshot restore as spectator', () => {
    const { m, code } = running(['Anna', 'Ben']);
    const s = m.join(code, 'Zoe');
    const m2 = mk();
    m2.restore(JSON.parse(JSON.stringify(m.snapshot())));
    expect(m2.rejoin(code, s.token).role).toBe('spectator');
  });
});

describe('play request and rematch', () => {
  function gameOverWithSpectator() {
    const l = lobby(['Anna', 'Ben']);
    l.m.start(l.code, l.host.playerId);
    const spectator = l.m.join(l.code, 'Zoe');
    l.m.leave(l.code, l.rest[0].playerId); // only Anna is active now -> game over
    return { ...l, spectator };
  }

  it('is only for spectators, also during a running game; toggles', () => {
    const l = lobby(['Anna', 'Ben']);
    l.m.start(l.code, l.host.playerId);
    const z = l.m.join(l.code, 'Zoe');
    expect(() => l.m.requestPlay(l.code, l.host.playerId)).toThrow('ALREADY_PLAYING');
    expect(l.m.requestPlay(l.code, z.playerId)).toBe(true);
    expect(l.m.requestPlay(l.code, z.playerId)).toBe(false);
    l.m.leave(l.code, l.rest[0].playerId);
    expect(l.m.requestPlay(l.code, z.playerId)).toBe(true);
    expect(l.m.requestPlay(l.code, z.playerId)).toBe(false);
  });

  it('promotes spectators who asked to play when the host starts the rematch', () => {
    const { m, code, host, spectator } = gameOverWithSpectator();
    m.requestPlay(code, spectator.playerId);
    m.rematch(code, host.playerId);
    const st = m.stateFor(code, host.playerId);
    expect(st.game?.players.map((p) => p.name)).toEqual(['Anna', 'Zoe']);
    expect(st.game?.phase).toBe('initialFlip');
    const zoe = st.room.members.find((x) => x.id === spectator.playerId)!;
    expect(zoe.spectator).toBe(false);
    expect(zoe.wantsToPlay).toBe(false);
    expect(m.stateFor(code, spectator.playerId).role).toBe('player');
  });

  it('promotes only the spectators who asked and keeps the others', () => {
    const l = lobby(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    l.m.start(l.code, l.host.playerId);
    const s1 = l.m.join(l.code, 'S1');
    const s2 = l.m.join(l.code, 'S2');
    for (const r of l.rest.slice(0, 6)) l.m.leave(l.code, r.playerId); // 2 active left -> still running
    l.m.leave(l.code, l.rest[6].playerId); // 1 active left -> game over
    l.m.requestPlay(l.code, s1.playerId);
    l.m.rematch(l.code, l.host.playerId);
    const st = l.m.stateFor(l.code, l.host.playerId);
    expect(st.game?.players.map((p) => p.name)).toEqual(['A', 'S1']);
    expect(st.room.members.find((x) => x.id === s2.playerId)?.spectator).toBe(true);
  });

  it('rejects a rematch with fewer than 2 players without promoting anyone', () => {
    const { m, code, host, spectator } = gameOverWithSpectator();
    expect(() => m.rematch(code, host.playerId)).toThrow('PLAYER_COUNT');
    expect(m.stateFor(code, host.playerId).room.members.find((x) => x.id === spectator.playerId)?.spectator).toBe(true);
  });
});

describe('bots', () => {
  const botOf = (m: RoomManager, code: string, id: string) => m.stateFor(code, id).room.members.find((x) => x.bot);

  it('lets only the host add bots, only in the lobby, with a valid level, up to 8 players', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    expect(() => m.addBot(code, rest[0].playerId, 'easy')).toThrow('HOST_ONLY');
    expect(() => m.addBot(code, host.playerId, 'godlike')).toThrow('INVALID_BOT_LEVEL');
    for (let i = 0; i < 6; i++) m.addBot(code, host.playerId, 'easy');
    expect(() => m.addBot(code, host.playerId, 'easy')).toThrow('ROOM_FULL');
    const l2 = lobby(['Anna', 'Ben']);
    l2.m.addBot(l2.code, l2.host.playerId, 'normal');
    l2.m.start(l2.code, l2.host.playerId);
    expect(() => l2.m.addBot(l2.code, l2.host.playerId, 'normal')).toThrow('GAME_RUNNING');
  });

  it('gives bots unique names from the list and exposes their level', () => {
    const { m, code, host } = lobby(['Nova']);
    m.addBot(code, host.playerId, 'easy');
    m.addBot(code, host.playerId, 'hard');
    const members = m.stateFor(code, host.playerId).room.members;
    expect(members.map((x) => x.name)).toEqual(['Nova', 'Pixel', 'Byte']);
    expect(members[1].bot).toEqual({ level: 'easy' });
    expect(members[2].bot).toEqual({ level: 'hard' });
    expect(members[1].id).toMatch(/^bot-/);
  });

  it('counts bots as players at the start and keeps them connected', () => {
    const { m, code, host } = lobby(['Anna']);
    m.addBot(code, host.playerId, 'normal');
    m.start(code, host.playerId);
    const st = m.stateFor(code, host.playerId);
    expect(st.game?.players).toHaveLength(2);
    expect(botOf(m, code, host.playerId)?.connected).toBe(true);
    m.setConnected(code, botOf(m, code, host.playerId)!.id, false);
    expect(botOf(m, code, host.playerId)?.connected).toBe(true);
  });

  it('cannot be taken over with an empty token', () => {
    const { m, code, host } = lobby(['Anna']);
    m.addBot(code, host.playerId, 'easy');
    expect(() => m.rejoin(code, '')).toThrow('SESSION_EXPIRED');
  });

  it('never become host, and the room closes when the last human leaves', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.addBot(code, host.playerId, 'easy');
    m.setConnected(code, host.playerId, false);
    expect(m.stateFor(code, rest[0].playerId).room.hostId).toBe(rest[0].playerId);
    m.setConnected(code, rest[0].playerId, false);
    expect(m.stateFor(code, rest[0].playerId).room.hostId).toBe(rest[0].playerId);
    m.leave(code, host.playerId);
    m.leave(code, rest[0].playerId);
    expect(() => m.stateFor(code, rest[0].playerId)).toThrow('ROOM_NOT_FOUND');
  });

  it('sweep ignores bots when deciding whether anyone is connected', () => {
    let t = 0;
    const m = new RoomManager(seeded(1), () => t);
    const h = m.create('Anna');
    m.addBot(h.code, h.playerId, 'easy');
    m.setConnected(h.code, h.playerId, false);
    t = 3 * 3600 * 1000;
    expect(m.sweep()).toBe(1);
  });

  it('accepts the extreme level and keeps it through a snapshot restore (server restart)', () => {
    const { m, code, host } = lobby(['Anna']);
    const id = m.addBot(code, host.playerId, 'extreme');
    m.start(code, host.playerId);
    const m2 = mk();
    m2.restore(JSON.parse(JSON.stringify(m.snapshot())));
    expect(m2.stateFor(code, host.playerId).room.members.find((x) => x.id === id)?.bot).toEqual({ level: 'extreme' });
    expect(m2.botViews(code)).toMatchObject([{ id, level: 'extreme' }]);
  });

  it('restore keeps bots connected and marks humans disconnected', () => {
    const { m, code, host } = lobby(['Anna']);
    m.addBot(code, host.playerId, 'easy');
    const m2 = mk();
    m2.restore(JSON.parse(JSON.stringify(m.snapshot())));
    const members = m2.stateFor(code, host.playerId).room.members;
    expect(members.find((x) => x.bot)?.connected).toBe(true);
    expect(members.find((x) => !x.bot)?.connected).toBe(false);
  });

  it('refuses to nudge a bot', () => {
    for (let seed = 1; seed < 60; seed++) {
      const m = new RoomManager(seeded(seed));
      const h = m.create('Anna');
      const botId = m.addBot(h.code, h.playerId, 'easy');
      m.start(h.code, h.playerId);
      for (const id of [h.playerId, botId]) {
        m.act(h.code, id, { type: 'flipInitial', slot: 0 });
        m.act(h.code, id, { type: 'flipInitial', slot: 1 });
      }
      if (m.stateFor(h.code, h.playerId).game!.current === botId) {
        expect(() => m.nudge(h.code, h.playerId)).toThrow('NO_NUDGE_BOTS');
        return;
      }
    }
    throw new Error('no seed made the bot start');
  });

  it('gives every bot its own view and nothing hidden', () => {
    const { m, code, host } = lobby(['Anna']);
    expect(m.botViews(code)).toEqual([]);
    const botId = m.addBot(code, host.playerId, 'hard');
    m.start(code, host.playerId);
    const views = m.botViews(code);
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ id: botId, level: 'hard' });
    expect(views[0].view.me).toBe(botId);
    for (const p of views[0].view.players) for (const c of p.grid) if (c && !c.up) expect(c.value).toBeNull();
    expect(m.botViews('ZZZZ')).toEqual([]);
    expect(m.roomCodes()).toEqual([code]);
  });

  it('calls onRoomChange with the room code and survives a throwing hook', () => {
    const { m, code, host } = lobby(['Anna']);
    const seen: string[] = [];
    m.onRoomChange = (c) => seen.push(c);
    m.addBot(code, host.playerId, 'easy');
    expect(seen).toEqual([code]);
    m.onRoomChange = () => {
      throw new Error('boom');
    };
    expect(() => m.addBot(code, host.playerId, 'easy')).not.toThrow();
  });
});

describe('spectators: disconnected tabs', () => {
  function running(names: string[]) {
    const l = lobby(names);
    l.m.start(l.code, l.host.playerId);
    return l;
  }

  it('counts only connected spectators', () => {
    const { m, code, host } = running(['Anna', 'Ben']);
    const z = m.join(code, 'Zoe').playerId;
    expect(m.stateFor(code, host.playerId).room.spectatorCount).toBe(1);
    m.setConnected(code, z, false);
    expect(m.stateFor(code, host.playerId).room.spectatorCount).toBe(0);
    m.setConnected(code, z, true);
    expect(m.stateFor(code, host.playerId).room.spectatorCount).toBe(1);
  });

  it('lets a newcomer replace a disconnected spectator when the cap is reached, but not a connected one', () => {
    const { m, code } = running(['Anna', 'Ben']);
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) ids.push(m.join(code, `S${i}`).playerId);
    expect(() => m.join(code, 'Extra')).toThrow('TOO_MANY_SPECTATORS');
    m.setConnected(code, ids[3], false);
    const joined = m.join(code, 'Extra');
    expect(joined.role).toBe('spectator');
    const members = m.stateFor(code, joined.playerId).room.members;
    expect(members.filter((x) => x.spectator)).toHaveLength(20);
    expect(members.some((x) => x.id === ids[3])).toBe(false);
  });

  it('a lone connected spectator does not keep a room without players alive', () => {
    let t = 0;
    const m = new RoomManager(seeded(5), () => t);
    const host = m.create('Anna');
    const ben = m.join(host.code, 'Ben');
    m.start(host.code, host.playerId);
    const z = m.join(host.code, 'Zoe');
    m.setConnected(host.code, host.playerId, false);
    m.setConnected(host.code, ben.playerId, false);
    t = 3 * 3600 * 1000;
    expect(m.sweep()).toBe(1);
    expect(() => m.stateFor(host.code, z.playerId)).toThrow('ROOM_NOT_FOUND');
  });
});


describe('chat', () => {
  function room() {
    let t = 1000;
    const m = new RoomManager(seeded(1), () => t);
    const host = m.create('Anna');
    return { m, host, tick: (ms: number) => (t += ms) };
  }

  it('stores trimmed messages with the sender name and keeps the last 50', () => {
    const { m, host, tick } = room();
    const msg = m.sendChat(host.code, host.playerId, '  hallo   welt ');
    expect(msg).toMatchObject({ from: host.playerId, name: 'Anna', text: 'hallo welt' });
    for (let i = 0; i < 60; i++) {
      tick(5000);
      m.sendChat(host.code, host.playerId, `n${i}`);
    }
    const log = m.chatHistory(host.code);
    expect(log).toHaveLength(50);
    expect(log.at(-1)?.text).toBe('n59');
  });

  it('rejects empty, caps length, rate limits per sender and blocks bots', () => {
    const { m, host, tick } = room();
    expect(() => m.sendChat(host.code, host.playerId, '   ')).toThrow('MESSAGE_EMPTY');
    expect(() => m.sendChat(host.code, host.playerId, 42)).toThrow('MESSAGE_EMPTY');
    expect(m.sendChat(host.code, host.playerId, 'x'.repeat(500)).text).toHaveLength(200);
    for (let i = 0; i < 4; i++) m.sendChat(host.code, host.playerId, 'a');
    expect(() => m.sendChat(host.code, host.playerId, 'a')).toThrow('TOO_MANY_MESSAGES');
    tick(10_001);
    expect(() => m.sendChat(host.code, host.playerId, 'a')).not.toThrow();
    const botId = m.addBot(host.code, host.playerId, 'normal');
    expect(() => m.sendChat(host.code, botId, 'hi')).toThrow('BOTS_CANNOT_CHAT');
  });
});
