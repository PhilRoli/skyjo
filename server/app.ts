import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './rooms';

type Ack = (res: { ok: true; [k: string]: unknown } | { ok: false; error: string }) => void;
type SocketData = { code?: string; playerId?: string };

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

    const attach = (code: string, playerId: string) => {
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
      socket.on(event, (payload: unknown, ack?: Ack) => {
        try {
          const extra = handler(payload ?? {}) ?? {};
          ack?.({ ok: true, ...extra });
        } catch (e) {
          ack?.({ ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler' });
        }
      });
    };

    on('room:create', ({ name }) => {
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
      broadcast(s.code);
    });

    socket.on('disconnect', () => {
      if (!data.code || !data.playerId) return;
      const size = io.sockets.adapter.rooms.get(personal(data.code, data.playerId))?.size ?? 0;
      if (size > 0) return;
      manager.setConnected(data.code, data.playerId, false);
      broadcast(data.code);
    });
  });

  return { httpServer, io, manager };
}
