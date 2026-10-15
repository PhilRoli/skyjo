import { useCallback, useEffect, useState } from 'react';
import type { Action } from '../shared/types';
import type { ClientState } from '../shared/view';
import { loadSession, request, saveSession, socket } from './socket';

export function useGame() {
  const [state, setState] = useState<ClientState | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const rejoin = async () => {
      const session = loadSession();
      if (!session) {
        setBooting(false);
        return;
      }
      try {
        await request('room:rejoin', session);
      } catch {
        saveSession(null);
        setState(null);
      } finally {
        setBooting(false);
      }
    };
    const onConnect = () => {
      setConnected(true);
      void rejoin();
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s: ClientState) => setState(s);
    const onKicked = () => {
      saveSession(null);
      setState(null);
      setError('Du wurdest aus dem Raum entfernt');
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    socket.on('kicked', onKicked);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
      socket.off('kicked', onKicked);
    };
  }, []);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      setError(null);
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    }
  }, []);

  const enter = async (event: string, payload: object) => {
    const res = await request<{ code: string; token: string }>(event, payload);
    saveSession({ code: res.code, token: res.token });
  };

  return {
    state,
    connected,
    booting,
    error,
    clearError: () => setError(null),
    create: (name: string) => run(() => enter('room:create', { name })),
    join: (code: string, name: string) => run(() => enter('room:join', { code, name })),
    start: () => run(() => request('game:start')),
    act: (action: Action) => run(() => request('game:action', action)),
    next: () => run(() => request('game:next')),
    rematch: () => run(() => request('game:rematch')),
    remove: (targetId: string) => run(() => request('room:remove', { targetId })),
    leave: async () => {
      try {
        await request('room:leave');
      } catch {
        /* already gone on the server: leaving locally is still right */
      }
      saveSession(null);
      setState(null);
    },
  };
}
