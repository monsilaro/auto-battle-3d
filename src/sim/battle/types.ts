import type { AbilityDef } from '../../data/types';
import type { SimEvent } from '../events';

export type Team = 0 | 1; // 0 = player warband, 1 = horde

export interface UnitState {
  id: number; // stable index into BattleState.units
  defId: string;
  team: Team;
  x: number;
  z: number;
  prevX: number; // position at previous tick start — render lerps prev→curr
  prevZ: number;
  hp: number;
  maxHp: number;
  armor: number;
  damage: number;
  baseCooldownTicks: number;
  rangeM: number;
  moveSpeed: number;
  radius: number;
  piercing: boolean;
  ability?: AbilityDef;
  alive: boolean;
  targetId: number; // -1 = none
  cooldown: number; // ticks until next attack allowed
  attackCount: number;
  rageFired: boolean;
  rageMult: number; // 1 until rage fires
  buffAsTicks: number; // Reaper's Due temp attack-speed buff
  buffAsMult: number;
  fearTicks: number; // > 0 → fleeing, cannot attack
  periodicTimer: number; // periodic heal / summon countdown
  moving: boolean; // render hint, set each tick
}

export interface BattleState {
  tick: number;
  rngState: number;
  units: UnitState[];
  status: 'running' | 'victory' | 'defeat';
  events: SimEvent[]; // this tick's events; cleared at each tick start
  usedActives: string[]; // active blessing ids already consumed
  queuedActives: string[]; // applied at start of next tick
  enemyKills: number;
  playerDeaths: number;
  damageByDef: Record<string, number>; // player damage per unit def (run summary; never iterated by sim)
  reapers: { attackSpeedMult: number; durTicks: number } | null;
}

export interface UnitStats {
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
}

export function createUnitState(id: number, team: Team, stats: UnitStats, x: number, z: number): UnitState {
  const ab = stats.ability;
  return {
    id,
    defId: stats.defId,
    team,
    x,
    z,
    prevX: x,
    prevZ: z,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    armor: stats.armor,
    damage: stats.damage,
    baseCooldownTicks: stats.attackCooldownTicks,
    rangeM: stats.rangeM,
    moveSpeed: stats.moveSpeed,
    radius: stats.radius,
    piercing: stats.piercing,
    ability: ab,
    alive: true,
    targetId: -1,
    cooldown: 0,
    attackCount: 0,
    rageFired: false,
    rageMult: 1,
    buffAsTicks: 0,
    buffAsMult: 1,
    fearTicks: 0,
    periodicTimer:
      ab && (ab.trigger === 'periodic' || ab.trigger === 'periodicSummon') ? ab.ticks : 0,
    moving: false,
  };
}

export function effectiveCooldownTicks(u: UnitState): number {
  const mult = u.rageMult * (u.buffAsTicks > 0 ? u.buffAsMult : 1);
  return Math.max(1, Math.round(u.baseCooldownTicks / mult));
}

// Center-to-center distance at which `a` can strike `b`.
export function attackReach(a: UnitState, b: UnitState): number {
  return a.rangeM + a.radius + b.radius;
}

export function distSq(a: UnitState, b: UnitState): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}
