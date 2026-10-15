import { canAct, decide, newBotMemory, observe, type BotMemory } from '../shared/bot';
import type { Rng } from '../shared/types';
import type { RoomManager } from './rooms';

export interface BotRunnerOptions {
  /** Pause before every bot move, so humans can follow what happens. */
  delayMs?: number;
  rng?: Rng;
  onError?: (e: unknown) => void;
}

/** Plays the bots of all rooms. It only ever acts through `manager.act`, like a human would. */
export class BotRunner {
  private memories = new Map<string, BotMemory>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private delayMs: number;
  private rng: Rng;
  private onError: (e: unknown) => void;

  constructor(
    private manager: RoomManager,
    opts: BotRunnerOptions = {},
  ) {
    this.delayMs = opts.delayMs ?? 900;
    this.rng = opts.rng ?? Math.random;
    this.onError = opts.onError ?? ((e) => console.error('bot move failed', e));
  }

  /** Call after every change of a room. */
  notify(code: string): void {
    const bots = this.manager.botViews(code);
    if (bots.length === 0) {
      this.forget(code);
      return;
    }
    bots.forEach(({ id, view }, index) => {
      const key = `${code}:${id}`;
      const mem = this.memory(key);
      observe(mem, view);
      if (this.timers.has(key) || !canAct(view)) return;
      const delay = view.phase === 'initialFlip' ? Math.min(this.delayMs, 200) * (index + 1) : this.delayMs;
      const timer = setTimeout(() => this.run(code, id), delay);
      timer.unref?.();
      this.timers.set(key, timer);
    });
  }

  /** Picks up pending bot moves, e.g. after rooms were restored from disk. */
  resumeAll(): void {
    for (const code of this.manager.roomCodes()) this.notify(code);
  }

  dispose(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.memories.clear();
  }

  private memory(key: string): BotMemory {
    let mem = this.memories.get(key);
    if (!mem) {
      mem = newBotMemory();
      this.memories.set(key, mem);
    }
    return mem;
  }

  private forget(code: string): void {
    for (const key of [...this.timers.keys()]) {
      if (key.startsWith(`${code}:`)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
    }
    for (const key of [...this.memories.keys()]) if (key.startsWith(`${code}:`)) this.memories.delete(key);
  }

  private run(code: string, id: string): void {
    const key = `${code}:${id}`;
    this.timers.delete(key);
    const entry = this.manager.botViews(code).find((b) => b.id === id);
    if (!entry) return;
    const mem = this.memory(key);
    observe(mem, entry.view);
    const action = decide(entry.view, entry.level, this.rng, mem);
    if (!action) return;
    try {
      this.manager.act(code, id, action);
    } catch (e) {
      this.onError(e);
    }
  }
}
