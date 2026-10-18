import { describe, expect, it } from 'vitest';
import { ERROR_CODES, GameError, errorCode } from './errors';

describe('GameError', () => {
  it('uses the code as its message', () => {
    const e = new GameError('ROOM_FULL');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('ROOM_FULL');
    expect(e.message).toBe('ROOM_FULL');
  });

  it('errorCode returns the code of a GameError and UNKNOWN for anything else', () => {
    expect(errorCode(new GameError('HOST_ONLY'))).toBe('HOST_ONLY');
    expect(errorCode(new Error('boom'))).toBe('UNKNOWN');
    expect(errorCode('ROOM_FULL')).toBe('UNKNOWN');
    expect(errorCode(undefined)).toBe('UNKNOWN');
  });

  it('lists every code once', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    expect(ERROR_CODES).toContain('UNKNOWN');
  });
});
