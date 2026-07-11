import type { RunState } from '../sim/run';
import { BLESSINGS } from '../data/blessings';
import { ROUNDS_TO_WIN } from '../data/balance';
import { el } from './dom';

export interface BattleHudDeps {
  getSpeed(): number;
  onToggleSpeed(): void;
  onActivate(id: string): void;
  onContinue(): void;
}

export interface BattleHud {
  root: HTMLElement;
  refresh(run: RunState): void;
}

export function createBattleHud(deps: BattleHudDeps): BattleHud {
  const topbar = el('div', {});
  topbar.id = 'topbar';
  const bottombar = el('div', {});
  bottombar.id = 'bottombar';
  const banner = el('div', { class: 'banner hidden' });
  const root = el('div', {}, topbar, bottombar, banner);

  function refresh(run: RunState): void {
    const battle = run.battle;
    if (!battle) return;

    let players = 0;
    let enemies = 0;
    let playerHp = 0;
    let enemyHp = 0;
    for (const u of battle.units) {
      if (!u.alive) continue;
      if (u.team === 0) {
        players++;
        playerHp += u.hp;
      } else {
        enemies++;
        enemyHp += u.hp;
      }
    }
    const totalHp = playerHp + enemyHp;
    const pct = totalHp > 0 ? (100 * playerHp) / totalHp : 50;

    // ── Top: night + tug-of-war bar ──
    topbar.replaceChildren(
      el(
        'div',
        { class: 'tug-wrap' },
        el('div', { class: 'night-title', text: `Night ${run.round} of ${ROUNDS_TO_WIN}` }),
        el(
          'div',
          { class: 'tug-bar' },
          el('div', { class: 'tug-left', style: `width:${pct.toFixed(1)}%` }),
        ),
        el(
          'div',
          { class: 'tug-counts' },
          el('span', { class: 'tug-warband', text: `⚔ ${players}` }),
          el('span', { class: 'tug-horde', text: `${enemies} 💀` }),
        ),
      ),
    );

    // ── Bottom: controls or continue ──
    const controls: HTMLElement[] = [];
    if (battle.status === 'running') {
      controls.push(
        el('button', {
          text: `⏩ ${deps.getSpeed()}×`,
          title: 'Toggle battle speed',
          onClick: deps.onToggleSpeed,
        }),
      );
      for (const id of run.blessings) {
        const def = BLESSINGS[id as keyof typeof BLESSINGS];
        if (!def || def.kind !== 'active') continue;
        const used = battle.usedActives.includes(id) || battle.queuedActives.includes(id);
        controls.push(
          el('button', {
            class: used ? 'blessing-btn spent' : 'blessing-btn',
            disabled: used,
            dataset: { tip: `bl:${id}` },
            text: used ? `❋ ${def.name} — spent` : `❋ ${def.name}`,
            onClick: () => deps.onActivate(id),
          }),
        );
      }
      banner.classList.add('hidden');
    } else {
      const won = battle.status === 'victory';
      banner.textContent = won ? 'The night is held.' : 'The warband falls.';
      banner.classList.toggle('defeat', !won);
      banner.classList.remove('hidden');
      controls.push(
        el('button', {
          class: 'primary',
          text: won ? 'Continue' : 'Witness the End',
          onClick: deps.onContinue,
        }),
      );
    }
    bottombar.replaceChildren(...controls);
  }

  return { root, refresh };
}
