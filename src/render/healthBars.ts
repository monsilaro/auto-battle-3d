import * as THREE from 'three';
import type { RunState } from '../sim/run';
import type { BattleState } from '../sim/battle/types';
import { deriveWarband } from '../sim/warband';
import { battleToWorld, cellToWorld } from './coords';
import { unitVisual } from './unitVisuals';

// DOM-projected overlays: unit health bars (battle) and per-building
// unit-count badges (build phase). Pooled divs, repositioned every frame.

const BAR_POOL = 120;
const BADGE_POOL = 40;

export interface Overlays {
  refreshVillage(run: RunState | null): void;
  update(run: RunState | null, camera: THREE.PerspectiveCamera, alpha: number): void;
}

export function createOverlays(uiRoot: HTMLElement): Overlays {
  const layer = document.createElement('div');
  layer.id = 'overlay-layer';
  uiRoot.appendChild(layer);

  const bars: { root: HTMLDivElement; fill: HTMLDivElement }[] = [];
  for (let i = 0; i < BAR_POOL; i++) {
    const root = document.createElement('div');
    root.className = 'hpbar hidden';
    const fill = document.createElement('div');
    fill.className = 'hpbar-fill';
    root.appendChild(fill);
    layer.appendChild(root);
    bars.push({ root, fill });
  }

  const badges: HTMLDivElement[] = [];
  for (let i = 0; i < BADGE_POOL; i++) {
    const b = document.createElement('div');
    b.className = 'unit-badge hidden';
    layer.appendChild(b);
    badges.push(b);
  }

  // cellIndex → fielded unit count, cached on village change.
  let cellCounts = new Map<number, number>();

  const v = new THREE.Vector3();
  function project(camera: THREE.PerspectiveCamera, x: number, y: number, z: number): { sx: number; sy: number } | null {
    v.set(x, y, z).project(camera);
    if (v.z > 1) return null;
    return {
      sx: (v.x * 0.5 + 0.5) * window.innerWidth,
      sy: (-v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  return {
    refreshVillage(run) {
      cellCounts = new Map();
      if (!run) return;
      for (const entry of deriveWarband(run.grid, run.blessings)) {
        cellCounts.set(entry.sourceCell, (cellCounts.get(entry.sourceCell) ?? 0) + 1);
      }
    },

    update(run, camera, alpha) {
      // ── Unit health bars ──
      let barIdx = 0;
      const battle: BattleState | null = run?.battle ?? null;
      if (battle) {
        for (const u of battle.units) {
          if (!u.alive || u.hp >= u.maxHp || barIdx >= BAR_POOL) continue;
          const x = u.prevX + (u.x - u.prevX) * alpha;
          const z = u.prevZ + (u.z - u.prevZ) * alpha;
          const p = battleToWorld(x, z);
          const height = 2.15 * unitVisual(u.defId).scale;
          const s = project(camera, p.x, height, p.z);
          if (!s) continue;
          const bar = bars[barIdx++];
          bar.root.classList.remove('hidden');
          bar.root.classList.toggle('enemy', u.team === 1);
          bar.root.style.transform = `translate3d(${(s.sx - 22).toFixed(1)}px, ${s.sy.toFixed(1)}px, 0)`;
          bar.fill.style.width = `${((100 * u.hp) / u.maxHp).toFixed(0)}%`;
        }
      }
      for (let i = barIdx; i < BAR_POOL; i++) bars[i].root.classList.add('hidden');

      // ── Building badges (build phase only) ──
      let badgeIdx = 0;
      if (run && run.phase === 'build') {
        for (const [cell, count] of cellCounts) {
          if (badgeIdx >= BADGE_POOL) break;
          const p = cellToWorld(cell);
          const s = project(camera, p.x, 2.6, p.z);
          if (!s) continue;
          const badge = badges[badgeIdx++];
          badge.classList.remove('hidden');
          badge.textContent = `⚔ ${count}`;
          badge.style.transform = `translate3d(${s.sx.toFixed(1)}px, ${s.sy.toFixed(1)}px, 0)`;
        }
      }
      for (let i = badgeIdx; i < BADGE_POOL; i++) badges[i].classList.add('hidden');
    },
  };
}
