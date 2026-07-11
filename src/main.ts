import * as THREE from 'three';
import './styles/main.css';
import {
  activateBlessing,
  buyBlessing,
  canPlace,
  finishBattle,
  newRun,
  placeBuilding,
  sellBuilding,
  startBattle,
  tickBattle,
  type RunState,
} from './sim/run';
import { CELL_COUNT } from './sim/village';
import { GameLoop } from './app/gameLoop';
import { appScreen } from './app/phases';
import { createRenderCore } from './render/renderer';
import { createCameraRig } from './render/camera';
import { AssetLibrary } from './render/assets';
import { createEnvironment, type Environment } from './render/environment';
import { createVillageView, type VillageView } from './render/villageView';
import { createBattleView, type BattleView } from './render/battleView';
import { createOverlays, type Overlays } from './render/healthBars';
import { renderIcons } from './render/iconFactory';
import { createPost, type Post } from './render/post';
import { createFx, type Fx } from './render/fx/particles';
import { battleToWorld, worldToCell } from './render/coords';
import { audio } from './audio/audio';
import { createDebugOverlay } from './ui/debugOverlay';
import { el, signal } from './ui/dom';
import { initScreens, registerScreen, showScreen } from './ui/screens';
import { initTooltips } from './ui/tooltip';
import { registerGameTips } from './ui/tips';
import { createMainMenu } from './ui/mainMenu';
import { createBuildHud, type BuildHud } from './ui/buildHud';
import { createBattleHud, type BattleHud } from './ui/battleHud';
import { createResultScreen } from './ui/resultScreens';

// ── Core setup (pre-asset) ──────────────────────────────────────────
const mount = document.getElementById('app')!;
const uiRoot = document.getElementById('ui')!;
const core = createRenderCore(mount);
const cameraRig = createCameraRig(core.canvas);

window.addEventListener('resize', () => {
  core.renderer.setSize(window.innerWidth, window.innerHeight);
  post?.setSize(window.innerWidth, window.innerHeight);
  cameraRig.onResize();
});

initScreens(uiRoot);

// Loading screen first — everything else builds after assets resolve.
const progressInner = el('div', { class: 'progress-inner' });
const loadingScreen = el(
  'div',
  { class: 'screen' },
  el('h1', { text: 'Gravemarch' }),
  el('p', { text: 'The Pale Court stirs...' }),
  el('div', { class: 'progress-outer' }, progressInner),
);
registerScreen('loading', loadingScreen);
showScreen('loading');

// ── Game state ──────────────────────────────────────────────────────
let run: RunState | null = null;
const selectedBuilding = signal<string | null>(null);

let env: Environment;
let villageView: VillageView;
let battleView: BattleView;
let overlays: Overlays;
let post: Post;
let fx: Fx;

const assets = new AssetLibrary();
const debug = createDebugOverlay(uiRoot);

const loop = new GameLoop(onTick, onRender);

// ── UI (constructed immediately; views wired after load) ────────────
const menu = createMainMenu((seed) => {
  audio.unlock(); // user gesture — safe to start the AudioContext
  run = newRun(seed);
  selectedBuilding.set(null);
  appScreen.set('game');
  syncAll();
});
registerScreen('menu', menu);

let result: { root: HTMLElement; show(run: RunState): void };
let buildHud: BuildHud;
let battleHud: BattleHud;

// HUDs need rendered icons — built inside boot() after assets resolve.
function buildUi(): void {
  const icons = renderIcons(assets);
  initTooltips(uiRoot);
  registerGameTips(icons);

  result = createResultScreen(
    icons,
    () => {
      run = newRun((Math.random() * 0xffffffff) | 0);
      selectedBuilding.set(null);
      syncAll();
    },
    () => {
      run = null;
      appScreen.set('menu');
      battleView.clear();
      villageView.sync(new Array(CELL_COUNT).fill(null));
      overlays.refreshVillage(null);
      showScreen('menu');
    },
  );
  registerScreen('result', result.root);

  buildHud = createBuildHud({
    selected: selectedBuilding,
    icons,
    onBuyBlessing(id) {
      if (run && buyBlessing(run, id)) {
        audio.play('coin');
        syncAll();
      }
    },
    onStartBattle() {
      if (!run) return;
      if (startBattle(run)) {
        audio.play('horn');
        selectedBuilding.set(null);
        syncAll();
      }
    },
  });
  buildHud.root.classList.add('hidden');
  uiRoot.appendChild(buildHud.root);

  battleHud = createBattleHud({
    getSpeed: () => loop.speed,
    onToggleSpeed() {
      loop.speed = loop.speed === 1 ? 2 : 1;
      if (run) battleHud.refresh(run);
    },
    onActivate(id) {
      if (run && activateBlessing(run, id)) battleHud.refresh(run);
    },
    onContinue() {
      if (!run) return;
      finishBattle(run);
      battleView.clear();
      syncAll();
    },
  });
  battleHud.root.classList.add('hidden');
  uiRoot.appendChild(battleHud.root);

  selectedBuilding.sub(() => {
    if (run && run.phase === 'build') buildHud.refresh(run);
    updateGhost();
  });
}

