import { io, type Socket } from 'socket.io-client';
import type { ClientState } from '../shared/view';

export interface Bot {
  name: string;
  socket: Socket;
  states: ClientState[];
  last: () => ClientState | null;
  request: (event: string, payload?: object) => Promise<any>;
  session: { code: string; token: string } | null;
}

/** A client that plays by itself: draw, discard, flip. The host also starts new rounds. */
export function connectBot(url: string, name: string): Bot {
  const socket = io(url, { transports: ['websocket'], forceNew: true, reconnectionDelay: 200, reconnectionDelayMax: 500 });
  const bot: Bot = {
    name,
    socket,
    states: [],
    last: () => bot.states.at(-1) ?? null,
    // An ack can get lost when the server dies mid-request; never let that block a bot.
    request: (event, payload = {}) =>
      new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), 3000);
        socket.emit(event, payload, (res: unknown) => {
          clearTimeout(timer);
          resolve(res);
        });
      }),
    session: null,
  };

  // Like the real client: every (re)connect tries to rejoin the stored session.
  socket.on('connect', () => {
    if (bot.session) void bot.request('room:rejoin', bot.session);
  });

  // Acts on the newest state; if more states arrived while an action was in flight, look again.
  let busy = false;
  const step = async (): Promise<boolean> => {
    const st = bot.last();
    if (!st?.game) return false;
    const g = st.game;
    const me = g.players.find((p) => p.id === g.me);
    if (!me) return false; // spectator: just watch
    const hidden = me.grid.flatMap((c, i) => (c && !c.up ? [i] : []));
    const up = me.grid.filter((c) => c?.up).length;
    const act = (a: object) => bot.request('game:action', a);
    if (g.phase === 'initialFlip' && up < 2) await act({ type: 'flipInitial', slot: hidden[0] });
    else if (g.current === g.me && g.phase === 'draw') await act({ type: 'drawFromDeck' });
    else if (g.current === g.me && g.phase === 'place') await act({ type: 'discardDrawn' });
    else if (g.current === g.me && g.phase === 'flipAfterDiscard') await act({ type: 'flipHidden', slot: hidden[0] });
    else if (g.phase === 'roundOver' && st.room.hostId === g.me) await bot.request('game:next');
    else return false;
    return true;
  };
  socket.on('state', async (st: ClientState) => {
    bot.states.push(st);
    if (busy) return;
    busy = true;
    try {
      let seen = -1;
      while (seen !== bot.states.length) {
        seen = bot.states.length;
        await step();
      }
    } finally {
      busy = false;
    }
  });
  return bot;
}

export async function waitFor<T>(fn: () => T | undefined | null | false, timeoutMs: number, what: string): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}
