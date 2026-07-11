import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import type { BattleState, UnitState } from '../sim/battle/types';
import type { SimEvent } from '../sim/events';
import { battleToWorld } from './coords';
import type { AssetLibrary } from './assets';
import { unitVisual } from './unitVisuals';

// Animated character per unit: SkeletonUtils clone + AnimationMixer, driven
// by sim state (locomotion) and sim events (attacks/abilities/death).
// Animations are cosmetic — they never influence the sim.

const CROSSFADE = 0.15;
const DEATH_FADE_START = 1.4;
const DEATH_REMOVE = 2.6;

interface UnitVis {
  group: THREE.Group;
  inner: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  actions: Map<string, THREE.AnimationAction>;
  materials: THREE.MeshStandardMaterial[];
  locomotion: THREE.AnimationAction | null;
  oneshot: THREE.AnimationAction | null;
  dead: boolean;
  deathTimer: number;
  yaw: number;
  defId: string;
}

export interface BattleView {
  handleEvents(battle: BattleState, events: SimEvent[]): void;
  update(battle: BattleState | null, alpha: number, dt: number): void;
  clear(): void;
}

export function createBattleView(scene: THREE.Scene, assets: AssetLibrary): BattleView {
  const group = new THREE.Group();
  scene.add(group);
  const visuals = new Map<number, UnitVis>();

  function createVis(u: UnitState): UnitVis {
    const spec = unitVisual(u.defId);
    const gltf = assets.gltf(spec.model);
    const inner = skeletonClone(gltf.scene);

    const materials: THREE.MeshStandardMaterial[] = [];
    inner.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = mats.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        if (spec.tint) c.color.multiply(new THREE.Color(spec.tint));
        materials.push(c);
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    });

    inner.scale.setScalar(spec.scale);
    const g = new THREE.Group();
    g.add(inner);
    group.add(g);

    const vis: UnitVis = {
      group: g,
      inner,
      mixer: new THREE.AnimationMixer(inner),
      clips: gltf.animations,
      actions: new Map(),
      materials,
      locomotion: null,
      oneshot: null,
      dead: false,
      deathTimer: 0,
      yaw: u.team === 0 ? Math.PI / 2 : -Math.PI / 2,
      defId: u.defId,
    };
    setLocomotion(vis, 'Idle');
    return vis;
  }

  function action(vis: UnitVis, name: string): THREE.AnimationAction | null {
    let a = vis.actions.get(name) ?? null;
    if (a) return a;
    const clip = THREE.AnimationClip.findByName(vis.clips, name);
    if (!clip) return null;
    a = vis.mixer.clipAction(clip);
    vis.actions.set(name, a);
    return a;
  }

  function setLocomotion(vis: UnitVis, name: string): void {
    const next = action(vis, name);
    if (!next || vis.locomotion === next) return;
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(CROSSFADE).play();
    vis.locomotion?.fadeOut(CROSSFADE);
    vis.locomotion = next;
  }

  function playOneshot(vis: UnitVis, name: string, lock = false): void {
    const a = action(vis, name);
    if (!a) return;
    vis.oneshot?.fadeOut(0.08);
    a.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.08).play();
    a.clampWhenFinished = lock;
    vis.oneshot = a;
  }

  function visFor(u: UnitState): UnitVis {
    let vis = visuals.get(u.id);
    if (!vis) {
      vis = createVis(u);
      visuals.set(u.id, vis);
    }
    return vis;
  }

  function removeVis(id: number): void {
    const vis = visuals.get(id);
    if (!vis) return;
    vis.mixer.stopAllAction();
    group.remove(vis.group);
    for (const m of vis.materials) m.dispose();
    visuals.delete(id);
  }

  return {
    handleEvents(battle, events) {
      for (const e of events) {
        if (e.t === 'attack') {
          const u = battle.units[e.id];
          const vis = visuals.get(e.id);
          if (u && vis && !vis.dead) playOneshot(vis, unitVisual(u.defId).attackClip);
        } else if (e.t === 'ability') {
          const u = battle.units[e.id];
          const vis = visuals.get(e.id);
          const clip = u ? unitVisual(u.defId).abilityClip : undefined;
          if (u && vis && !vis.dead && clip) playOneshot(vis, clip);
        } else if (e.t === 'death') {
          const vis = visuals.get(e.id);
          if (vis && !vis.dead) {
            vis.dead = true;
            vis.deathTimer = 0;
            vis.locomotion?.fadeOut(CROSSFADE);
            vis.locomotion = null;
            playOneshot(vis, 'Death_A', true);
          }
        } else if (e.t === 'summon') {
          // Summoned skeletons claw their way out of the ground.
          for (const id of e.ids) {
            const u = battle.units[id];
            if (!u) continue;
            const vis = visFor(u);
            playOneshot(vis, 'Skeletons_Awaken_Standing');
          }
        }
      }
    },

    update(battle, alpha, dt) {
      if (!battle) {
        this.clear();
        return;
      }
      const units = battle.units;
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const existing = visuals.get(u.id);
        if (!u.alive && !existing) continue; // died before ever rendered

        const vis = existing ?? visFor(u);

        // Position (sim-tick interpolation).
        const x = u.prevX + (u.x - u.prevX) * alpha;
        const z = u.prevZ + (u.z - u.prevZ) * alpha;
        const p = battleToWorld(x, z);
        vis.group.position.set(p.x, 0, p.z);

        if (vis.dead) {
          vis.deathTimer += dt;
          if (vis.deathTimer > DEATH_REMOVE) {
            removeVis(u.id);
            continue;
          }
          if (vis.deathTimer > DEATH_FADE_START) {
            const f = 1 - (vis.deathTimer - DEATH_FADE_START) / (DEATH_REMOVE - DEATH_FADE_START);
            for (const m of vis.materials) {
              m.transparent = true;
              m.opacity = Math.max(0, f);
            }
          }
          vis.mixer.update(dt);
          continue;
        }

        // Facing: target while fighting, velocity while moving.
        let targetYaw = vis.yaw;
        const t = u.targetId >= 0 ? units[u.targetId] : null;
        const vx = u.x - u.prevX;
        const vz = u.z - u.prevZ;
        if (u.moving && (vx * vx + vz * vz) > 1e-8) {
          targetYaw = Math.atan2(vx, vz);
        } else if (t && t.alive) {
          targetYaw = Math.atan2(t.x - u.x, t.z - u.z);
        }
        let d = targetYaw - vis.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        vis.yaw += d * Math.min(1, dt * 12);
        vis.group.rotation.y = vis.yaw;

        // Locomotion under/after one-shots.
        if (vis.oneshot && !vis.oneshot.isRunning()) vis.oneshot = null;
        if (!vis.oneshot) {
          const walk = unitVisual(u.defId).walkClip ?? 'Running_A';
          setLocomotion(vis, u.moving ? walk : 'Idle');
        }

        vis.mixer.update(dt);
      }

      // Units removed from state entirely (shouldn't happen, but be safe).
      for (const [id] of visuals) {
        if (!units[id]) removeVis(id);
      }
    },

    clear() {
      for (const [id] of [...visuals]) removeVis(id);
    },
  };
}
