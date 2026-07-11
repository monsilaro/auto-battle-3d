import { describe, expect, it } from 'vitest';
import {
  CELL_COUNT,
  CELLS,
  cellIndexAt,
  computeAdjacency,
  NEIGHBORS,
} from '../src/sim/village';
import { deriveWarband } from '../src/sim/warband';

function emptyGrid(): (string | null)[] {
  return new Array(CELL_COUNT).fill(null);
}

describe('hex grid', () => {
  it('has 37 cells (radius-3 hexagon)', () => {
    expect(CELL_COUNT).toBe(37);
    expect(CELLS.length).toBe(37);
  });

  it('center cell has 6 neighbors, corners have 3', () => {
    expect(NEIGHBORS[cellIndexAt(0, 0)].length).toBe(6);
    for (const [q, r] of [
      [3, -3],
      [3, 0],
      [0, 3],
      [-3, 0],
      [-3, 3],
      [0, -3],
    ]) {
      expect(NEIGHBORS[cellIndexAt(q, r)].length).toBe(3);
    }
  });
});

describe('adjacency resolution', () => {
  it('adjacent hovels grant each other +1 gold income', () => {
    const grid = emptyGrid();
    const a = cellIndexAt(0, 0);
    const b = cellIndexAt(1, 0);
    grid[a] = 'hovel';
    grid[b] = 'hovel';
    const bonuses = computeAdjacency(grid);
    expect(bonuses[a].incomeGold).toBe(1);
    expect(bonuses[b].incomeGold).toBe(1);
  });

  it('cinder forge aura buffs adjacent unit-building damage by 10%', () => {
    const grid = emptyGrid();
    const yard = cellIndexAt(0, 0);
    grid[yard] = 'mustering_yard';
    grid[cellIndexAt(1, 0)] = 'cinder_forge';
    const bonuses = computeAdjacency(grid);
    expect(bonuses[yard].damagePct).toBe(10);
    // Forge itself grants no units — no incoming aura bonus tracked for it.
    expect(bonuses[cellIndexAt(1, 0)].damagePct).toBe(0);
  });

  it('sellsword post gains +1 sellsword next to a hovel (non-stacking)', () => {
    const grid = emptyGrid();
    const post = cellIndexAt(0, 0);
    grid[post] = 'sellsword_post';
    grid[cellIndexAt(1, 0)] = 'hovel';
    grid[cellIndexAt(0, 1)] = 'hovel';
    const bonuses = computeAdjacency(grid);
    expect(bonuses[post].extraUnits).toEqual([{ defId: 'sellsword', count: 1 }]);
  });

  it('iron keep next to forge: +15% hp (self rule) and +10% dmg (aura)', () => {
    const grid = emptyGrid();
    const keep = cellIndexAt(0, 0);
    grid[keep] = 'iron_keep';
    grid[cellIndexAt(1, 0)] = 'cinder_forge';
    const bonuses = computeAdjacency(grid);
    expect(bonuses[keep].maxHpPct).toBe(15);
    expect(bonuses[keep].damagePct).toBe(10);
  });
});

describe('warband derivation', () => {
  it('yard next to forge fields 3 spearmen with buffed damage', () => {
    const grid = emptyGrid();
    grid[cellIndexAt(0, 0)] = 'mustering_yard';
    grid[cellIndexAt(1, 0)] = 'cinder_forge';
    const roster = deriveWarband(grid, []);
    expect(roster.length).toBe(3);
    for (const r of roster) {
      expect(r.defId).toBe('levy_spear');
      expect(r.damage).toBe(7); // round(6 * 1.10)
      expect(r.maxHp).toBe(60);
    }
  });

  it('passive blessings stack with adjacency', () => {
    const grid = emptyGrid();
    grid[cellIndexAt(0, 0)] = 'mustering_yard';
    const roster = deriveWarband(grid, ['bone_ward', 'pale_vigor']);
    for (const r of roster) {
      expect(r.armor).toBe(3); // 1 base + 2
      expect(r.maxHp).toBe(67); // round(60 * 1.12)
    }
  });
});
