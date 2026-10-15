import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './rooms';

type Ack = (res: { ok: true; [k: string]: unknown } | { ok: false; error: string }) => void;
type SocketData = { code?: string; playerId?: string };

const CREATE_LIMIT = 5;
const CREATE_WINDOW_MS = 60_000;

export function createSkyjoServer(opts: { manager?: RoomManager; staticDir?: string } = {}) {
  const manager = opts.manager ?? new RoomManager();
  const app = express();
  app.get('/healthz', (_req, res) => {
    res.send('ok');
  });
  const dir = opts.staticDir;
  if (dir && existsSync(dir)) {
    app.use(express.static(dir));
    app.use((_req, res) => {
      res.sendFile(path.join(dir, 'index.html'));
    });
  }

  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const personal = (code: string, id: string) => `${code}:${id}`;
  const broadcast = (code: string) => {
    for (const id of manager.memberIds(code)) {
      io.to(personal(code, id)).emit('state', manager.stateFor(code, id));
    }
  };

  io.on('connection', (socket) => {
    const data = socket.data as SocketData;

    const release = (code: string, playerId: string) => {
      const size = io.sockets.adapter.rooms.get(personal(code, playerId))?.size ?? 0;
      if (size > 0) return;
      manager.setConnected(code, playerId, false);
      broadcast(code);
    };

    const attach = (code: string, playerId: string) => {
      const prev = { code: data.code, playerId: data.playerId };
      if (prev.code && prev.playerId && (prev.code !== code || prev.playerId !== playerId)) {
        socket.leave(prev.code);
        socket.leave(personal(prev.code, prev.playerId));
        release(prev.code, prev.playerId);
      }
      data.code = code;
      data.playerId = playerId;
      socket.join(code);
      socket.join(personal(code, playerId));
      manager.setConnected(code, playerId, true);
      broadcast(code);
    };

    const session = () => {
      if (!data.code || !data.playerId) throw new Error('Nicht in einem Raum');
      return { code: data.code, playerId: data.playerId };
    };

    const on = (event: string, handler: (payload: any) => object | void) => {
      socket.on(event, (payload: unknown, rawAck?: unknown) => {
        const ack = typeof rawAck === 'function' ? (rawAck as Ack) : undefined;
        try {
          const extra = handler(payload ?? {}) ?? {};
          ack?.({ ok: true, ...extra });
        } catch (e) {
          try {
            ack?.({ ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler' });
          } catch {
            /* a broken ack must never take the process down */
          }
        }
      });
    };

    const createdAt: number[] = [];
    on('room:create', ({ name }) => {
      const now = Date.now();
      while (createdAt.length && now - createdAt[0] > CREATE_WINDOW_MS) createdAt.shift();
      if (createdAt.length >= CREATE_LIMIT) throw new Error('Zu viele Räume erstellt');
      createdAt.push(now);
      const r = manager.create(name);
      attach(r.code, r.playerId);
      return r;
    });
    on('room:join', ({ code, name }) => {
      const r = manager.join(code, name);
      attach(r.code, r.playerId);
      return r;
    });
    on('room:rejoin', ({ code, token }) => {
      const r = manager.rejoin(code, token);
      attach(r.code, r.playerId);
      return r;
    });
    on('game:start', () => {
      const s = session();
      manager.start(s.code, s.playerId);
      broadcast(s.code);
    });
    on('game:action', (action) => {
      const s = session();
      manager.act(s.code, s.playerId, action);
      broadcast(s.code);
    });
    on('game:next', () => {
      const s = session();
      manager.next(s.code, s.playerId);
      broadcast(s.code);
    });
    on('game:rematch', () => {
      const s = session();
      manager.rematch(s.code, s.playerId);
      broadcast(s.code);
    });
    on('room:remove', ({ targetId }) => {
      const s = session();
      manager.remove(s.code, s.playerId, targetId);
      const target = personal(s.code, targetId);
      io.to(target).emit('kicked');
      io.in(target).socketsLeave([s.code, target]);
      broadcast(s.code);
    });
    on('room:leave', () => {
      const s = session();
      manager.leave(s.code, s.playerId);
      socket.leave(s.code);
      socket.leave(personal(s.code, s.playerId));
      data.code = undefined;
      data.playerId = undefined;
      broadcast(s.code);
    });

    socket.on('disconnect', () => {
      if (!data.code || !data.playerId) return;
      release(data.code, data.playerId);
    });
  });

  return { httpServer, io, manager };
}
