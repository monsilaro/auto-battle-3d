import type { AbilityDef } from '../data/types';
import { unitDef } from '../data/units';
import { buildingDef } from '../data/buildings';
import { blessingDef } from '../data/blessings';
import { computeAdjacency } from './village';

// Derives the player's battle roster from the village. Fully recomputed at
// battle start — units carry no state between rounds.

export interface RosterEntry {
  defId: string;
  maxHp: number;
  armor: number;
  damage: number;
  attackCooldownTicks: number;
  rangeM: number;
  moveSpeed: number;
  radius: number;
  piercing: boolean;
  ability?: AbilityDef;
  sourceCell: number; // -1 for enemies
}

export function deriveWarband(
  grid: readonly (string | null)[],
  blessings: readonly string[],
): RosterEntry[] {
  const bonuses = computeAdjacency(grid);

  let blessArmor = 0;
  let blessHpPct = 0;
  let blessDmgPct = 0;
  for (const id of blessings) {
    const b = blessingDef(id);
    if (b.kind !== 'passive' || b.passive.type !== 'stat') continue;
    if (b.passive.stat === 'armor') blessArmor += b.passive.amount;
    else if (b.passive.stat === 'maxHpPct') blessHpPct += b.passive.amount;
    else blessDmgPct += b.passive.amount;
  }

  const roster: RosterEntry[] = [];
  for (let i = 0; i < grid.length; i++) {
    const defId = grid[i];
    if (!defId) continue;
    const def = buildingDef(defId);
    const bonus = bonuses[i];

    const grants = [...(def.grantsUnits ?? []), ...bonus.extraUnits];
    for (const g of grants) {
      const u = unitDef(g.defId);
      const hpPct = bonus.maxHpPct + blessHpPct;
      const dmgPct = bonus.damagePct + blessDmgPct;
      for (let k = 0; k < g.count; k++) {
        roster.push({
          defId: u.id,
          maxHp: Math.max(1, Math.round(u.maxHp * (1 + hpPct / 100))),
          armor: u.armor + blessArmor,
          damage: Math.max(1, Math.round(u.damage * (1 + dmgPct / 100))),
          attackCooldownTicks: u.attackCooldownTicks,
          rangeM: u.rangeM,
          moveSpeed: u.moveSpeed,
          radius: u.radius,
          piercing: !!u.piercing,
          ability: u.ability,
          sourceCell: i,
        });
      }
    }
  }
  return roster;
}

export function enemyRoster(spawns: readonly { defId: string; count: number }[]): RosterEntry[] {
  const roster: RosterEntry[] = [];
  for (const s of spawns) {
    const u = unitDef(s.defId);
    for (let k = 0; k < s.count; k++) {
      roster.push({
        defId: u.id,
        maxHp: u.maxHp,
        armor: u.armor,
        damage: u.damage,
        attackCooldownTicks: u.attackCooldownTicks,
        rangeM: u.rangeM,
        moveSpeed: u.moveSpeed,
        radius: u.radius,
        piercing: !!u.piercing,
        ability: u.ability,
        sourceCell: -1,
      });
    }
  }
  return roster;
}
