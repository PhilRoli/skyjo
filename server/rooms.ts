import { randomUUID } from 'node:crypto';
import { apply, newGame, removePlayer, startRound } from '../shared/rules';
import { ALLOWED_TARGETS, BOT_LEVELS, DEFAULT_TARGET, MAX_PLAYERS, type Action, type BotLevel, type GameState, type Rng } from '../shared/types';
import { devViewFor, viewFor, type ClientState, type DevInfo, type PlayerView } from '../shared/view';

const MAX_NAME = 16;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const HOST_GRACE_MS = 30_000;
const MAX_SPECTATORS = 20;
const BOT_NAMES = ['Nova', 'Pixel', 'Byte', 'Echo', 'Luna', 'Zed', 'Robo', 'Max'];
const NUDGE_COOLDOWN_MS = 10_000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface Member {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  spectator?: boolean;
  wantsToPlay?: boolean;
  bot?: { level: BotLevel };
}

interface Room {
  code: string;
  hostId: string;
  members: Member[];
  game: GameState | null;
  target: number;
  lastActivity: number;
  /** Not persisted: after a restart the original host gets a moment to return before the role moves. */
  hostGraceUntil?: number;
  /** Not persisted: limits nudging to once per cooldown for the whole room. */
  lastNudgeAt?: number;
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  members: Member[];
  game: GameState | null;
  target?: number;
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
  onChange?: () => void;
  onRoomChange?: (code: string) => void;

