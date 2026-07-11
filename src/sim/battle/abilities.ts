import { unitDef } from '../../data/units';
import { blessingDef } from '../../data/blessings';
import type { BattleState } from './types';
import { createUnitState, distSq } from './types';
import { applyDamage } from './combat';

// Data-driven ability triggers (cleave lives in combat.ts, tied to attacks):
// periodic heal, rage on low HP, periodic summon (boss). Plus active
// blessing effects applied at tick start.

const SUMMON_OFFSETS = [
  [1.5, 0],
  [-1.5, 0],
  [0, 1.5],
  [0, -1.5],
  [1.5, 1.5],
  [-1.5, -1.5],
] as const;

export function abilitiesPhase(state: BattleState): void {
  const units = state.units;
  const count = units.length; // summons spawned this tick act next tick
  for (let i = 0; i < count; i++) {
    const u = units[i];
    if (!u.alive) continue;
    const ab = u.ability;
    if (!ab) continue;

    if (ab.trigger === 'onHpBelowPct') {
      if (!u.rageFired && u.hp < (u.maxHp * ab.pct) / 100) {
        u.rageFired = true;
        u.rageMult = ab.attackSpeedMult;
        state.events.push({ t: 'ability', id: u.id, kind: 'rage' });
      }
      continue;
    }

    if (ab.trigger === 'periodic') {
      u.periodicTimer--;
      if (u.periodicTimer > 0) continue;
      u.periodicTimer = ab.ticks;
      // Heal the most-wounded living ally in range (by hp, ties → lowest id).
      let best = -1;
      let bestHp = Infinity;
      const rSq = ab.rangeM * ab.rangeM;
      for (let j = 0; j < count; j++) {
        const v = units[j];
        if (!v.alive || v.team !== u.team || v.hp >= v.maxHp) continue;
        if (distSq(u, v) > rSq) continue;
        if (v.hp < bestHp) {
          bestHp = v.hp;
          best = j;
        }
      }
      if (best >= 0) {
        const v = units[best];
        const amount = Math.min(ab.amount, v.maxHp - v.hp);
        v.hp += amount;
        state.events.push({ t: 'heal', id: v.id, amount });
        state.events.push({ t: 'ability', id: u.id, kind: 'heal' });
      }
      continue;
    }

    if (ab.trigger === 'periodicSummon') {
      u.periodicTimer--;
      if (u.periodicTimer > 0) continue;
      u.periodicTimer = ab.ticks;
      const def = unitDef(ab.defId);
      const stats = {
        defId: def.id,
        maxHp: def.maxHp,
        armor: def.armor,
        damage: def.damage,
        attackCooldownTicks: def.attackCooldownTicks,
        rangeM: def.rangeM,
        moveSpeed: def.moveSpeed,
        radius: def.radius,
        piercing: !!def.piercing,
        ability: def.ability,
      };
      const ids: number[] = [];
      for (let k = 0; k < ab.count; k++) {
        const [ox, oz] = SUMMON_OFFSETS[k % SUMMON_OFFSETS.length];
        const id = state.units.length;
        state.units.push(createUnitState(id, u.team, stats, u.x + ox, u.z + oz));
        ids.push(id);
      }
      state.events.push({ t: 'summon', ids });
      state.events.push({ t: 'ability', id: u.id, kind: 'summon' });
    }
  }

  // Tick down temp buffs/debuffs.
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (!u.alive) continue;
    if (u.buffAsTicks > 0) u.buffAsTicks--;
    if (u.fearTicks > 0) u.fearTicks--;
  }
}

// Active blessings queued by the player — applied at tick start.
export function applyQueuedActives(state: BattleState): void {
  const queued = state.queuedActives;
  if (queued.length === 0) return;
  for (let q = 0; q < queued.length; q++) {
    const id = queued[q];
    const def = blessingDef(id);
    if (def.kind !== 'active') continue;
    state.usedActives.push(id);
    state.events.push({ t: 'blessing', blessingId: id });

    if (def.active.type === 'firestorm') {
      applyFirestorm(state, def.active.damage, def.active.radius);
    } else {
      applyFear(state, def.active.radius, def.active.durTicks);
    }
  }
  state.queuedActives = [];
}

function applyFirestorm(state: BattleState, damage: number, radius: number): void {
  const units = state.units;
  const rSq = radius * radius;
  // Densest cluster: enemy with most living enemies in radius (ties → lowest id).
  let center = -1;
  let bestCount = -1;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive || u.team !== 1) continue;
    let c = 0;
    for (let j = 0; j < units.length; j++) {
      const v = units[j];
      if (!v.alive || v.team !== 1) continue;
      if (distSq(u, v) <= rSq) c++;
    }
    if (c > bestCount) {
      bestCount = c;
      center = i;
    }
  }
  if (center < 0) return;
  const cu = units[center];
  for (let j = 0; j < units.length; j++) {
    const v = units[j];
    if (!v.alive || v.team !== 1) continue;
    const dx = v.x - cu.x;
    const dz = v.z - cu.z;
    if (dx * dx + dz * dz <= rSq) applyDamage(state, null, v, damage, true);
  }
}

function applyFear(state: BattleState, radius: number, durTicks: number): void {
  const units = state.units;
  // Horde center = centroid of living enemies.
  let cx = 0;
  let cz = 0;
  let n = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive || u.team !== 1) continue;
    cx += u.x;
    cz += u.z;
    n++;
  }
  if (n === 0) return;
  cx /= n;
  cz /= n;
  const rSq = radius * radius;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive || u.team !== 1) continue;
    const dx = u.x - cx;
    const dz = u.z - cz;
    if (dx * dx + dz * dz <= rSq) {
      u.fearTicks = durTicks;
      u.targetId = -1;
    }
  }
}
