import { describe, expect, it } from 'vitest';
import { playRun, STRATEGIES } from '../scripts/strategies';

// Balance regression net — coarse properties that must survive data tuning.
// Fine-grained numbers live in `npm run balance`, not here.

function strat(name: string) {
  const s = STRATEGIES.find((s) => s.name === name);
  if (!s) throw new Error(`missing strategy ${name}`);
  return s;
}

const SEEDS = [...Array(10).keys()].map((s) => s * 7919 + 13);

describe('run progression', () => {
  it('the balanced reference build clears the run on most seeds', () => {
    const wins = SEEDS.filter((seed) => playRun(seed, strat('balanced')).won).length;
    expect(wins).toBeGreaterThanOrEqual(8);
  });

  it('a second archetype (all-melee) can also clear the run', () => {
    const wins = SEEDS.filter((seed) => playRun(seed, strat('all-melee')).won).length;
    expect(wins).toBeGreaterThanOrEqual(5);
  });

  it('under-investing loses the run by mid-game', () => {
    for (const seed of SEEDS) {
      const r = playRun(seed, strat('poor-build'));
      expect(r.won).toBe(false);
      expect(r.roundReached).toBeLessThanOrEqual(6);
    }
  });

  it('battles stay snappy — no wave grinds near the timeout', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      const r = playRun(seed, strat('balanced'));
      for (const round of r.rounds) {
        expect(round.ticks).toBeLessThan(1200); // < 60 s of sim time
      }
    }
  });
});
