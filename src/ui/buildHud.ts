import type { RunState } from '../sim/run';
import { BUILDING_ORDER, BUILDINGS } from '../data/buildings';
import { BLESSING_ORDER, BLESSINGS } from '../data/blessings';
import { waveForRound } from '../data/waves';
import { ROUNDS_TO_WIN } from '../data/balance';
import type { IconSet } from '../render/iconFactory';
import { el, type Signal } from './dom';

export interface BuildHudDeps {
  selected: Signal<string | null>;
  icons: IconSet;
  onBuyBlessing(id: string): void;
  onStartBattle(): void;
}

export interface BuildHud {
  root: HTMLElement;
  refresh(run: RunState): void;
}

export function createBuildHud(deps: BuildHudDeps): BuildHud {
  const topbar = el('div', {});
  topbar.id = 'topbar';
  const shop = el('div', {});
  shop.id = 'shop';
  const bottombar = el('div', {});
  bottombar.id = 'bottombar';
  const hint = el('div', {
    class: 'hint',
    text: 'Pick a building, click a hex to place · right-click sells · Esc cancels',
  });

  const root = el('div', {}, topbar, shop, bottombar, hint);
  let tab: 'buildings' | 'blessings' = 'buildings';
  let lastRun: RunState | null = null;

  function refresh(run: RunState): void {
    lastRun = run;
    const wave = waveForRound(run.round);

    // ── Top bar ──
    topbar.replaceChildren(
      el(
        'div',
        { class: 'topbar-group' },
        el('span', { class: 'res res-gold', text: `${run.gold}`, title: 'Gold' }),
        el('span', { class: 'res res-ichor', text: `${run.ichor}`, title: 'Ichor' }),
      ),
      el('div', { class: 'night-title', text: `Night ${run.round} of ${ROUNDS_TO_WIN}` }),
      el(
        'div',
        { class: 'topbar-group wave-preview' },
        el('span', { class: 'wave-label', text: 'Horde:' }),
        ...wave.spawns.map((s) =>
          el(
            'span',
            { class: 'wave-chip', dataset: { tip: `u:${s.defId}` } },
            Object.assign(el('img', { class: 'chip-icon' }), { src: deps.icons.unit(s.defId) }),
            el('b', { text: `×${s.count}` }),
          ),
        ),
      ),
    );

    // ── Shop ──
    const tabs = el(
      'div',
      { class: 'shop-tabs' },
      el('button', {
        class: tab === 'buildings' ? 'tab active' : 'tab',
        text: 'Buildings',
        onClick: () => {
          tab = 'buildings';
          if (lastRun) refresh(lastRun);
        },
      }),
      el('button', {
        class: tab === 'blessings' ? 'tab active' : 'tab',
        text: 'Blessings',
        onClick: () => {
          tab = 'blessings';
          if (lastRun) refresh(lastRun);
        },
      }),
    );

    const cards: HTMLElement[] = [];
    if (tab === 'buildings') {
      for (const id of BUILDING_ORDER) {
        const def = BUILDINGS[id];
        const locked = run.round < def.unlockRound;
        const canAfford = run.gold >= def.costGold;
        const isSelected = deps.selected.get() === id;
        cards.push(
          el(
            'button',
            {
              class: `card${isSelected ? ' selected' : ''}${locked ? ' locked' : ''}`,
              disabled: locked || !canAfford,
              dataset: { tip: `b:${id}` },
              onClick: () => deps.selected.set(isSelected ? null : id),
            },
            Object.assign(el('img', { class: 'card-icon' }), { src: deps.icons.building(id) }),
            el('span', { class: 'card-name', text: def.name }),
            locked
              ? el('span', { class: 'card-lock', text: `Night ${def.unlockRound}` })
              : el('span', { class: 'card-cost gold', text: `${def.costGold}` }),
          ),
        );
      }
    } else {
      for (const id of BLESSING_ORDER) {
        const def = BLESSINGS[id];
        const owned = run.blessings.includes(id);
        cards.push(
          el(
            'button',
            {
              class: `card blessing${owned ? ' owned' : ''}`,
              disabled: owned || run.ichor < def.costIchor,
              dataset: { tip: `bl:${id}` },
              onClick: () => deps.onBuyBlessing(id),
            },
            el('span', { class: 'card-glyph', text: def.kind === 'active' ? '❋' : '✦' }),
            el('span', { class: 'card-name', text: def.name }),
            owned
              ? el('span', { class: 'card-lock', text: 'Sworn' })
              : el('span', { class: 'card-cost ichor', text: `${def.costIchor}` }),
          ),
        );
      }
    }
    shop.replaceChildren(tabs, el('div', { class: 'card-grid' }, ...cards));

    // ── Bottom bar ──
    bottombar.replaceChildren(
      el('button', {
        class: 'primary horn',
        text: '⚔ Sound the Horns',
        onClick: deps.onStartBattle,
      }),
    );
  }

  return { root, refresh };
}
