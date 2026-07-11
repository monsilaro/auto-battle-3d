// Scripted build strategies — shared by the balance script and the test
// suites. Fully deterministic given a seed.

import {
  activateBlessing,
  buyBlessing,
  canPlace,
  finishBattle,
  newRun,
  placeBuilding,
  startBattle,
  tickBattle,
  type RunState,
} from '../src/sim/run';
import { CELLS, CELL_COUNT } from '../src/sim/village';
import { buildingDef } from '../src/data/buildings';
import { blessingDef } from '../src/data/blessings';
import { BATTLE_TIMEOUT_TICKS } from '../src/data/balance';

export interface Strategy {
  name: string;
  buildQueue: string[]; // consumed one-time, in order; stalls on locked/unaffordable
  blessingPriority: string[];
  activeUseTick: number;
}

// Cells sorted by hex distance from origin (center first) — unit/aura
// buildings cluster centrally for adjacency, economy goes to the rim.
const byCenter = [...Array(CELL_COUNT).keys()].sort((a, b) => {
  const da = hexDist(a);
  const db = hexDist(b);
  return da - db || a - b;
});
const byRim = [...byCenter].reverse();

function hexDist(i: number): number {
  const c = CELLS[i];
  return Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r));
}

function pickCell(run: RunState, defId: string): number {
  const def = buildingDef(defId);
  const central = !!def.grantsUnits || !!def.aura;
  const order = central ? byCenter : byRim;
  for (const i of order) {
    if (canPlace(run, i, defId).ok) return i;
  }
  return -1;
}

export interface RoundResult {
  round: number;
  ticks: number;
  won: boolean;
  survivors: number;
  rosterSize: number;
}

export interface RunResult {
  seed: number;
  won: boolean;
  roundReached: number;
  rounds: RoundResult[];
}

export function playRun(seed: number, strat: Strategy): RunResult {
  const run = newRun(seed);
  let queueIdx = 0;
  const rounds: RoundResult[] = [];

  while (run.phase === 'build') {
    // Blessings first (ichor is useless otherwise).
    for (const b of strat.blessingPriority) {
      if (!run.blessings.includes(b) && run.ichor >= blessingDef(b).costIchor) {
        buyBlessing(run, b);
      }
    }
    // Consume the build queue in order; stall on the first blocked item.
    while (queueIdx < strat.buildQueue.length) {
      const defId = strat.buildQueue[queueIdx];
      const def = buildingDef(defId);
      if (run.round < def.unlockRound || run.gold < def.costGold) break;
      const cell = pickCell(run, defId);
      if (cell < 0) break;
      placeBuilding(run, cell, defId);
      queueIdx++;
    }

    if (!startBattle(run)) {
      // No units at all — run is unwinnable; treat as instant loss.
      run.phase = 'lost';
      break;
    }

    const battle = run.battle!;
    const rosterSize = battle.units.filter((u) => u.team === 0).length;
    let guard = 0;
    while (battle.status === 'running' && guard <= BATTLE_TIMEOUT_TICKS + 5) {
      if (battle.tick === strat.activeUseTick) {
        for (const b of run.blessings) {
          if (blessingDef(b).kind === 'active') activateBlessing(run, b);
        }
      }
      tickBattle(run);
      guard++;
    }

    const survivors = battle.units.filter((u) => u.team === 0 && u.alive).length;
    rounds.push({
      round: run.round,
      ticks: battle.tick,
      won: battle.status === 'victory',
      survivors,
      rosterSize,
    });
    finishBattle(run);
  }

  return {
    seed,
    won: run.phase === 'won',
    roundReached: rounds.length ? rounds[rounds.length - 1].round : 1,
    rounds,
  };
}

export const STRATEGIES: Strategy[] = [
  {
    name: 'balanced',
    buildQueue: [
      'mustering_yard',
      'hovel',
      'hovel',
      'fletchers_hut',
      'sellsword_post',
      'hovel',
      'cinder_forge',
      'mustering_yard',
      'blood_altar',
      'fletchers_hut',
      'chapel_pale',
      'iron_keep',
      'sellsword_post',
      'mustering_yard',
      'iron_keep',
      'fletchers_hut',
      'blood_altar',
    ],
    blessingPriority: ['pale_vigor', 'bone_ward', 'ember_wrath', 'reapers_due'],
    activeUseTick: 200,
  },
  {
    name: 'economy-first',
    buildQueue: [
      'hovel',
      'mustering_yard',
      'fletchers_hut',
      'hovel',
      'hovel',
      'hovel',
      'sellsword_post',
      'cinder_forge',
      'blood_altar',
      'mustering_yard',
      'iron_keep',
      'fletchers_hut',
      'iron_keep',
      'blood_altar',
      'fletchers_hut',
    ],
    blessingPriority: ['crimson_harvest', 'pale_vigor', 'ember_wrath'],
    activeUseTick: 200,
  },
  {
    name: 'all-melee',
    buildQueue: [
      'mustering_yard',
      'hovel',
      'sellsword_post',
      'hovel',
      'sellsword_post',
      'mustering_yard',
      'blood_altar',
      'mustering_yard',
      'iron_keep',
      'sellsword_post',
      'iron_keep',
      'blood_altar',
      'mustering_yard',
    ],
    blessingPriority: ['bone_ward', 'pale_vigor', 'void_whisper'],
    activeUseTick: 200,
  },
  {
    // Under-investing probe: some units early, then stops buying entirely.
    // Should clear the opening rounds and die by mid-game.
    name: 'poor-build',
    buildQueue: ['mustering_yard', 'hovel', 'fletchers_hut', 'hovel'],
    blessingPriority: [],
    activeUseTick: 200,
  },
];
