import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import weights from '../shared/extreme/weights.json';

const ROOT = resolve(__dirname, '..');

/** Every local module the client reaches through static or dynamic imports, starting at the entry point. */
function clientModules(): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(ts|tsx)$/.test(file)) return;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const base = resolve(dirname(file), m[1]);
      const hit = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((p) => existsSync(p) && statSync(p).isFile());
      if (!hit) throw new Error(`cannot resolve ${m[1]} from ${file}`);
      visit(hit);
    }
  };
  visit(join(ROOT, 'client/main.tsx'));
  return seen;
}

describe('client bundle', () => {
  it('never imports the extreme bot weights (about 2 MB, server only)', () => {
    const mods = [...clientModules()].map((f) => f.slice(ROOT.length + 1));
    expect(mods).toContain('client/App.tsx');
    expect(mods).toContain('shared/types.ts');
    expect(mods.filter((f) => f.startsWith('shared/extreme/') || f === 'shared/bot.ts')).toEqual([]);
  });

  it('a built client/dist (if present) holds no trace of the weights', () => {
    const dist = join(ROOT, 'client/dist');
    if (!existsSync(dist)) return;
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
    walk(dist);
    const markers = [weights.source, 'actionSize'];
    for (const f of files.filter((x) => /\.(js|json|html)$/.test(x))) {
      const text = readFileSync(f, 'utf8');
      for (const m of markers) expect(text.includes(m), `${m} in ${f}`).toBe(false);
    }
  });
});
