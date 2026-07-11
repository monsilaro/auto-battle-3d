import type { BattleState } from './types';
import { attackReach, distSq } from './types';

// Crowd-aware targeting. Base rule is still nearest-enemy, but distance is
// penalized by how many allies already attack that target, so the warband
// spreads across the horde instead of dogpiling one victim.
//
// Stickiness: a unit keeps its target while the target lives AND the unit is
// in attack reach. Out-of-reach units re-evaluate on a staggered cadence
// (every 10 ticks, offset by id) so the whole army never flips targets on
// the same tick. O(n²), id-order deterministic.

const CROWD_PENALTY = 0.4;
const RETARGET_PERIOD = 10;

export function targetingPhase(state: BattleState): void {
  const units = state.units;

  // Attackers currently committed to each target.
  const crowd = new Array<number>(units.length).fill(0);
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive || u.targetId < 0) continue;
    const t = units[u.targetId];
    if (t && t.alive) crowd[u.targetId]++;
  }

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive) continue;
    if (u.fearTicks > 0) continue; // fleeing units don't pick targets

    const current = u.targetId >= 0 ? units[u.targetId] : null;
    const currentValid = !!(current && current.alive);
    if (currentValid) {
      const reach = attackReach(u, current) + 0.1;
      const inReach = distSq(u, current) <= reach * reach;
      // Committed in melee — never swap. Marching — reconsider occasionally.
      if (inReach || (state.tick + i) % RETARGET_PERIOD !== 0) continue;
    }

    let best = -1;
    let bestScore = Infinity;
    for (let j = 0; j < units.length; j++) {
      const other = units[j];
      if (!other.alive || other.team === u.team) continue;
      const score = distSq(u, other) * (1 + CROWD_PENALTY * crowd[j]);
      if (score < bestScore) {
        bestScore = score;
        best = j;
      }
    }
    if (best >= 0 && best !== u.targetId) {
      if (currentValid) crowd[u.targetId]--;
      crowd[best]++;
      u.targetId = best;
    }
  }
}
