import type { RunState } from '../sim/run';
import { unitDef } from '../data/units';
import type { IconSet } from '../render/iconFactory';
import { blessingDef } from '../data/blessings';
import { el } from './dom';

export function createResultScreen(
  icons: IconSet,
  onRestart: () => void,
  onMenu: () => void,
): {
  root: HTMLElement;
  show(run: RunState): void;
} {
  const content = el('div', { class: 'screen' });

  function show(run: RunState): void {
    const won = run.phase === 'won';
    const last = run.lastBattle;

    const cause =
      !won && last
        ? `Fell on Night ${last.round} — ${last.rosterSize - last.survivors} of ${last.rosterSize} warriors slain, ` +
          `taking ${last.kills} of the horde with them.`
        : won
          ? 'Ten nights held. The Pale Court recedes... for now.'
          : '';

    // Damage-by-unit table (top 8).
    const dmgRows = Object.entries(run.damageByDef)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const maxDmg = dmgRows.length ? dmgRows[0][1] : 1;

    // Gold income sparkbars.
    const maxGold = Math.max(1, ...run.goldByRound);

    content.replaceChildren(
      el('h2', { class: won ? 'gold-title' : 'blood-title', text: won ? 'Dawn Breaks' : 'The March Ends' }),
      el('p', { class: 'result-cause', text: cause }),
      el(
        'div',
        { class: 'summary-grid' },
        el(
          'div',
          { class: 'summary-panel' },
          el('h3', { text: 'Damage Dealt' }),
          ...(dmgRows.length === 0 ? [el('p', { text: '—' })] : []),
          ...dmgRows.map(([defId, dmg]) =>
            el(
              'div',
              { class: 'dmg-row', dataset: { tip: `u:${defId}` } },
              Object.assign(el('img', { class: 'chip-icon' }), { src: icons.unit(defId) }),
              el('span', { class: 'dmg-name', text: unitDef(defId).name }),
              el(
                'span',
                { class: 'dmg-bar-wrap' },
                el('span', { class: 'dmg-bar', style: `width:${((100 * dmg) / maxDmg).toFixed(0)}%` }),
              ),
              el('span', { class: 'dmg-val', text: `${dmg}` }),
            ),
          ),
        ),
        el(
          'div',
          { class: 'summary-panel' },
          el('h3', { text: 'The Run' }),
          el('p', { text: `Nights survived: ${won ? 10 : (last?.round ?? run.round) - (won ? 0 : 1)}` }),
          el('p', { text: `Enemies slain: ${run.totalKills}` }),
          el(
            'p',
            {},
            'Oaths sworn: ',
            run.blessings.length === 0
              ? '—'
              : run.blessings.map((b) => blessingDef(b).name).join(', '),
          ),
          el('h3', { text: 'Gold per Night' }),
          el(
            'div',
            { class: 'gold-chart' },
            ...run.goldByRound.map((g, i) =>
              el('span', {
                class: 'gold-col',
                style: `height:${Math.max(8, (100 * g) / maxGold).toFixed(0)}%`,
                title: `Night ${i + 1}: +${g} gold`,
              }),
            ),
          ),
        ),
      ),
      el(
        'div',
        { class: 'result-actions' },
        el('button', { class: 'primary', text: 'March Again', onClick: onRestart }),
        el('button', { text: 'Main Menu', onClick: onMenu }),
      ),
    );
  }

  return { root: content, show };
}
