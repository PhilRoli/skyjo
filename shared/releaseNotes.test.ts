import { describe, expect, it } from 'vitest';
import { RELEASE_NOTES } from './releaseNotes';

const parts = (v: string) => v.split('.').map(Number);

describe('release notes', () => {
  it('lists releases newest first with semver versions and at least one item each', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThan(0);
    for (const r of RELEASE_NOTES) {
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.items.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < RELEASE_NOTES.length; i++) {
      const [a, b] = [parts(RELEASE_NOTES[i - 1].version), parts(RELEASE_NOTES[i].version)];
      const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
      expect(newer).toBeGreaterThan(0);
    }
  });

  it('has the spectator and bot release as 1.3.0 below 1.3.1 and everything before it as 1.2.0', () => {
    expect(RELEASE_NOTES.map((r) => r.version).slice(0, 12)).toEqual(['1.6.5', '1.6.4', '1.6.3', '1.6.2', '1.6.1', '1.6.0', '1.5.1', '1.5.0', '1.4.0', '1.3.1', '1.3.0', '1.2.0']);
    expect(RELEASE_NOTES[10].items.join(' ')).toMatch(/Zuschauer/);
    expect(RELEASE_NOTES[10].items.join(' ')).toMatch(/Bot/);
  });
});
