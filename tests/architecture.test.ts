import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The sim and data layers must stay deterministic and renderer-free.
// Cheap, brutal, effective.

const FORBIDDEN = [
  /from\s+['"]three/,
  /Math\.random/,
  /Date\.now/,
  /performance\.now/,
  /Math\.(sin|cos|tan|atan2|pow|exp|log10?)\s*\(/,
  /document\./,
  /window\./,
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('architecture: sim/data purity', () => {
  const files = [...walk(join(process.cwd(), 'src/sim')), ...walk(join(process.cwd(), 'src/data'))];

  it('finds sim and data files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of walk(join(process.cwd(), 'src/sim'))) {
    it(`sim file is pure: ${file.replaceAll('\\', '/').split('/src/')[1]}`, () => {
      const text = readFileSync(file, 'utf8');
      for (const rx of FORBIDDEN) {
        expect(text).not.toMatch(rx);
      }
    });
  }

  for (const file of walk(join(process.cwd(), 'src/data'))) {
    it(`data file is pure: ${file.replaceAll('\\', '/').split('/src/')[1]}`, () => {
      const text = readFileSync(file, 'utf8');
      for (const rx of FORBIDDEN) {
        expect(text).not.toMatch(rx);
      }
    });
  }
});