// ── Sync: single place where UI/render catch up with sim state ──────
function syncAll(): void {
  if (!run) return;
  villageView.sync(run.grid);
  overlays.refreshVillage(run);
  env.setHexGridVisible(run.phase === 'build');

  const inBuild = run.phase === 'build';
  const inBattle = run.phase === 'battle';
  buildHud.root.classList.toggle('hidden', !inBuild);
  battleHud.root.classList.toggle('hidden', !inBattle);

  if (inBuild) {
    buildHud.refresh(run);
    showScreen(null);
  } else if (inBattle) {
    battleHud.refresh(run);
    showScreen(null);
  } else {
    result.show(run);
    showScreen('result');
  }
  updateGhost();
}

// ── Sim tick ────────────────────────────────────────────────────────
function onTick(): void {
  if (!run || run.phase !== 'battle' || !run.battle) return;
  if (run.battle.status !== 'running') return;
  const battle = run.battle;
  const events = tickBattle(run);
  battleView.handleEvents(battle, events);

  for (const e of events) {
    if (e.t === 'hit') {
      const u = battle.units[e.id];
      if (u) {
        const p = battleToWorld(u.x, u.z);
        fx.hitBurst(p.x, 0, p.z);
      }
      audio.play('hit');
    } else if (e.t === 'death') {
      const u = battle.units[e.id];
      if (u) {
        const p = battleToWorld(u.x, u.z);
        fx.deathBurst(p.x, 0, p.z, u.team === 1);
      }
      audio.play('death');
    } else if (e.t === 'blessing') {
      // Burst at the horde's center of mass.
      let cx = 0;
      let cz = 0;
      let n = 0;
      for (const u of battle.units) {
        if (u.alive && u.team === 1) {
          cx += u.x;
          cz += u.z;
          n++;
        }
      }
      if (n > 0) {
        const p = battleToWorld(cx / n, cz / n);
        fx.blessingBurst(p.x, 0, p.z);
      }
      audio.play('blessing');
    } else if (e.t === 'battleEnd') {
      audio.play(e.status === 'victory' ? 'victory' : 'defeat');
      battleHud.refresh(run);
      return;
    }
  }
  if (battle.tick % 10 === 0) battleHud.refresh(run);
}

// Perf accounting for the debug overlay.
let fpsEma = 60;
let debugTimer = 0;

function onRender(alpha: number, dt: number): void {
  const frameStart = performance.now();
  env?.update(dt);
  fx?.update(dt);
  battleView?.update(run?.battle ?? null, alpha, dt);
  overlays?.update(run, cameraRig.camera, alpha);
  cameraRig.update(dt);
  if (post) post.render(dt);
  else core.renderer.render(core.scene, cameraRig.camera);

  if (debug.visible()) {
    fpsEma = fpsEma * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
    debugTimer -= dt;
    if (debugTimer <= 0) {
      debugTimer = 0.25;
      let units = 0;
      if (run?.battle) for (const u of run.battle.units) if (u.alive) units++;
      debug.update({
        fps: fpsEma,
        frameMs: performance.now() - frameStart,
        drawCalls: core.renderer.info.render.calls,
        triangles: core.renderer.info.render.triangles,
        units,
        postEnabled: post?.enabled ?? false,
      });
    }
  }
}

// ── Placement input ─────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();
const hitPoint = new THREE.Vector3();
let hoverCell = -1;

function cellFromPointer(e: PointerEvent | MouseEvent): number {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, cameraRig.camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return -1;
  return worldToCell(hitPoint.x, hitPoint.z);
}

function updateGhost(): void {
  const defId = selectedBuilding.get();
  if (!run || run.phase !== 'build' || !defId || hoverCell < 0) {
    villageView.setGhost(-1, null, false);
    return;
  }
  villageView.setGhost(hoverCell, defId, canPlace(run, hoverCell, defId).ok);
}

core.canvas.addEventListener('pointermove', (e) => {
  hoverCell = cellFromPointer(e);
  updateGhost();
});

core.canvas.addEventListener('click', (e) => {
  if (!run || run.phase !== 'build') return;
  const defId = selectedBuilding.get();
  if (!defId) return;
  const cell = cellFromPointer(e);
  if (cell >= 0 && placeBuilding(run, cell, defId)) {
    audio.play('build');
    syncAll();
  }
});

core.canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!run || run.phase !== 'build') return;
  if (selectedBuilding.get()) {
    selectedBuilding.set(null);
    return;
  }
  const cell = cellFromPointer(e);
  if (cell >= 0 && run.grid[cell] && sellBuilding(run, cell)) {
    audio.play('sell');
    syncAll();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') selectedBuilding.set(null);
  else if (e.key === '`') debug.toggle();
  else if (e.key === 'p' || e.key === 'P') post?.toggle();
  else if (e.key === 'm' || e.key === 'M') audio.toggleMute();
});

// ── Boot ────────────────────────────────────────────────────────────
async function boot(): Promise<void> {
  await assets.loadAll((done, total) => {
    progressInner.style.width = `${((100 * done) / total).toFixed(0)}%`;
  });
  env = createEnvironment(core.scene, assets);
  villageView = createVillageView(core.scene, assets);
  battleView = createBattleView(core.scene, assets);
  overlays = createOverlays(uiRoot);
  fx = createFx(core.scene, env.emberSpots);
  post = createPost(core.renderer, core.scene, cameraRig.camera);
  buildUi();
  showScreen('menu');
  loop.start();
}

boot().catch((err) => {
  loadingScreen.replaceChildren(
    el('h2', { text: 'Failed to load' }),
    el('p', { text: String(err) }),
  );
  console.error(err);
});
