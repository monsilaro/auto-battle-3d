import type { BlessingDef } from './types';

export const BLESSINGS = {
  bone_ward: {
    id: 'bone_ward',
    name: 'Bone Ward',
    costIchor: 2,
    kind: 'passive',
    passive: { type: 'stat', stat: 'armor', amount: 2 },
    desc: 'All your units gain +2 armor.',
  },
  pale_vigor: {
    id: 'pale_vigor',
    name: "Pale Lady's Vigor",
    costIchor: 2,
    kind: 'passive',
    passive: { type: 'stat', stat: 'maxHpPct', amount: 12 },
    desc: 'All your units gain +12% max HP.',
  },
  reapers_due: {
    id: 'reapers_due',
    name: "Reaper's Due",
    costIchor: 3,
    kind: 'passive',
    passive: { type: 'reapersDue', attackSpeedMult: 1.25, durTicks: 100 },
    desc: 'When an ally dies, the nearest living ally gains +25% attack speed for 5 s.',
  },
  crimson_harvest: {
    id: 'crimson_harvest',
    name: 'Crimson Harvest',
    costIchor: 2,
    kind: 'passive',
    passive: { type: 'crimsonHarvest', killsPerGold: 4 },
    desc: '+1 Gold for every 4 enemies slain in battle.',
  },
  ember_wrath: {
    id: 'ember_wrath',
    name: 'Ember of Wrath',
    costIchor: 4,
    kind: 'active',
    active: { type: 'firestorm', damage: 40, radius: 3.5 },
    desc: 'Once per battle: firestorm strikes the densest enemy cluster for 40 damage.',
  },
  void_whisper: {
    id: 'void_whisper',
    name: 'Whisper of the Void',
    costIchor: 4,
    kind: 'active',
    active: { type: 'fear', radius: 6, durTicks: 60 },
    desc: 'Once per battle: enemies near the horde center flee in terror for 3 s.',
  },
} satisfies Record<string, BlessingDef>;

export type BlessingId = keyof typeof BLESSINGS;

export const BLESSING_ORDER: BlessingId[] = [
  'bone_ward',
  'pale_vigor',
  'reapers_due',
  'crimson_harvest',
  'ember_wrath',
  'void_whisper',
];

export function blessingDef(id: string): BlessingDef {
  const def = (BLESSINGS as Record<string, BlessingDef>)[id];
  if (!def) throw new Error(`Unknown blessing def: ${id}`);
  return def;
}
