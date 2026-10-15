import { randomUUID } from 'node:crypto';
import { apply, newGame, removePlayer, startRound } from '../shared/rules';
import { MAX_PLAYERS, type Action, type GameState, type Rng } from '../shared/types';
import { viewFor, type ClientState } from '../shared/view';

const MAX_NAME = 16;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface Member {
  id: string;
  name: string;
  token: string;
  connected: boolean;
}

interface Room {
  code: string;
  hostId: string;
  members: Member[];
  game: GameState | null;
  lastActivity: number;
}

const normalizeCode = (code: unknown): string => String(code ?? '').trim().toUpperCase();

function cleanName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (n.length < 1 || n.length > MAX_NAME) throw new Error(`Name muss 1–${MAX_NAME} Zeichen lang sein`);
  return n;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(
    private rng: Rng = Math.random,
    private now: () => number = Date.now,
  ) {}

  private room(code: string): Room {
    const room = this.rooms.get(normalizeCode(code));
    if (!room) throw new Error('Raum nicht gefunden');
    return room;
  }

  private member(room: Room, playerId: string): Member {
    const m = room.members.find((x) => x.id === playerId);
    if (!m) throw new Error('Unbekannter Spieler');
    return m;
  }

  private requireHost(room: Room, playerId: string): void {
    this.member(room, playerId);
    if (room.hostId !== playerId) throw new Error('Nur der Host kann das');
  }

  private isLeft(room: Room, id: string): boolean {
    return room.game?.players.find((p) => p.id === id)?.left ?? false;
  }

  private touch(room: Room): void {
    room.lastActivity = this.now();
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(this.rng() * CODE_CHARS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  private newMember(name: string): Member {
    return { id: randomUUID().slice(0, 8), name, token: randomUUID(), connected: true };
  }

  create(name: string) {
    const member = this.newMember(cleanName(name));
    const code = this.newCode();
    this.rooms.set(code, {
      code,
      hostId: member.id,
      members: [member],
      game: null,
      lastActivity: this.now(),
    });
    return { code, playerId: member.id, token: member.token };
  }

  join(code: string, name: string) {
    const room = this.room(code);
    const clean = cleanName(name);
    if (room.game) throw new Error('Das Spiel läuft bereits');
    if (room.members.length >= MAX_PLAYERS) throw new Error('Raum ist voll');
    if (room.members.some((m) => m.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error('Name bereits vergeben');
    }
    const member = this.newMember(clean);
    room.members.push(member);
    this.touch(room);
    return { code: room.code, playerId: member.id, token: member.token };
  }

  rejoin(code: string, token: string) {
    const room = this.room(code);
    const member = room.members.find((m) => m.token === token);
    if (!member) throw new Error('Sitzung abgelaufen');
    if (this.isLeft(room, member.id)) throw new Error('Du wurdest aus dem Spiel genommen');
    this.setConnected(room.code, member.id, true);
    return { code: room.code, playerId: member.id };
  }

  start(code: string, playerId: string): void {
    const room = this.room(code);
    this.requireHost(room, playerId);
    if (room.game) throw new Error('Das Spiel läuft bereits');
    room.game = newGame(
      room.members.map(({ id, name }) => ({ id, name })),
      this.rng,
    );
    this.touch(room);
  }

  act(code: string, playerId: string, action: unknown): void {
    const room = this.room(code);
    this.member(room, playerId);
    if (!room.game) throw new Error('Das Spiel hat noch nicht begonnen');
    if (typeof action !== 'object' || action === null) throw new Error('Ungültige Aktion');
    room.game = apply(room.game, playerId, action as Action, this.rng);
    this.touch(room);
  }

  next(code: string, playerId: string): void {
    const room = this.room(code);
    this.requireHost(room, playerId);
    if (!room.game) throw new Error('Das Spiel hat noch nicht begonnen');
    room.game = startRound(room.game, this.rng);
    this.touch(room);
  }

  rematch(code: string, playerId: string): void {
    const room = this.room(code);
    this.requireHost(room, playerId);
    if (room.game?.phase !== 'gameOver') throw new Error('Das Spiel läuft noch');
    room.members = room.members.filter((m) => !this.isLeft(room, m.id));
    room.game = newGame(
      room.members.map(({ id, name }) => ({ id, name })),
      this.rng,
    );
    this.touch(room);
  }

  remove(code: string, playerId: string, targetId: string): void {
    const room = this.room(code);
    this.requireHost(room, playerId);
    if (targetId === playerId) throw new Error('Du kannst dich nicht selbst entfernen');
    this.member(room, targetId);
    if (room.game) room.game = removePlayer(room.game, targetId);
    else room.members = room.members.filter((m) => m.id !== targetId);
    this.touch(room);
  }

  setConnected(code: string, playerId: string, connected: boolean): void {
    const room = this.rooms.get(normalizeCode(code));
    const member = room?.members.find((m) => m.id === playerId);
    if (!room || !member) return;
    member.connected = connected;
    if (!connected && room.hostId === playerId) {
      const next = room.members.find(
        (m) => m.connected && m.id !== playerId && !this.isLeft(room, m.id),
      );
      if (next) room.hostId = next.id;
    }
    this.touch(room);
  }

  memberIds(code: string): string[] {
    return this.rooms.get(normalizeCode(code))?.members.map((m) => m.id) ?? [];
  }

  stateFor(code: string, playerId: string): ClientState {
    const room = this.room(code);
    this.member(room, playerId);
    return {
      me: playerId,
      room: {
        code: room.code,
        hostId: room.hostId,
        started: room.game !== null,
        members: room.members.map((m) => ({
          id: m.id,
          name: m.name,
          connected: m.connected,
          left: this.isLeft(room, m.id),
        })),
      },
      game: room.game ? viewFor(room.game, playerId) : null,
    };
  }

  sweep(): number {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      if (this.now() - room.lastActivity > ROOM_TTL_MS) {
        this.rooms.delete(code);
        removed++;
      }
    }
    return removed;
  }
}
