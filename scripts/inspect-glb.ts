// Dev utility: parse a .glb's JSON chunk and print animation clip names,
// mesh count, and rough stats. Usage: npx tsx scripts/inspect-glb.ts <file...>

import { readFileSync } from 'node:fs';

for (const path of process.argv.slice(2)) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) {
    console.log(`${path}: not a GLB`);
    continue;
  }
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const anims = (json.animations ?? []).map((a: { name?: string }) => a.name ?? '?');
  const meshes = (json.meshes ?? []).length;
  const skins = (json.skins ?? []).length;
  const name = path.split(/[\\/]/).pop();
  console.log(`${name}: meshes=${meshes} skins=${skins} anims=${anims.length}`);
  if (anims.length > 0) console.log(`  ${anims.join(', ')}`);
}
