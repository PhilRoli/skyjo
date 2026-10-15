import type { GameEvent } from './types';

function verb(e: GameEvent): string {
  switch (e.kind) {
    case 'draw':
      return 'zieht eine Karte';
    case 'takeDiscard':
      return `nimmt ${e.value} von der Ablage`;
    case 'swap':
      return `ersetzt ${e.replaced} durch ${e.value}`;
    case 'discard':
      return `legt ${e.value} ab`;
    case 'flip':
      return `deckt ${e.value} auf`;
    case 'clear':
      return `entfernt Spalte (${e.value})`;
  }
}

/** One readable line; the player's name is only repeated when the actor changes. */
export function describeEvents(events: GameEvent[], nameOf: (id: string) => string): string {
  let last: string | null = null;
  return events
    .map((e) => {
      const text = e.by === last ? verb(e) : `${nameOf(e.by)} ${verb(e)}`;
      last = e.by;
      return text;
    })
    .join(', ');
}
