import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RoomManager, RoomSnapshot } from './rooms';

const FORMAT_VERSION = 1;

export function createPersistence(manager: RoomManager, file: string, debounceMs = 1000) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: FORMAT_VERSION, rooms: manager.snapshot() }), { mode: 0o600 });
    renameSync(tmp, file);
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      try {
        flush();
      } catch (e) {
        console.error('persist failed', e);
      }
    }, debounceMs);
    timer.unref?.();
  };

  /** Returns the number of restored rooms; a missing or unreadable file means a fresh start. */
  const load = (): number => {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8')) as { version?: number; rooms?: RoomSnapshot[] };
      if (data.version !== FORMAT_VERSION || !Array.isArray(data.rooms)) return 0;
      manager.restore(data.rooms);
      return data.rooms.length;
    } catch {
      return 0;
    }
  };

  return { flush, schedule, load };
}
