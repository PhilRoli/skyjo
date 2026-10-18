export const ERROR_CODES = [
  'UNKNOWN',
  'ALREADY_PLAYING',
  'ALREADY_REVEALED',
  'BOTS_CANNOT_CHAT',
  'CANNOT_REMOVE_SELF',
  'DECK_EMPTY',
  'DEV_MODE_OFF',
  'DISCARD_EMPTY',
  'GAME_NOT_OVER',
  'GAME_NOT_STARTED',
  'GAME_OVER_REMATCH',
  'GAME_RUNNING',
  'HOST_ONLY',
  'INVALID_ACTION',
  'INVALID_BOT_LEVEL',
  'INVALID_SLOT',
  'INVALID_TARGET',
  'MESSAGE_EMPTY',
  'MUST_SWAP_DISCARD',
  'NAME_LENGTH',
  'NAME_TAKEN',
  'NOT_IN_ROOM',
  'NOT_POSSIBLE_NOW',
  'NOT_YOUR_TURN',
  'NO_NUDGE_BOTS',
  'PICK_HIDDEN',
  'PLAYER_COUNT',
  'PLEASE_WAIT',
  'REMOVED_FROM_GAME',
  'ROOM_FULL',
  'ROOM_NOT_FOUND',
  'ROUND_RUNNING',
  'SELF_TURN',
  'SERVER_FULL',
  'SESSION_EXPIRED',
  'SLOT_EMPTY',
  'SPECTATOR_CANNOT_PLAY',
  'TOO_MANY_MESSAGES',
  'TOO_MANY_ROOMS',
  'TOO_MANY_SPECTATORS',
  'TWO_REVEALED',
  'UNKNOWN_ACTION',
  'UNKNOWN_PLAYER',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Thrown for every expected failure; the message is the code so clients translate it. */
export class GameError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}

export function errorCode(e: unknown): ErrorCode {
  return e instanceof GameError ? e.code : 'UNKNOWN';
}
