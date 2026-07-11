import { describe, expect, it } from 'vitest';
import { newRun, placeBuilding, startBattle, tickBattle, finishBattle } from '../src/sim/run';
import { hashBattle } from '../src/sim/battle/battle';
import { cellIndexAt } from '../src/sim/village';
import { playRun, STRATEGIES } from '../scripts/strategies';

function scriptedBattleHashes(seed: number): string[] {
  const run = newRun(seed);
  placeBuilding(run, cellIndexAt(0, 0), 'mustering_yard');
  placeBuilding(run, cellIndexAt(1, 0), 'hovel');
  startBattle(run);
  const hashes: string[] = [];
  const battle = run.battle!;
  while (battle.status === 'running') {
    tickBattle(run);
    if (battle.tick % 100 === 0) hashes.push(hashBattle(battle));
  }
  hashes.push(hashBattle(battle));
  finishBattle(run);
  return hashes;
}

describe('determinism', () => {
  it('same seed → identical battle hash at every checkpoint', () => {
    const a = scriptedBattleHashes(12345);
    const b = scriptedBattleHashes(12345);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('different seeds → different trajectories (jitter applied)', () => {
    const a = scriptedBattleHashes(1);
    const b = scriptedBattleHashes(2);
    expect(a[a.length - 1]).not.toEqual(b[b.length - 1]);
  });

  it('full scripted run twice → identical per-round results', () => {
    const strat = STRATEGIES[0];
    const a = playRun(777, strat);
    const b = playRun(777, strat);
    expect(a).toEqual(b);
  });
});