  constructor(
    private rng: Rng = Math.random,
    private now: () => number = Date.now,
    private maxRooms = 1000,
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

  private players(room: Room): Member[] {
    return room.members.filter((m) => !m.spectator);
  }

  private humans(room: Room): Member[] {
    return room.members.filter((m) => !m.spectator && !m.bot);
  }

  private requirePlayer(room: Room, playerId: string): Member {
    const m = this.member(room, playerId);
    if (m.spectator) throw new Error('Zuschauer können nicht spielen');
    return m;
  }

  private requireHost(room: Room, playerId: string): void {
    this.requirePlayer(room, playerId);
    if (room.hostId !== playerId) throw new Error('Nur der Host kann das');
  }

  private isLeft(room: Room, id: string): boolean {
    return room.game?.players.find((p) => p.id === id)?.left ?? false;
  }

  private touch(room: Room): void {
    room.lastActivity = this.now();
    this.onChange?.();
    try {
      this.onRoomChange?.(room.code);
    } catch (e) {
      console.error('room change hook failed', e);
    }
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
    if (this.rooms.size >= this.maxRooms) throw new Error('Server ausgelastet, bitte später erneut versuchen');
    const member = this.newMember(cleanName(name));
    const code = this.newCode();
    this.rooms.set(code, {
      code,
      hostId: member.id,
      members: [member],
      game: null,
      target: DEFAULT_TARGET,
      lastActivity: this.now(),
    });
    this.onChange?.();
    return { code, playerId: member.id, token: member.token };
  }

  join(code: string, name: string) {
    const room = this.room(code);
    const clean = cleanName(name);
    if (room.members.some((m) => m.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error('Name bereits vergeben');
    }
    const spectator = room.game !== null;
    if (spectator) {
      const spectators = room.members.filter((m) => m.spectator);
      if (spectators.length >= MAX_SPECTATORS) {
        // Closed tabs must not block newcomers: make room by dropping a disconnected spectator.
        const stale = spectators.find((m) => !m.connected);
        if (!stale) throw new Error('Zu viele Zuschauer');
        room.members = room.members.filter((m) => m !== stale);
      }
    } else if (this.players(room).length >= MAX_PLAYERS) {
      throw new Error('Raum ist voll');
    }
    const member: Member = spectator
      ? { ...this.newMember(clean), spectator: true, wantsToPlay: false }
      : this.newMember(clean);
    room.members.push(member);
    this.touch(room);
    return {
      code: room.code,
      playerId: member.id,
      token: member.token,
      role: (spectator ? 'spectator' : 'player') as 'player' | 'spectator',
    };
  }

  rejoin(code: string, token: string) {
    const room = this.room(code);
    const member = room.members.find((m) => !m.bot && m.token === token);
    if (!member) throw new Error('Sitzung abgelaufen');
    if (this.isLeft(room, member.id)) throw new Error('Du wurdest aus dem Spiel genommen');
    this.setConnected(room.code, member.id, true);
    return {
      code: room.code,
      playerId: member.id,
      role: (member.spectator ? 'spectator' : 'player') as 'player' | 'spectator',
    };
  }

  start(code: string, playerId: string): void {
    const room = this.room(code);
    this.requireHost(room, playerId);
    if (room.game) throw new Error('Das Spiel läuft bereits');
    room.game = newGame(
      this.players(room).map(({ id, name }) => ({ id, name })),
      this.rng,
      room.target,
    );
    this.touch(room);
  }

  nudge(code: string, playerId: string): { targetId: string; fromName: string } {
    const room = this.room(code);
    const from = this.requirePlayer(room, playerId);
    const game = room.game;
    const turnPhase = game && ['draw', 'place', 'flipAfterDiscard'].includes(game.phase);
    if (!game || !turnPhase) throw new Error('Gerade nicht möglich');
    const target = game.players[game.current];
    if (target.id === playerId) throw new Error('Du bist selbst dran');
    if (room.members.find((m) => m.id === target.id)?.bot) throw new Error('Bots muss man nicht anstupsen');
    if (room.lastNudgeAt !== undefined && this.now() - room.lastNudgeAt < NUDGE_COOLDOWN_MS) {
      throw new Error('Bitte kurz warten');
    }
    room.lastNudgeAt = this.now();
    return { targetId: target.id, fromName: from.name };
  }

  setTarget(code: string, playerId: string, target: unknown): void {
    const room = this.room(code);
    this.requireHost(room, playerId);
    if (room.game) throw new Error('Das Spiel läuft bereits');
    if (typeof target !== 'number' || !ALLOWED_TARGETS.includes(target)) {
      throw new Error('Ungültige Zielpunktzahl');
    }
    room.target = target;
    this.touch(room);
  }

  addBot(code: string, playerId: string, level: unknown): string {
    const room = this.room(code);
    this.requireHost(room, playerId);
    if (room.game) throw new Error('Das Spiel läuft bereits');
    if (!BOT_LEVELS.includes(level as BotLevel)) throw new Error('Ungültige Bot-Stufe');
    if (this.players(room).length >= MAX_PLAYERS) throw new Error('Raum ist voll');
    const taken = new Set(room.members.map((m) => m.name.toLowerCase()));
    const name = BOT_NAMES.find((n) => !taken.has(n.toLowerCase())) ?? `Bot ${room.members.length + 1}`;
    const bot: Member = {
      id: `bot-${randomUUID().slice(0, 6)}`,
      name,
      token: '',
      connected: true,
      bot: { level: level as BotLevel },
    };
    room.members.push(bot);
    this.touch(room);
    return bot.id;
  }

  act(code: string, playerId: string, action: unknown): void {
    const room = this.room(code);
    this.requirePlayer(room, playerId);
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
    const staying = this.players(room).filter((m) => !this.isLeft(room, m.id));
    const promoted = room.members
      .filter((m) => m.spectator && m.wantsToPlay)
      .slice(0, Math.max(0, MAX_PLAYERS - staying.length));
    const next = [...staying, ...promoted];
    // Validates the player count (throws before anything is changed).
    const game = newGame(
      next.map(({ id, name }) => ({ id, name })),
      this.rng,
      room.target,
    );
    for (const m of promoted) {
      m.spectator = false;
      m.wantsToPlay = false;
    }
    room.members = room.members.filter((m) => m.spectator || next.includes(m));
    room.game = game;
    this.touch(room);
  }

  remove(code: string, playerId: string, targetId: string): void {
    const room = this.room(code);
    this.requireHost(room, playerId);
    if (targetId === playerId) throw new Error('Du kannst dich nicht selbst entfernen');
    const target = this.member(room, targetId);
    if (target.spectator || !room.game) room.members = room.members.filter((m) => m.id !== targetId);
    else room.game = removePlayer(room.game, targetId);
    this.touch(room);
  }

  leave(code: string, playerId: string): { closedFor: string[] } {
    const room = this.room(code);
    const member = this.member(room, playerId);
    if (member.spectator) {
      room.members = room.members.filter((m) => m.id !== playerId);
      this.touch(room);
      return { closedFor: [] };
    }
    if (room.game) {
      room.game = removePlayer(room.game, playerId);
      member.connected = false;
    } else {
      room.members = room.members.filter((m) => m.id !== playerId);
    }
    const remaining = this.humans(room).filter((m) => m.id !== playerId && !this.isLeft(room, m.id));
    if (remaining.length === 0) {
      const closedFor = room.members.filter((m) => m.spectator).map((m) => m.id);
      this.rooms.delete(room.code);
      this.onChange?.();
      return { closedFor };
    }
    if (room.hostId === playerId) {
      room.hostId = (remaining.find((m) => m.connected) ?? remaining[0]).id;
    }
    this.touch(room);
    return { closedFor: [] };
  }

  requestPlay(code: string, playerId: string): boolean {
    const room = this.room(code);
    const member = this.member(room, playerId);
    if (!member.spectator) throw new Error('Du spielst bereits mit');
    if (room.game?.phase !== 'gameOver') throw new Error('Gerade nicht möglich');
    member.wantsToPlay = !member.wantsToPlay;
    this.touch(room);
    return member.wantsToPlay;
  }

  setConnected(code: string, playerId: string, connected: boolean): void {
    const room = this.rooms.get(normalizeCode(code));
    const member = room?.members.find((m) => m.id === playerId);
    if (!room || !member || member.bot) return;
    member.connected = connected;
    if (connected && !member.spectator && !(room.hostGraceUntil && this.now() < room.hostGraceUntil)) {
      const host = room.members.find((m) => m.id === room.hostId);
      if (!host || !host.connected || this.isLeft(room, host.id)) room.hostId = playerId;
    }
    if (!connected && room.hostId === playerId) {
      const next = room.members.find(
        (m) => m.connected && m.id !== playerId && !m.spectator && !m.bot && !this.isLeft(room, m.id),
      );
      if (next) room.hostId = next.id;
    }
    this.touch(room);
  }

  memberIds(code: string): string[] {
    return this.rooms.get(normalizeCode(code))?.members.map((m) => m.id) ?? [];
  }

  devInfo(code: string): DevInfo | undefined {
    const game = this.room(code).game;
    return game ? devViewFor(game) : undefined;
  }

  stateFor(code: string, playerId: string): ClientState {
    const room = this.room(code);
    const me = this.member(room, playerId);
    return {
      me: playerId,
      role: me.spectator ? 'spectator' : 'player',
      room: {
        code: room.code,
        hostId: room.hostId,
        started: room.game !== null,
        target: room.target,
        spectatorCount: room.members.filter((m) => m.spectator && m.connected).length,
        members: room.members.map((m) => ({
          id: m.id,
          name: m.name,
          connected: m.connected,
          left: this.isLeft(room, m.id),
          spectator: !!m.spectator,
          wantsToPlay: !!m.wantsToPlay,
          ...(m.bot ? { bot: { level: m.bot.level } } : {}),
        })),
      },
      game: room.game ? viewFor(room.game, playerId) : null,
    };
  }

  snapshot(): RoomSnapshot[] {
    return [...this.rooms.values()].map(({ code, hostId, members, game, target, lastActivity }) => ({
      code,
      hostId,
      members,
      game,
      target,
      lastActivity,
    }));
  }

  /** Loads rooms from a snapshot; nobody is connected until their client rejoins. */
  restore(snapshots: RoomSnapshot[]): void {
    for (const s of snapshots) {
      this.rooms.set(s.code, {
        ...s,
        target: s.target ?? DEFAULT_TARGET,
        members: s.members.map((m) => ({ ...m, connected: !!m.bot })),
        lastActivity: this.now(),
        hostGraceUntil: this.now() + HOST_GRACE_MS,
      });
    }
  }

  botViews(code: string): { id: string; level: BotLevel; view: PlayerView }[] {
    const room = this.rooms.get(normalizeCode(code));
    const game = room?.game;
    if (!room || !game) return [];
    return room.members
      .filter((m) => m.bot && !this.isLeft(room, m.id))
      .map((m) => ({ id: m.id, level: m.bot!.level, view: viewFor(game, m.id) }));
  }

  roomCodes(): string[] {
    return [...this.rooms.keys()];
  }

  sweep(): number {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      const idle = this.now() - room.lastActivity > ROOM_TTL_MS;
      if (idle && !room.members.some((m) => !m.bot && !m.spectator && m.connected)) {
        this.rooms.delete(code);
        removed++;
      }
    }
    if (removed > 0) this.onChange?.();
    return removed;
  }
}
