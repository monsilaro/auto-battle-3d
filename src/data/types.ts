// Shared content-definition types. Pure data — no three.js, no DOM.

export type AbilityDef =
  | { trigger: 'everyNthAttack'; n: number; kind: 'cleave'; radius: number; pct: number }
  | { trigger: 'periodic'; ticks: number; kind: 'healLowest'; amount: number; rangeM: number }
  | { trigger: 'onHpBelowPct'; pct: number; kind: 'rage'; attackSpeedMult: number }
  | { trigger: 'periodicSummon'; ticks: number; defId: string; count: number };

export interface UnitDef {
  id: string;
  name: string;
  maxHp: number;
  armor: number;
  damage: number;
  attackCooldownTicks: number; // 20 ticks = 1.0 s
  rangeM: number; // 1.2 = melee reach beyond body radii
  moveSpeed: number; // m/s
  radius: number; // body/collision radius, m
  piercing?: boolean; // ignores armor
  ability?: AbilityDef;
  model: string; // render-only
}

export type AdjacencyRule = {
  neighborId: string | 'anyUnitBuilding';
  perNeighbor: boolean; // true = stacks per matching neighbor, false = once if any
  effect:
    | { kind: 'income'; gold?: number; ichor?: number }
    | { kind: 'grantUnits'; defId: string; count: number }
    | { kind: 'selfUnitStat'; stat: 'damage' | 'maxHp'; pct: number };
};

export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  costGold: number;
  unlockRound: number;
  grantsUnits?: { defId: string; count: number }[];
  incomeGold?: number;
  incomeIchor?: number;
  adjacency?: AdjacencyRule[];
  // Outgoing aura: buffs units granted by ADJACENT unit-buildings.
  aura?: { stat: 'damage' | 'maxHp'; pct: number };
  model: string;
}

export type BlessingDef = {
  id: string;
  name: string;
  costIchor: number;
  desc: string;
} & (
  | {
      kind: 'passive';
      passive:
        | { type: 'stat'; stat: 'armor' | 'maxHpPct' | 'damagePct'; amount: number }
        | { type: 'reapersDue'; attackSpeedMult: number; durTicks: number }
        | { type: 'crimsonHarvest'; killsPerGold: number };
    }
  | {
      kind: 'active';
      active:
        | { type: 'firestorm'; damage: number; radius: number }
        | { type: 'fear'; radius: number; durTicks: number };
    }
);

export interface WaveDef {
  round: number; // 1..10
  spawns: { defId: string; count: number }[];
  goldReward: number;
  ichorReward: number;
}
