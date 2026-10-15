import { mkdtempSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPersistence } from './persist';
import { RoomManager } from './rooms';
import { seeded } from '../shared/testUtils';

const tmp = () => path.join(mkdtempSync(path.join(tmpdir(), 'skyjo-')), 'data', 'rooms.json');

describe('persistence', () => {
  it('writes a snapshot atomically (private file) and loads it into a fresh manager', () => {
    const file = tmp();
    const m = new RoomManager(seeded(1));
    const h = m.create('Anna');
    m.join(h.code, 'Ben');
    const p = createPersistence(m, file);
    p.flush();
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1);

    const m2 = new RoomManager(seeded(1));
    expect(createPersistence(m2, file).load()).toBe(1);
    expect(m2.stateFor(h.code, h.playerId).room.members).toHaveLength(2);
  });

  it('starts empty when the file is missing or corrupt', () => {
    const file = tmp();
    const m = new RoomManager(seeded(1));
    expect(createPersistence(m, file).load()).toBe(0);
    createPersistence(new RoomManager(seeded(1)), file).flush();
    writeFileSync(file, '{not json');
    expect(createPersistence(m, file).load()).toBe(0);
    writeFileSync(file, JSON.stringify({ version: 99, rooms: [] }));
    expect(createPersistence(m, file).load()).toBe(0);
  });

  it('debounces saves triggered by manager changes', async () => {
    const file = tmp();
    const m = new RoomManager(seeded(1));
    const p = createPersistence(m, file, 20);
    m.onChange = p.schedule;
    m.create('Anna');
    m.create('Ben');
    await new Promise((r) => setTimeout(r, 80));
    expect(JSON.parse(readFileSync(file, 'utf8')).rooms).toHaveLength(2);
  });
});
