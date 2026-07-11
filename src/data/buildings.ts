import type { BuildingDef } from './types';

export const BUILDINGS = {
  hovel: {
    id: 'hovel',
    name: 'Hovel',
    desc: 'Wretched souls pay their tithe. +2 Gold per round won. +1 Gold per adjacent Hovel.',
    costGold: 3,
    unlockRound: 1,
    incomeGold: 2,
    adjacency: [
      { neighborId: 'hovel', perNeighbor: true, effect: { kind: 'income', gold: 1 } },
    ],
    model: 'models/buildings/hovel.glb',
  },
  mustering_yard: {
    id: 'mustering_yard',
    name: 'Mustering Yard',
    desc: 'Fields 3 Levy Spearmen.',
    costGold: 4,
    unlockRound: 1,
    grantsUnits: [{ defId: 'levy_spear', count: 3 }],
    model: 'models/buildings/mustering_yard.glb',
  },
  sellsword_post: {
    id: 'sellsword_post',
    name: 'Sellsword Post',
    desc: 'Fields 2 Sellswords. +1 Sellsword if adjacent to a Hovel.',
    costGold: 5,
    unlockRound: 2,
    grantsUnits: [{ defId: 'sellsword', count: 2 }],
    adjacency: [
      {
        neighborId: 'hovel',
        perNeighbor: false,
        effect: { kind: 'grantUnits', defId: 'sellsword', count: 1 },
      },
    ],
    model: 'models/buildings/sellsword_post.glb',
  },
  fletchers_hut: {
    id: 'fletchers_hut',
    name: "Fletcher's Hut",
    desc: 'Fields 2 Dirge Archers.',
    costGold: 5,
    unlockRound: 2,
    grantsUnits: [{ defId: 'dirge_archer', count: 2 }],
    model: 'models/buildings/fletchers_hut.glb',
  },
  chapel_pale: {
    id: 'chapel_pale',
    name: 'Chapel of the Pale',
    desc: 'Distills the dead into Ichor. +1 Ichor per round won. +1 Ichor if adjacent to the Blood Altar.',
    costGold: 5,
    unlockRound: 3,
    incomeIchor: 1,
    adjacency: [
      { neighborId: 'blood_altar', perNeighbor: false, effect: { kind: 'income', ichor: 1 } },
    ],
    model: 'models/buildings/chapel_pale.glb',
  },
  cinder_forge: {
    id: 'cinder_forge',
    name: 'Cinder Forge',
    desc: "Adjacent buildings' units deal +10% damage.",
    costGold: 6,
    unlockRound: 3,
    aura: { stat: 'damage', pct: 10 },
    model: 'models/buildings/cinder_forge.glb',
  },
  blood_altar: {
    id: 'blood_altar',
    name: 'Blood Altar',
    desc: "Fields 2 Blood Zealots and 1 Hexen Matriarch. Adjacent buildings' units gain +10% HP.",
    costGold: 7,
    unlockRound: 4,
    grantsUnits: [
      { defId: 'blood_zealot', count: 2 },
      { defId: 'hexen_matriarch', count: 1 },
    ],
    aura: { stat: 'maxHp', pct: 10 },
    model: 'models/buildings/blood_altar.glb',
  },
  iron_keep: {
    id: 'iron_keep',
    name: 'Iron Keep',
    desc: 'Fields 1 Grave Warden and 1 Ashbound Knight. Their HP +15% if adjacent to the Cinder Forge.',
    costGold: 10,
    unlockRound: 5,
    grantsUnits: [
      { defId: 'grave_warden', count: 1 },
      { defId: 'ashbound_knight', count: 1 },
    ],
    adjacency: [
      {
        neighborId: 'cinder_forge',
        perNeighbor: false,
        effect: { kind: 'selfUnitStat', stat: 'maxHp', pct: 15 },
      },
    ],
    model: 'models/buildings/iron_keep.glb',
  },
} satisfies Record<string, BuildingDef>;

export type BuildingId = keyof typeof BUILDINGS;

export const BUILDING_ORDER: BuildingId[] = [
  'hovel',
  'mustering_yard',
  'sellsword_post',
  'fletchers_hut',
  'chapel_pale',
  'cinder_forge',
  'blood_altar',
  'iron_keep',
];

export function buildingDef(id: string): BuildingDef {
  const def = (BUILDINGS as Record<string, BuildingDef>)[id];
  if (!def) throw new Error(`Unknown building def: ${id}`);
  return def;
}
