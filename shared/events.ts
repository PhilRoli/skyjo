import type { GameEvent } from './types';

/** Minimal translate function (matches i18next's `t`), so shared code stays free of UI libraries. */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

function verb(e: GameEvent, t: Translate): string {
  switch (e.kind) {
    case 'draw':
      return t('events.draw');
    case 'takeDiscard':
      return t('events.takeDiscard', { value: e.value });
    case 'swap':
      return t('events.swap', { replaced: e.replaced, value: e.value });
    case 'discard':
      return t('events.discard', { value: e.value });
    case 'flip':
      return t('events.flip', { value: e.value });
    case 'clear':
      return t('events.clear', { value: e.value });
  }
}

/** One readable line; the player's name is only repeated when the actor changes. */
export function describeEvents(events: GameEvent[], nameOf: (id: string) => string, t: Translate): string {
  let last: string | null = null;
  return events
    .map((e) => {
      const action = verb(e, t);
      const text = e.by === last ? action : t('events.named', { name: nameOf(e.by), action });
      last = e.by;
      return text;
    })
    .join(', ');
}
