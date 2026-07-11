import type { WaveDef } from './types';

// 10 handcrafted waves. Each teaches/checks something:
// R1 tutorial, R3 ranged answer, R4 armor check, R5 glass-cannon spike,
// R7 big single target, R8 AoE punishes clumps, R9 wall of steel, R10 boss.

export const WAVES: WaveDef[] = [
  {
    round: 1,
    spawns: [{ defId: 'shambler', count: 4 }],
    goldReward: 5,
    ichorReward: 0,
  },
  {
    round: 2,
    spawns: [
      { defId: 'shambler', count: 5 },
      { defId: 'rotting_hound', count: 2 },
    ],
    goldReward: 6,
    ichorReward: 1,
  },
  {
    round: 3,
    spawns: [
      { defId: 'shambler', count: 7 },
      { defId: 'bone_archer', count: 5 },
    ],
    goldReward: 7,
    ichorReward: 1,
  },
  {
    round: 4,
    spawns: [
      { defId: 'shambler', count: 9 },
      { defId: 'rotting_hound', count: 7 },
      { defId: 'grave_knight', count: 3 },
    ],
    goldReward: 7,
    ichorReward: 1,
  },
  {
    round: 5,
    spawns: [
      { defId: 'wraith', count: 9 },
      { defId: 'shambler', count: 12 },
      { defId: 'bone_archer', count: 7 },
    ],
    goldReward: 8,
    ichorReward: 1,
  },
  {
    round: 6,
    spawns: [
      { defId: 'grave_knight', count: 7 },
      { defId: 'rotting_hound', count: 14 },
      { defId: 'bone_archer', count: 8 },
    ],
    goldReward: 8,
    ichorReward: 2,
  },
  {
    round: 7,
    spawns: [
      { defId: 'abomination', count: 3 },
      { defId: 'shambler', count: 14 },
      { defId: 'wraith', count: 8 },
      { defId: 'bone_archer', count: 7 },
      { defId: 'plague_bearer', count: 3 },
    ],
    goldReward: 9,
    ichorReward: 2,
  },
  {
    round: 8,
    spawns: [
      { defId: 'plague_bearer', count: 7 },
      { defId: 'grave_knight', count: 8 },
      { defId: 'bone_archer', count: 12 },
      { defId: 'rotting_hound', count: 12 },
    ],
    goldReward: 9,
    ichorReward: 2,
  },
  {
    round: 9,
    spawns: [
      { defId: 'abomination', count: 4 },
      { defId: 'wraith', count: 9 },
      { defId: 'grave_knight', count: 11 },
      { defId: 'rotting_hound', count: 6 },
    ],
    goldReward: 10,
    ichorReward: 2,
  },
  {
    round: 10,
    spawns: [
      { defId: 'charnel_king', count: 1 },
      { defId: 'grave_knight', count: 10 },
      { defId: 'wraith', count: 12 },
    ],
    goldReward: 0,
    ichorReward: 0,
  },
];

export function waveForRound(round: number): WaveDef {
  const wave = WAVES[round - 1];
  if (!wave) throw new Error(`No wave for round ${round}`);
  return wave;
}
