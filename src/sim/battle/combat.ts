import type { BattleState, UnitState } from './types';
import { attackReach, distSq, effectiveCooldownTicks } from './types';

// Damage is applied instantly when a cooldown expires in range — animation
// never gates the sim. The id-order application bias is deterministic and
// accepted.

export function applyDamage(
  state: BattleState,
  attacker: UnitState | null,
  target: UnitState,
  raw: number,
  piercing: boolean,
): void {
  const dmg = Math.max(1, Math.round(raw) - (piercing ? 0 : target.armor));
  target.hp -= dmg;
  state.events.push({ t: 'hit', id: target.id, amount: dmg });
  if (attacker && attacker.team === 0) {
    state.damageByDef[attacker.defId] = (state.damageByDef[attacker.defId] ?? 0) + dmg;
  }
}

export function attackPhase(state: BattleState): void {
  const units = state.units;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive) continue;
    if (u.cooldown > 0) u.cooldown--;
    if (u.fearTicks > 0) continue;
    if (u.cooldown > 0 || u.targetId < 0) continue;
    const t = units[u.targetId];
    if (!t || !t.alive) continue;

    const reach = attackReach(u, t) + 0.1; // slack vs separation jitter
    if (distSq(u, t) > reach * reach) continue;

    u.cooldown = effectiveCooldownTicks(u);
    u.attackCount++;
    state.events.push({ t: 'attack', id: u.id, targetId: t.id });
    applyDamage(state, u, t, u.damage, u.piercing);

    // Cleave: splash around the primary target, excluding it.
    const ab = u.ability;
    if (ab && ab.trigger === 'everyNthAttack' && u.attackCount % ab.n === 0) {
      state.events.push({ t: 'ability', id: u.id, kind: 'cleave' });
      const splash = (u.damage * ab.pct) / 100;
      const rSq = ab.radius * ab.radius;
      for (let j = 0; j < units.length; j++) {
        const v = units[j];
        if (!v.alive || v.team === u.team || v.id === t.id) continue;
        const dx = v.x - t.x;
        const dz = v.z - t.z;
        if (dx * dx + dz * dz <= rSq) applyDamage(state, u, v, splash, u.piercing);
      }
    }
  }
}
