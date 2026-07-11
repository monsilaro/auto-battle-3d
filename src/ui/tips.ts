import { BUILDINGS, buildingDef } from '../data/buildings';
import { BLESSINGS, blessingDef } from '../data/blessings';
import { UNITS, unitDef } from '../data/units';
import type { IconSet } from '../render/iconFactory';
import { abilityText, attacksPerSecond, buildingRules } from './format';
import { el } from './dom';
import { registerTip } from './tooltip';

// Registers every def tooltip. Keys: 'b:<id>' buildings, 'u:<id>' units,
// 'bl:<id>' blessings.

function unitStatsBlock(defId: string): HTMLElement {
  const def = unitDef(defId);
  const rows: [string, string][] = [
    ['HP', `${def.maxHp}`],
    ['Armor', `${def.armor}`],
    ['Damage', `${def.damage}`],
    ['Attacks/s', attacksPerSecond(def)],
    ['Range', def.rangeM < 3 ? 'Melee' : `${def.rangeM}m`],
    ['Speed', `${def.moveSpeed}`],
  ];
  const ability = abilityText(def.ability);
  return el(
    'div',
    { class: 'tip-unit' },
    el(
      'div',
      { class: 'tip-head' },
      el('img', { class: 'tip-icon' }) as HTMLImageElement,
      el('span', { class: 'tip-name', text: def.name }),
    ),
    el(
      'div',
      { class: 'tip-stats' },
      ...rows.map(([k, v]) =>
        el('span', { class: 'tip-stat' }, el('b', { text: v }), el('i', { text: k })),
      ),
    ),
    ability ? el('div', { class: 'tip-ability', text: ability }) : null,
    def.piercing ? el('div', { class: 'tip-ability', text: 'Attacks ignore armor.' }) : null,
  );
}

export function registerGameTips(icons: IconSet): void {
  for (const id of Object.keys(UNITS)) {
    registerTip(`u:${id}`, () => {
      const block = unitStatsBlock(id);
      const img = block.querySelector('img')!;
      img.src = icons.unit(id);
      return block;
    });
  }

  for (const id of Object.keys(BUILDINGS)) {
    const def = buildingDef(id);
    registerTip(`b:${id}`, () => {
      const rules = buildingRules(def);
      const grantedIds = [...new Set((def.grantsUnits ?? []).map((g) => g.defId))];
      return el(
        'div',
        {},
        el(
          'div',
          { class: 'tip-head' },
          Object.assign(el('img', { class: 'tip-icon' }), { src: icons.building(def.id) }),
          el(
            'div',
            {},
            el('span', { class: 'tip-name', text: def.name }),
            el('span', { class: 'tip-sub', text: `${def.costGold} Gold · unlocks Night ${def.unlockRound}` }),
          ),
        ),
        el('div', { class: 'tip-desc', text: def.desc }),
        el('div', { class: 'tip-rules' }, ...rules.map((r) => el('div', { class: 'tip-rule', text: `◆ ${r}` }))),
        ...grantedIds.map((unitId) => {
          const block = unitStatsBlock(unitId);
          const img = block.querySelector('img')!;
          img.src = icons.unit(unitId);
          return block;
        }),
      );
    });
  }

  for (const id of Object.keys(BLESSINGS)) {
    const def = blessingDef(id);
    registerTip(`bl:${id}`, () =>
      el(
        'div',
        {},
        el(
          'div',
          { class: 'tip-head' },
          el('span', { class: 'tip-glyph', text: '✦' }),
          el(
            'div',
            {},
            el('span', { class: 'tip-name', text: def.name }),
            el('span', {
              class: 'tip-sub',
              text: `${def.costIchor} Ichor · ${def.kind === 'active' ? 'Active — once per battle' : 'Passive'}`,
            }),
          ),
        ),
        el('div', { class: 'tip-desc', text: def.desc }),
      ),
    );
  }
}
