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
    expect(() => m.create('   ')).toThrow('Name muss 1–16 Zeichen lang sein');
    expect(() => m.join(code, 'x'.repeat(17))).toThrow('Name muss 1–16 Zeichen lang sein');
    expect(() => m.join(code, 'anna')).toThrow('Name bereits vergeben');
    expect(() => m.join(code, 42 as unknown as string)).toThrow('Name muss');
  });

  it('rejects unknown rooms and full rooms', () => {
    const { m, code } = lobby(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(() => m.join(code, 'I')).toThrow('Raum ist voll');
    expect(() => m.join('ZZZZ', 'X')).toThrow('Raum nicht gefunden');
  });
});

describe('start and play', () => {
  it('only the host can start, needs 2 players, and nobody joins afterwards', () => {
    const { m, code, host } = lobby(['Anna']);
    expect(() => m.start(code, host.playerId)).toThrow('2 bis 8');
    const b = m.join(code, 'Ben');
    expect(() => m.start(code, b.playerId)).toThrow('Nur der Host kann das');
    m.start(code, host.playerId);
    expect(m.stateFor(code, host.playerId).game?.phase).toBe('initialFlip');
    expect(() => m.join(code, 'Cara')).toThrow('Das Spiel läuft bereits');
    expect(() => m.start(code, host.playerId)).toThrow('Das Spiel läuft bereits');
  });

  it('act validates the payload and forwards to the rules', () => {
    const { m, code, host } = lobby(['Anna', 'Ben']);
    expect(() => m.act(code, host.playerId, { type: 'flipInitial', slot: 0 })).toThrow('noch nicht begonnen');
    m.start(code, host.playerId);
    expect(() => m.act(code, host.playerId, null)).toThrow('Ungültige Aktion');
    expect(() => m.act(code, host.playerId, { type: 'nope' })).toThrow('Unbekannte Aktion');
    m.act(code, host.playerId, { type: 'flipInitial', slot: 0 });
    const me = m.stateFor(code, host.playerId).game!.players[0].grid[0];
    expect(me?.up).toBe(true);
  });

  it('next and rematch are host-only and phase-checked', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.start(code, host.playerId);
    expect(() => m.next(code, rest[0].playerId)).toThrow('Nur der Host kann das');
    expect(() => m.next(code, host.playerId)).toThrow('Runde läuft noch');
    expect(() => m.rematch(code, rest[0].playerId)).toThrow('Nur der Host kann das');
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
    expect(() => m.rejoin(code, 'bad-token')).toThrow('Sitzung abgelaufen');
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
    expect(() => m.remove(code, host.playerId, host.playerId)).toThrow('nicht selbst');
  });

  it('only the host can remove; a removed player cannot rejoin', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben', 'Cara']);
    m.start(code, host.playerId);
    expect(() => m.remove(code, rest[0].playerId, rest[1].playerId)).toThrow('Nur der Host kann das');
    m.remove(code, host.playerId, rest[0].playerId);
    const g = m.stateFor(code, host.playerId);
    expect(g.room.members.find((x) => x.id === rest[0].playerId)?.left).toBe(true);
    expect(() => m.rejoin(code, rest[0].token)).toThrow('Du wurdest aus dem Spiel genommen');
  });
});

describe('sweep', () => {
  it('drops rooms idle for more than 2 hours', () => {
    let t = 0;
    const m = new RoomManager(seeded(1), () => t);
    const h = m.create('Anna');
    t = 3 * 3600 * 1000;
    expect(m.sweep()).toBe(1);
    expect(() => m.stateFor(h.code, h.playerId)).toThrow('Raum nicht gefunden');
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
    expect(() => m.stateFor(code, host.playerId)).toThrow('Raum nicht gefunden');
  });

  it('marks a player in a running game as left, passes the host role and blocks rejoin', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben', 'Cara']);
    m.start(code, host.playerId);
    m.leave(code, host.playerId);
    const s = m.stateFor(code, rest[0].playerId);
    expect(s.room.hostId).toBe(rest[0].playerId);
    expect(s.game?.players.find((p) => p.id === host.playerId)?.left).toBe(true);
    expect(() => m.rejoin(code, host.token)).toThrow('Du wurdest aus dem Spiel genommen');
  });

  it('ends the game when only one player is left', () => {
    const { m, code, host, rest } = lobby(['Anna', 'Ben']);
    m.start(code, host.playerId);
    m.leave(code, rest[0].playerId);
    expect(m.stateFor(code, host.playerId).game?.phase).toBe('gameOver');
  });
});
