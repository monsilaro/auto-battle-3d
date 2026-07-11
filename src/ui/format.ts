import type { AbilityDef, AdjacencyRule, BuildingDef, UnitDef } from '../data/types';
import { unitDef } from '../data/units';
import { buildingDef } from '../data/buildings';
import { TICK_MS } from '../data/balance';

// Human-readable text for defs — single source for tooltips and cards.

export function attacksPerSecond(def: UnitDef): string {
  return (1000 / (def.attackCooldownTicks * TICK_MS)).toFixed(1);
}

export function abilityText(ab: AbilityDef | undefined): string | null {
  if (!ab) return null;
  switch (ab.trigger) {
    case 'everyNthAttack':
      return `Every ${ab.n}${ordinal(ab.n)} attack: cleaves nearby enemies for ${ab.pct}% damage.`;
    case 'periodic':
      return `Every ${((ab.ticks * TICK_MS) / 1000).toFixed(1)}s: heals the most wounded ally for ${ab.amount}.`;
    case 'onHpBelowPct':
      return `Below ${ab.pct}% HP: rages, attack speed ×${ab.attackSpeedMult}.`;
    case 'periodicSummon':
      return `Every ${((ab.ticks * TICK_MS) / 1000).toFixed(0)}s: raises ${ab.count} ${unitDef(ab.defId).name}s from the ground.`;
  }
}

function ordinal(n: number): string {
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

export function adjacencyText(rule: AdjacencyRule): string {
  const neighbor =
    rule.neighborId === 'anyUnitBuilding'
      ? 'a unit-building'
      : buildingDef(rule.neighborId).name;
  const per = rule.perNeighbor ? 'each adjacent' : 'adjacent to';
  const e = rule.effect;
  let effect: string;
  if (e.kind === 'income') {
    const parts = [];
    if (e.gold) parts.push(`+${e.gold} Gold`);
    if (e.ichor) parts.push(`+${e.ichor} Ichor`);
    effect = `${parts.join(', ')} per round won`;
  } else if (e.kind === 'grantUnits') {
    effect = `fields +${e.count} ${unitDef(e.defId).name}`;
  } else {
    effect = `its units gain +${e.pct}% ${e.stat === 'damage' ? 'damage' : 'HP'}`;
  }
  return rule.perNeighbor ? `For ${per} ${neighbor}: ${effect}.` : `If ${per} ${neighbor}: ${effect}.`;
}

export function buildingRules(def: BuildingDef): string[] {
  const lines: string[] = [];
  if (def.grantsUnits) {
    for (const g of def.grantsUnits) lines.push(`Fields ${g.count}× ${unitDef(g.defId).name}.`);
  }
  if (def.incomeGold) lines.push(`+${def.incomeGold} Gold per round won.`);
  if (def.incomeIchor) lines.push(`+${def.incomeIchor} Ichor per round won.`);
  if (def.aura) {
    lines.push(`Adjacent unit-buildings: units gain +${def.aura.pct}% ${def.aura.stat === 'damage' ? 'damage' : 'HP'}.`);
  }
  if (def.adjacency) for (const rule of def.adjacency) lines.push(adjacencyText(rule));
  return lines;
}
