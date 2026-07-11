import { FIELD_H, FIELD_MIN_X, FIELD_W, MELEE_RANGE_THRESHOLD, TICK_DT } from '../../data/balance';
import type { BattleState } from './types';
import { attackReach } from './types';

// Movement with surround behavior: melee units approach a slot on the
// target's circumference (16 fixed directions, chosen by current approach
// side and spread by id) instead of the target's center — attackers fan out
// around the victim rather than stacking into one column. Feared units flee
// toward their own edge. A position-based separation pass then resolves
// body overlap (same-team pairs get extra breathing room).

// Unit vectors at 22.5° steps — literal table, no trig in the sim.
const DIR16: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.92388, 0.38268],
  [0.70711, 0.70711],
  [0.38268, 0.92388],
  [0, 1],
  [-0.38268, 0.92388],
  [-0.70711, 0.70711],
  [-0.92388, 0.38268],
  [-1, 0],
  [-0.92388, -0.38268],
  [-0.70711, -0.70711],
  [-0.38268, -0.92388],
  [0, -1],
  [0.38268, -0.92388],
  [0.70711, -0.70711],
  [0.92388, -0.38268],
];

// Index of the table direction closest to (dx, dz) — argmax of dot product.
function nearestDir(dx: number, dz: number): number {
  let best = 0;
  let bestDot = -Infinity;
  for (let k = 0; k < 16; k++) {
    const d = DIR16[k];
    const dot = d[0] * dx + d[1] * dz;
    if (dot > bestDot) {
      bestDot = dot;
      best = k;
    }
  }
  return best;
}

export function movementPhase(state: BattleState): void {
  const units = state.units;

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive) continue;
    u.moving = false;

    if (u.fearTicks > 0) {
      // Flee toward own spawn edge: player west (-x), horde east (+x).
      const dir = u.team === 0 ? -1 : 1;
      u.x += dir * u.moveSpeed * TICK_DT;
      u.moving = true;
      continue;
    }

    if (u.targetId < 0) continue;
    const t = units[u.targetId];
    if (!t || !t.alive) continue;

    const reach = attackReach(u, t);
    const tdx = t.x - u.x;
    const tdz = t.z - u.z;
    const tDist = Math.sqrt(tdx * tdx + tdz * tdz);
    if (tDist <= reach) continue; // in range — hold and fight

    // Aim point: melee units claim a surround slot; ranged walk straight in.
    let aimX = t.x;
    let aimZ = t.z;
    if (u.rangeM < MELEE_RANGE_THRESHOLD) {
      const side = nearestDir(u.x - t.x, u.z - t.z);
      const spread = (u.id % 3) - 1; // siblings take neighboring slots
      const dir = DIR16[(side + spread + 16) % 16];
      const slotDist = t.radius + u.radius + u.rangeM * 0.5;
      aimX = t.x + dir[0] * slotDist;
      aimZ = t.z + dir[1] * slotDist;
    }

    const dx = aimX - u.x;
    const dz = aimZ - u.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Don't overshoot: stop just inside attack reach of the actual target.
    const desired = Math.min(dist, tDist - reach * 0.9);
    const step = Math.min(u.moveSpeed * TICK_DT, desired);
    if (step <= 0 || dist < 1e-6) continue;
    u.x += (dx / dist) * step;
    u.z += (dz / dist) * step;
    u.moving = true;
  }

  separationPass(state);

  // Clamp to playable area (battlefield + village zone to the west).
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive) continue;
    if (u.x < FIELD_MIN_X + u.radius) u.x = FIELD_MIN_X + u.radius;
    else if (u.x > FIELD_W - u.radius) u.x = FIELD_W - u.radius;
    if (u.z < u.radius - 2) u.z = u.radius - 2;
    else if (u.z > FIELD_H + 2 - u.radius) u.z = FIELD_H + 2 - u.radius;
  }
}

const ALLY_PADDING = 1.15; // same-team pairs keep extra breathing room

function separationPass(state: BattleState): void {
  const units = state.units;
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      if (!b.alive) continue;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const pad = a.team === b.team ? ALLY_PADDING : 1;
      const minDist = (a.radius + b.radius) * pad;
      const dSq = dx * dx + dz * dz;
      if (dSq >= minDist * minDist) continue;
      let dist = Math.sqrt(dSq);
      if (dist < 1e-6) {
        // Exactly stacked — deterministic split along x by id order.
        dx = 0.01;
        dz = 0;
        dist = 0.01;
      }
      const push = (minDist - dist) / 2;
      const nx = dx / dist;
      const nz = dz / dist;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
    }
  }
}
