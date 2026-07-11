import { describe, expect, it } from 'vitest';
import { createBattle, stepBattle } from '../src/sim/battle/battle';
import type { BattleState } from '../src/sim/battle/types';
import { enemyRoster } from '../src/sim/warband';
import { WAVES } from '../src/data/waves';
import { BATTLE_TIMEOUT_TICKS } from '../src/data/balance';
import type { SimEvent } from '../src/sim/events';

// Strong synthetic warband — enough to beat any wave; used to prove that
// every shipped wave terminates and combat invariants hold.
function strongRoster() {
  return enemyRoster([
    { defId: 'grave_warden', count: 4 },
    { defId: 'ashbound_knight', count: 4 },
    { defId: 'sellsword', count: 6 },
    { defId: 'dirge_archer', count: 8 },
    { defId: 'hexen_matriarch', count: 2 },
  ]);
}

function runToEnd(battle: BattleState): SimEvent[] {
  const all: SimEvent[] = [];
  let guard = 0;
  while (battle.status === 'running' && guard <= BATTLE_TIMEOUT_TICKS + 5) {
    stepBattle(battle);
    all.push(...battle.events);
    guard++;
  }
  return all;
}

describe('battle invariants', () => {
  for (const wave of WAVES) {
    it(`wave R${wave.round} terminates within the timeout`, () => {
      const battle = createBattle(strongRoster(), enemyRoster(wave.spawns), 42, []);
      runToEnd(battle);
      expect(battle.status).not.toBe('running');
      expect(battle.tick).toBeLessThanOrEqual(BATTLE_TIMEOUT_TICKS);
    });
  }

  it('every hit deals at least 1 damage', () => {
    const battle = createBattle(strongRoster(), enemyRoster(WAVES[8].spawns), 7, []);
    const events = runToEnd(battle);
    const hits = events.filter((e) => e.t === 'hit');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      if (h.t === 'hit') expect(h.amount).toBeGreaterThanOrEqual(1);
    }
  });

  it('dead units never act or move again', () => {
    const battle = createBattle(strongRoster(), enemyRoster(WAVES[6].spawns), 99, []);
    const frozen = new Map<number, { x: number; z: number }>();
    let guard = 0;
    while (battle.status === 'running' && guard <= BATTLE_TIMEOUT_TICKS + 5) {
      stepBattle(battle);
      for (const e of battle.events) {
        if (e.t === 'death') frozen.set(e.id, { x: battle.units[e.id].x, z: battle.units[e.id].z });
        if (e.t === 'attack') expect(frozen.has(e.id)).toBe(false);
      }
      for (const [id, pos] of frozen) {
        expect(battle.units[id].alive).toBe(false);
        expect(battle.units[id].x).toBe(pos.x);
        expect(battle.units[id].z).toBe(pos.z);
      }
      guard++;
    }
    expect(frozen.size).toBeGreaterThan(0);
  });

  it('boss summons shamblers mid-fight', () => {
    // Weak-ish roster so the boss survives long enough to summon.
    const roster = enemyRoster([
      { defId: 'grave_warden', count: 6 },
      { defId: 'dirge_archer', count: 6 },
    ]);
    const battle = createBattle(roster, enemyRoster(WAVES[9].spawns), 3, []);
    const events = runToEnd(battle);
    const summons = events.filter((e) => e.t === 'summon');
    expect(summons.length).toBeGreaterThan(0);
  });
});
