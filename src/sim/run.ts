import {
  BASE_INCOME_GOLD,
  ROUNDS_TO_WIN,
  SELL_REFUND_PCT,
  START_GOLD,
} from '../data/balance';
import { buildingDef } from '../data/buildings';
import { blessingDef } from '../data/blessings';
import { waveForRound } from '../data/waves';
import { CELL_COUNT, computeAdjacency } from './village';
import { deriveWarband, enemyRoster } from './warband';
import type { BattleState } from './battle/types';
import { createBattle, hashBattle, queueActiveBlessing, stepBattle } from './battle/battle';
import type { SimEvent } from './events';
import { cyrb53 } from './hash';

export type RunPhase = 'build' | 'battle' | 'won' | 'lost';

export interface RunState {
  seed: number;
  round: number; // 1..ROUNDS_TO_WIN
  gold: number;
  ichor: number;
  grid: (string | null)[]; // building defId per hex cell
  blessings: string[];
  phase: RunPhase;
  battle: BattleState | null;
  // Run summary stats
  totalKills: number;
  goldByRound: number[];
  damageByDef: Record<string, number>; // accumulated across battles
  lastBattle: {
    round: number;
    won: boolean;
    kills: number;
    survivors: number;
    rosterSize: number;
  } | null;
}

export function newRun(seed: number): RunState {
  return {
    seed: seed | 0,
    round: 1,
    gold: START_GOLD,
    ichor: 0,
    grid: new Array(CELL_COUNT).fill(null),
    blessings: [],
    phase: 'build',
    battle: null,
    totalKills: 0,
    goldByRound: [],
    damageByDef: {},
    lastBattle: null,
  };
}

export function canPlace(
  run: RunState,
  cellIndex: number,
  defId: string,
): { ok: boolean; reason?: string } {
  if (run.phase !== 'build') return { ok: false, reason: 'Not in build phase' };
  if (cellIndex < 0 || cellIndex >= CELL_COUNT) return { ok: false, reason: 'Out of bounds' };
  if (run.grid[cellIndex]) return { ok: false, reason: 'Cell occupied' };
  const def = buildingDef(defId);
  if (run.round < def.unlockRound) {
    return { ok: false, reason: `Unlocks at round ${def.unlockRound}` };
  }
  if (run.gold < def.costGold) return { ok: false, reason: 'Not enough Gold' };
  return { ok: true };
}

export function placeBuilding(run: RunState, cellIndex: number, defId: string): boolean {
  if (!canPlace(run, cellIndex, defId).ok) return false;
  run.grid[cellIndex] = defId;
  run.gold -= buildingDef(defId).costGold;
  return true;
}

export function sellBuilding(run: RunState, cellIndex: number): boolean {
  if (run.phase !== 'build') return false;
  const defId = run.grid[cellIndex];
  if (!defId) return false;
  run.grid[cellIndex] = null;
  run.gold += Math.floor((buildingDef(defId).costGold * SELL_REFUND_PCT) / 100);
  return true;
}

export function buyBlessing(run: RunState, blessingId: string): boolean {
  if (run.phase !== 'build') return false;
  if (run.blessings.includes(blessingId)) return false;
  const def = blessingDef(blessingId);
  if (run.ichor < def.costIchor) return false;
  run.ichor -= def.costIchor;
  run.blessings.push(blessingId);
  return true;
}

export function startBattle(run: RunState): boolean {
  if (run.phase !== 'build') return false;
  const roster = deriveWarband(run.grid, run.blessings);
  if (roster.length === 0) return false;
  const wave = waveForRound(run.round);
  const enemies = enemyRoster(wave.spawns);
  // Per-round battle seed derived from run seed — stable across replays.
  const battleSeed = (run.seed ^ Math.imul(run.round, 0x9e3779b9)) | 0;
  run.battle = createBattle(roster, enemies, battleSeed, run.blessings);
  run.phase = 'battle';
  return true;
}

export function tickBattle(run: RunState): SimEvent[] {
  if (run.phase !== 'battle' || !run.battle) return [];
  stepBattle(run.battle);
  return run.battle.events;
}

export function activateBlessing(run: RunState, blessingId: string): boolean {
  if (run.phase !== 'battle' || !run.battle) return false;
  if (!run.blessings.includes(blessingId)) return false;
  if (blessingDef(blessingId).kind !== 'active') return false;
  return queueActiveBlessing(run.battle, blessingId);
}

// Acknowledge a finished battle: apply rewards + advance, or end the run.
export function finishBattle(run: RunState): void {
  const battle = run.battle;
  if (run.phase !== 'battle' || !battle || battle.status === 'running') return;

  run.totalKills += battle.enemyKills;
  for (const key of Object.keys(battle.damageByDef)) {
    run.damageByDef[key] = (run.damageByDef[key] ?? 0) + battle.damageByDef[key];
  }
  let survivors = 0;
  let rosterSize = 0;
  for (const u of battle.units) {
    if (u.team !== 0) continue;
    rosterSize++;
    if (u.alive) survivors++;
  }
  run.lastBattle = {
    round: run.round,
    won: battle.status === 'victory',
    kills: battle.enemyKills,
    survivors,
    rosterSize,
  };

  if (battle.status === 'defeat') {
    run.phase = 'lost';
    run.battle = null;
    return;
  }

  if (run.round >= ROUNDS_TO_WIN) {
    run.phase = 'won';
    run.battle = null;
    return;
  }

  // Victory income.
  const wave = waveForRound(run.round);
  let gold = BASE_INCOME_GOLD + wave.goldReward;
  let ichor = wave.ichorReward;
  const bonuses = computeAdjacency(run.grid);
  for (let i = 0; i < run.grid.length; i++) {
    const defId = run.grid[i];
    if (!defId) continue;
    const def = buildingDef(defId);
    gold += (def.incomeGold ?? 0) + bonuses[i].incomeGold;
    ichor += (def.incomeIchor ?? 0) + bonuses[i].incomeIchor;
  }
  for (const id of run.blessings) {
    const b = blessingDef(id);
    if (b.kind === 'passive' && b.passive.type === 'crimsonHarvest') {
      gold += Math.floor(battle.enemyKills / b.passive.killsPerGold);
    }
  }
  run.gold += gold;
  run.ichor += ichor;
  run.goldByRound.push(gold);
  run.round++;
  run.phase = 'build';
  run.battle = null;
}

export function hashRun(run: RunState): string {
  const parts: (number | string)[] = [
    run.seed,
    run.round,
    run.gold,
    run.ichor,
    run.phase,
    run.grid.map((g) => g ?? '.').join('|'),
    run.blessings.join('|'),
  ];
  if (run.battle) parts.push(hashBattle(run.battle));
  return cyrb53(parts.join(','));
}
