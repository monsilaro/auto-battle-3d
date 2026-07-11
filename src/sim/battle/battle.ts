import {
  BATTLE_TIMEOUT_TICKS,
  DEPLOY_COL_SPACING,
  DEPLOY_JITTER,
  DEPLOY_ROWS,
  DEPLOY_ROW_SPACING,
  DEPLOY_Z_MIN,
  ENEMY_BACK_X,
  ENEMY_FRONT_X,
  MELEE_RANGE_THRESHOLD,
} from '../../data/balance';
import { blessingDef } from '../../data/blessings';
import { Rng } from '../rng';
import { cyrb53 } from '../hash';
import type { RosterEntry } from '../warband';
import { cellBattlePos, CELL_COUNT } from '../village';
import type { BattleState, Team, UnitState } from './types';
import { createUnitState } from './types';
import { targetingPhase } from './targeting';
import { movementPhase } from './movement';
import { attackPhase } from './combat';
import { abilitiesPhase, applyQueuedActives } from './abilities';

export function createBattle(
  playerRoster: RosterEntry[],
  enemyRosterList: RosterEntry[],
  seed: number,
  blessings: readonly string[],
): BattleState {
  const rng = new Rng(seed | 0);
  const units: UnitState[] = [];

  deployPlayersAtBuildings(units, playerRoster, rng);
  deployEnemyRows(units, enemyRosterList, rng);

  let reapers: BattleState['reapers'] = null;
  for (const id of blessings) {
    const b = blessingDef(id);
    if (b.kind === 'passive' && b.passive.type === 'reapersDue') {
      reapers = { attackSpeedMult: b.passive.attackSpeedMult, durTicks: b.passive.durTicks };
    }
  }

  return {
    tick: 0,
    rngState: rng.state,
    units,
    status: 'running',
    events: [],
    usedActives: [],
    queuedActives: [],
    enemyKills: 0,
    playerDeaths: 0,
    damageByDef: {},
    reapers,
  };
}

// Player units muster at their source building and march east — placement
// depth determines arrival time, which is part of the puzzle. Ring offsets
// are a fixed table (no trig in the sim).
const MUSTER_OFFSETS = [
  [0.9, 0],
  [-0.9, 0],
  [0, 0.9],
  [0, -0.9],
  [0.75, 0.75],
  [-0.75, 0.75],
  [0.75, -0.75],
  [-0.75, -0.75],
  [1.5, 0],
  [0, 1.5],
  [-1.5, 0],
  [0, -1.5],
] as const;

function deployPlayersAtBuildings(units: UnitState[], roster: RosterEntry[], rng: Rng): void {
  const perCell = new Array<number>(CELL_COUNT).fill(0);
  for (const entry of roster) {
    const cell = Math.max(0, entry.sourceCell);
    const k = perCell[cell]++;
    const [ox, oz] = MUSTER_OFFSETS[k % MUSTER_OFFSETS.length];
    const ring = 1 + Math.floor(k / MUSTER_OFFSETS.length) * 0.7;
    const p = cellBattlePos(cell);
    units.push(
      createUnitState(
        units.length,
        0,
        entry,
        p.x + ox * ring + rng.range(-DEPLOY_JITTER, DEPLOY_JITTER),
        p.z + oz * ring + rng.range(-DEPLOY_JITTER, DEPLOY_JITTER),
      ),
    );
  }
}

// Horde deploys in role rows on the east edge: melee front, ranged back.
function deployEnemyRows(units: UnitState[], roster: RosterEntry[], rng: Rng): void {
  const melee = roster.filter((r) => r.rangeM < MELEE_RANGE_THRESHOLD);
  const ranged = roster.filter((r) => r.rangeM >= MELEE_RANGE_THRESHOLD);

  const place = (list: RosterEntry[], baseX: number) => {
    for (let i = 0; i < list.length; i++) {
      const col = Math.floor(i / DEPLOY_ROWS);
      const row = i % DEPLOY_ROWS;
      const x = baseX + col * DEPLOY_COL_SPACING + rng.range(-DEPLOY_JITTER, DEPLOY_JITTER);
      const z = DEPLOY_Z_MIN + row * DEPLOY_ROW_SPACING + rng.range(-DEPLOY_JITTER, DEPLOY_JITTER);
      units.push(createUnitState(units.length, 1 as Team, list[i], x, z));
    }
  };
  place(melee, ENEMY_FRONT_X);
  place(ranged, ENEMY_BACK_X);
}

export function queueActiveBlessing(state: BattleState, blessingId: string): boolean {
  if (state.status !== 'running') return false;
  if (state.usedActives.includes(blessingId) || state.queuedActives.includes(blessingId)) {
    return false;
  }
  state.queuedActives.push(blessingId);
  return true;
}

export function stepBattle(state: BattleState): void {
  if (state.status !== 'running') return;
  state.events = [];

  // Snapshot previous positions for render interpolation.
  const units = state.units;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    u.prevX = u.x;
    u.prevZ = u.z;
  }

  applyQueuedActives(state);
  targetingPhase(state);
  movementPhase(state);
  attackPhase(state);
  abilitiesPhase(state);
  deathSweep(state);

  state.tick++;

  // End conditions — clearing the wave counts even in mutual annihilation.
  let players = 0;
  let enemies = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive) continue;
    if (u.team === 0) players++;
    else enemies++;
  }
  if (enemies === 0) {
    state.status = 'victory';
    state.events.push({ t: 'battleEnd', status: 'victory' });
  } else if (players === 0 || state.tick >= BATTLE_TIMEOUT_TICKS) {
    state.status = 'defeat';
    state.events.push({ t: 'battleEnd', status: 'defeat' });
  }
}

function deathSweep(state: BattleState): void {
  const units = state.units;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.alive || u.hp > 0) continue;
    u.alive = false;
    u.hp = 0;
    state.events.push({ t: 'death', id: u.id });
    if (u.team === 1) state.enemyKills++;
    else {
      state.playerDeaths++;
      // Reaper's Due: nearest living player ally gains attack speed.
      if (state.reapers) {
        let best = -1;
        let bestD = Infinity;
        for (let j = 0; j < units.length; j++) {
          const v = units[j];
          if (!v.alive || v.team !== 0) continue;
          const dx = v.x - u.x;
          const dz = v.z - u.z;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        }
        if (best >= 0) {
          const v = units[best];
          v.buffAsTicks = state.reapers.durTicks;
          v.buffAsMult = state.reapers.attackSpeedMult;
          state.events.push({ t: 'ability', id: v.id, kind: 'reapers_due' });
        }
      }
    }
  }
}

export function hashBattle(state: BattleState): string {
  const parts: (number | string)[] = [state.tick, state.rngState, state.status];
  const units = state.units;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    parts.push(u.hp, u.x, u.z, u.cooldown, u.alive ? 1 : 0, u.targetId);
  }
  return cyrb53(parts.join(','));
}
