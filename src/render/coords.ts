import { HEX_WORLD_SIZE, VILLAGE_BATTLE_ORIGIN } from '../data/balance';
import { CELLS, cellIndexAt, GRID_RADIUS, hexToLocal } from '../sim/village';

// World layout of the diorama island. Battle-space maps 1:1 into world space
// at BATTLE_ORIGIN; the village origin is DERIVED from the sim's battle-space
// constants so sim spawn positions and rendered buildings always align.

export const HEX_SIZE = HEX_WORLD_SIZE;
export const BATTLE_ORIGIN = { x: -2, z: -10 };
export const VILLAGE_ORIGIN = {
  x: BATTLE_ORIGIN.x + VILLAGE_BATTLE_ORIGIN.x,
  z: BATTLE_ORIGIN.z + VILLAGE_BATTLE_ORIGIN.z,
};

const SQRT3 = Math.sqrt(3);

export function hexToWorld(q: number, r: number): { x: number; z: number } {
  const p = hexToLocal(q, r);
  return { x: VILLAGE_ORIGIN.x + p.x, z: VILLAGE_ORIGIN.z + p.z };
}

export function cellToWorld(cellIndex: number): { x: number; z: number } {
  const c = CELLS[cellIndex];
  return hexToWorld(c.q, c.r);
}

// Inverse: world position → cell index, or -1 outside the village.
export function worldToCell(x: number, z: number): number {
  const lx = (x - VILLAGE_ORIGIN.x) / HEX_SIZE;
  const lz = (z - VILLAGE_ORIGIN.z) / HEX_SIZE;
  const qf = (2 / 3) * lx;
  const rf = (-1 / 3) * lx + (SQRT3 / 3) * lz;
  const [q, r] = axialRound(qf, rf);
  if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > GRID_RADIUS) return -1;
  return cellIndexAt(q, r);
}

function axialRound(qf: number, rf: number): [number, number] {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q, r];
}

export function battleToWorld(simX: number, simZ: number): { x: number; z: number } {
  return { x: BATTLE_ORIGIN.x + simX, z: BATTLE_ORIGIN.z + simZ };
}

// Flat-top hex corner offsets (unit size), for outlines/decals.
export const HEX_CORNERS: readonly { x: number; z: number }[] = [
  { x: 1, z: 0 },
  { x: 0.5, z: SQRT3 / 2 },
  { x: -0.5, z: SQRT3 / 2 },
  { x: -1, z: 0 },
  { x: -0.5, z: -SQRT3 / 2 },
  { x: 0.5, z: -SQRT3 / 2 },
];
