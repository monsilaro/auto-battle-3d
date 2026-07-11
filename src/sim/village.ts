import { buildingDef } from '../data/buildings';
import { HEX_WORLD_SIZE, VILLAGE_BATTLE_ORIGIN } from '../data/balance';

// Hexagonal village grid — axial coordinates (q, r), flat-top, radius 3
// hexagon = 37 cells. Cell order is fixed and deterministic; all sim
// iteration uses this index order.

export const GRID_RADIUS = 3;

export interface HexCell {
  q: number;
  r: number;
}

function generateCells(radius: number): HexCell[] {
  const cells: HexCell[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) cells.push({ q, r });
  }
  return cells;
}

export const CELLS: readonly HexCell[] = generateCells(GRID_RADIUS);
export const CELL_COUNT = CELLS.length; // 37

const indexByKey = new Map<string, number>();
CELLS.forEach((c, i) => indexByKey.set(`${c.q},${c.r}`, i));

export function cellIndexAt(q: number, r: number): number {
  const i = indexByKey.get(`${q},${r}`);
  return i === undefined ? -1 : i;
}

const HEX_DIRS: readonly HexCell[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// Per-cell sorted neighbor indices (2–6 entries each).
export const NEIGHBORS: readonly (readonly number[])[] = CELLS.map((c) => {
  const ns: number[] = [];
  for (const d of HEX_DIRS) {
    const i = cellIndexAt(c.q + d.q, c.r + d.r);
    if (i >= 0) ns.push(i);
  }
  ns.sort((a, b) => a - b);
  return ns;
});

// ── Spatial layout (flat-top axial → local XZ) ──────────────────────
// Pure arithmetic (sqrt only) so the sim can spawn units at their source
// building. The render layer uses the same math for world placement.

const SQRT3 = Math.sqrt(3);

export function hexToLocal(q: number, r: number): { x: number; z: number } {
  return {
    x: HEX_WORLD_SIZE * 1.5 * q,
    z: HEX_WORLD_SIZE * SQRT3 * (r + q / 2),
  };
}

// Cell position in battle-space (village sits west of the battlefield).
export function cellBattlePos(cellIndex: number): { x: number; z: number } {
  const c = CELLS[cellIndex];
  const p = hexToLocal(c.q, c.r);
  return { x: VILLAGE_BATTLE_ORIGIN.x + p.x, z: VILLAGE_BATTLE_ORIGIN.z + p.z };
}

// ── Adjacency resolution ────────────────────────────────────────────
// Recomputed from scratch on every placement/sale — no incremental state.

export interface CellBonus {
  incomeGold: number;
  incomeIchor: number;
  extraUnits: { defId: string; count: number }[];
  damagePct: number; // applies to units granted by this cell's building
  maxHpPct: number;
}

function emptyBonus(): CellBonus {
  return { incomeGold: 0, incomeIchor: 0, extraUnits: [], damagePct: 0, maxHpPct: 0 };
}

function isUnitBuilding(defId: string | null): boolean {
  if (!defId) return false;
  const def = buildingDef(defId);
  return !!def.grantsUnits && def.grantsUnits.length > 0;
}

export function computeAdjacency(grid: readonly (string | null)[]): CellBonus[] {
  const bonuses: CellBonus[] = grid.map(() => emptyBonus());

  for (let i = 0; i < grid.length; i++) {
    const defId = grid[i];
    if (!defId) continue;
    const def = buildingDef(defId);
    const bonus = bonuses[i];

    // Own adjacency rules — conditional on neighbors.
    if (def.adjacency) {
      for (const rule of def.adjacency) {
        let matches = 0;
        for (const n of NEIGHBORS[i]) {
          const nId = grid[n];
          if (!nId) continue;
          if (rule.neighborId === 'anyUnitBuilding' ? isUnitBuilding(nId) : nId === rule.neighborId) {
            matches++;
          }
        }
        const times = rule.perNeighbor ? matches : matches > 0 ? 1 : 0;
        if (times === 0) continue;
        const e = rule.effect;
        if (e.kind === 'income') {
          bonus.incomeGold += (e.gold ?? 0) * times;
          bonus.incomeIchor += (e.ichor ?? 0) * times;
        } else if (e.kind === 'grantUnits') {
          bonus.extraUnits.push({ defId: e.defId, count: e.count * times });
        } else {
          if (e.stat === 'damage') bonus.damagePct += e.pct * times;
          else bonus.maxHpPct += e.pct * times;
        }
      }
    }

    // Incoming auras from neighbors — only affect unit-granting buildings.
    if (isUnitBuilding(defId)) {
      for (const n of NEIGHBORS[i]) {
        const nId = grid[n];
        if (!nId) continue;
        const nDef = buildingDef(nId);
        if (!nDef.aura) continue;
        if (nDef.aura.stat === 'damage') bonus.damagePct += nDef.aura.pct;
        else bonus.maxHpPct += nDef.aura.pct;
      }
    }
  }

  return bonuses;
}
