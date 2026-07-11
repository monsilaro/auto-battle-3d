// Headless balance sweep: every strategy × N seeds × up to 10 rounds.
// Primary balance tool — tune src/data/* until the intended curve appears.
// Run: npm run balance [-- --seeds 500]

import { playRun, STRATEGIES } from './strategies';

const seedArg = process.argv.indexOf('--seeds');
const SEEDS = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 200;

console.log(`Gravemarch balance sweep — ${SEEDS} seeds per strategy\n`);

for (const strat of STRATEGIES) {
  let wins = 0;
  const lossAtRound = new Array(11).fill(0);
  const roundWinCounts = new Array(11).fill(0);
  const roundPlayCounts = new Array(11).fill(0);
  const roundSurvivorPct = new Array(11).fill(0);
  let totalTicks = 0;
  let totalBattles = 0;
  const survivorPctAtWin: number[] = [];

  for (let s = 0; s < SEEDS; s++) {
    const result = playRun(s * 7919 + 13, strat);
    if (result.won) {
      wins++;
      const final = result.rounds[result.rounds.length - 1];
      survivorPctAtWin.push((100 * final.survivors) / Math.max(1, final.rosterSize));
    } else {
      lossAtRound[result.roundReached]++;
    }
    for (const r of result.rounds) {
      roundPlayCounts[r.round]++;
      if (r.won) roundWinCounts[r.round]++;
      roundSurvivorPct[r.round] += (100 * r.survivors) / Math.max(1, r.rosterSize);
      totalTicks += r.ticks;
      totalBattles++;
    }
  }

  const winPct = ((100 * wins) / SEEDS).toFixed(1);
  const avgTicks = (totalTicks / Math.max(1, totalBattles)).toFixed(0);
  console.log(`── ${strat.name} ─────────────────────────────`);
  console.log(`   run win rate: ${winPct}%   avg battle: ${avgTicks} ticks`);
  const perRound = [];
  for (let r = 1; r <= 10; r++) {
    if (roundPlayCounts[r] === 0) {
      perRound.push(`R${r}:—`);
      continue;
    }
    perRound.push(`R${r}:${((100 * roundWinCounts[r]) / roundPlayCounts[r]).toFixed(0)}%`);
  }
  console.log(`   per-round win: ${perRound.join(' ')}`);
  const surv = [];
  for (let r = 1; r <= 10; r++) {
    if (roundPlayCounts[r] === 0) {
      surv.push(`R${r}:—`);
      continue;
    }
    surv.push(`R${r}:${(roundSurvivorPct[r] / roundPlayCounts[r]).toFixed(0)}%`);
  }
  console.log(`   per-round survivors: ${surv.join(' ')}`);
  const losses = [];
  for (let r = 1; r <= 10; r++) if (lossAtRound[r] > 0) losses.push(`R${r}:${lossAtRound[r]}`);
  console.log(`   losses at: ${losses.length ? losses.join(' ') : 'none'}`);
  if (survivorPctAtWin.length > 0) {
    const mean = survivorPctAtWin.reduce((a, b) => a + b, 0) / survivorPctAtWin.length;
    console.log(`   final-round survivors (wins): ${mean.toFixed(0)}%`);
  }
  console.log('');
}
