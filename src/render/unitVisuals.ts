import type { ModelKey } from './assets';

// Maps sim unit defs onto the 9 KayKit character models via scale + tint
// variants. Clip names come from the KayKit shared animation library.

export interface UnitVisual {
  model: ModelKey;
  scale: number;
  tint?: number; // multiplied into material color
  attackClip: string;
  abilityClip?: string; // played on ability events (heal, summon, rage...)
  walkClip?: string; // default Running_A
}

export const UNIT_VISUALS: Record<string, UnitVisual> = {
  // ── Warband ──
  levy_spear: {
    model: 'knight',
    scale: 0.95,
    tint: 0xb8bccc,
    attackClip: '1H_Melee_Attack_Stab',
  },
  sellsword: {
    model: 'rogue',
    scale: 1.0,
    tint: 0xcbb9a0,
    attackClip: 'Dualwield_Melee_Attack_Slice',
  },
  dirge_archer: {
    model: 'rogue_hooded',
    scale: 1.0,
    tint: 0x9aa58e,
    attackClip: '1H_Ranged_Shoot',
  },
  plague_alchemist: {
    model: 'mage',
    scale: 1.0,
    tint: 0x9fc48f,
    attackClip: 'Spellcast_Shoot',
    abilityClip: 'Spellcast_Long',
  },
  grave_warden: {
    model: 'knight',
    scale: 1.28,
    tint: 0x6f7686,
    attackClip: '1H_Melee_Attack_Chop',
  },
  blood_zealot: {
    model: 'barbarian',
    scale: 1.05,
    tint: 0xd08d7d,
    attackClip: '2H_Melee_Attack_Chop',
    abilityClip: 'Taunt',
  },
  hexen_matriarch: {
    model: 'mage',
    scale: 1.05,
    tint: 0xb59ed2,
    attackClip: 'Spellcast_Shoot',
    abilityClip: 'Spellcast_Raise',
  },
  ashbound_knight: {
    model: 'knight',
    scale: 1.18,
    tint: 0xd8a06a,
    attackClip: '2H_Melee_Attack_Slice',
  },

  // ── Horde ──
  shambler: {
    model: 'skeleton_minion',
    scale: 1.0,
    attackClip: 'Unarmed_Melee_Attack_Punch_A',
    walkClip: 'Walking_D_Skeletons',
  },
  rotting_hound: {
    model: 'skeleton_minion',
    scale: 0.72,
    tint: 0xa8845e,
    attackClip: 'Unarmed_Melee_Attack_Kick',
  },
  bone_archer: {
    model: 'skeleton_rogue',
    scale: 1.0,
    attackClip: '1H_Ranged_Shoot',
  },
  grave_knight: {
    model: 'skeleton_warrior',
    scale: 1.12,
    tint: 0x8d95a8,
    attackClip: '1H_Melee_Attack_Slice_Horizontal',
  },
  wraith: {
    model: 'skeleton_mage',
    scale: 1.0,
    tint: 0x86b8c8,
    attackClip: 'Unarmed_Melee_Attack_Punch_A',
  },
  plague_bearer: {
    model: 'skeleton_minion',
    scale: 1.18,
    tint: 0x8fb86a,
    attackClip: 'Unarmed_Melee_Attack_Punch_B',
    walkClip: 'Walking_D_Skeletons',
  },
  abomination: {
    model: 'skeleton_warrior',
    scale: 1.62,
    tint: 0x7da06a,
    attackClip: '2H_Melee_Attack_Chop',
  },
  charnel_king: {
    model: 'skeleton_mage',
    scale: 1.9,
    tint: 0xc27a6a,
    attackClip: '2H_Melee_Attack_Slice',
    abilityClip: 'Spellcast_Summon',
  },
};

export function unitVisual(defId: string): UnitVisual {
  const v = UNIT_VISUALS[defId];
  if (!v) throw new Error(`No visual mapping for unit ${defId}`);
  return v;
}
