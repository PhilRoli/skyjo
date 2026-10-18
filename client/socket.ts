import { io } from 'socket.io-client';

export const socket = io();

export function request<T extends object = Record<string, never>>(
  event: string,
  payload: object = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (res: { ok: boolean; error?: string }) => {
      if (res?.ok) resolve(res as T);
      else reject(new Error(res?.error ?? 'UNKNOWN'));
    });
  });
}

const KEY = 'skyjo-session';
export interface Session {
  code: string;
  token: string;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the game still works, reload just won't restore it */
  }
}
