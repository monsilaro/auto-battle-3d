import * as THREE from 'three';
import { CELL_COUNT } from '../sim/village';
import { cellToWorld, HEX_SIZE } from './coords';
import type { AssetLibrary, ModelKey } from './assets';

// Real building models on hex-tile bases. Buildings auto-fit to the cell
// footprint; each cell gets a darkened hex_grass tile so the village reads
// as a board even when empty.

export const BUILDING_MODELS: Record<string, ModelKey> = {
  hovel: 'b_home',
  mustering_yard: 'b_barracks',
  sellsword_post: 'b_tavern',
  fletchers_hut: 'b_archery',
  chapel_pale: 'b_church',
  cinder_forge: 'b_blacksmith',
  blood_altar: 'b_shrine',
  iron_keep: 'b_castle',
};

const HEX_WIDTH = HEX_SIZE * 2; // flat-top: bbox x
const HEX_ACROSS = HEX_SIZE * Math.sqrt(3); // flat-top: bbox z

export interface VillageView {
  sync(grid: readonly (string | null)[]): void;
  setGhost(cellIndex: number, defId: string | null, valid: boolean): void;
}

export function createVillageView(scene: THREE.Scene, assets: AssetLibrary): VillageView {
  const group = new THREE.Group();
  scene.add(group);
  const meshes: (THREE.Object3D | null)[] = new Array(CELL_COUNT).fill(null);

  const fitCache = new Map<ModelKey, number>();
  function fittedClone(key: ModelKey, footprintFactor: number): THREE.Object3D {
    const src = assets.gltf(key).scene;
    let scale = fitCache.get(key);
    if (scale === undefined) {
      const box = new THREE.Box3().setFromObject(src);
      const size = new THREE.Vector3();
      box.getSize(size);
      scale = Math.min(HEX_WIDTH / Math.max(size.x, 0.01), HEX_ACROSS / Math.max(size.z, 0.01));
      fitCache.set(key, scale);
    }
    const clone = src.clone(true);
    clone.scale.setScalar(scale * footprintFactor);
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return clone;
  }

  // Board tiles — procedural hex prisms, one per cell. Built from the same
  // grid math as the sim so alignment is exact. thetaStart = π/2 puts a
  // corner on +x, matching HEX_CORNERS (flat-top).
  {
    const tileGeo = new THREE.CylinderGeometry(
      HEX_SIZE * 0.985,
      HEX_SIZE * 1.03,
      0.12,
      6,
      1,
      false,
      Math.PI / 2,
    );
    const topMat = new THREE.MeshStandardMaterial({ color: 0x3a4452, roughness: 0.95 });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x222933, roughness: 1 });
    const tiles = new THREE.InstancedMesh(tileGeo, [sideMat, topMat, sideMat], CELL_COUNT);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < CELL_COUNT; i++) {
      const p = cellToWorld(i);
      tmp.position.set(p.x, 0.03, p.z);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      tiles.setMatrixAt(i, tmp.matrix);
    }
    tiles.receiveShadow = true;
    group.add(tiles);
  }

  // Ghost preview.
  let ghost: THREE.Object3D | null = null;
  let ghostDefId: string | null = null;
  const ghostMatValid = new THREE.MeshStandardMaterial({
    color: 0x3fae5a,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const ghostMatInvalid = ghostMatValid.clone();
  ghostMatInvalid.color.setHex(0xb03a3a);

  function buildGhost(defId: string): void {
    if (ghost) group.remove(ghost);
    ghost = fittedClone(BUILDING_MODELS[defId], 0.98);
    ghost.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = ghostMatValid;
        m.castShadow = false;
        m.receiveShadow = false;
      }
    });
    ghostDefId = defId;
    group.add(ghost);
  }

  return {
    sync(grid) {
      for (let i = 0; i < CELL_COUNT; i++) {
        const defId = grid[i];
        const existing = meshes[i];
        const currentId = (existing?.userData.defId as string | undefined) ?? null;
        if (defId === currentId) continue;
        if (existing) {
          group.remove(existing);
          meshes[i] = null;
        }
        if (defId) {
          const model = fittedClone(BUILDING_MODELS[defId], 0.98);
          const p = cellToWorld(i);
          model.position.set(p.x, 0.09, p.z);
          model.rotation.y = ((i % 6) * Math.PI) / 3; // deterministic variety
          model.userData.defId = defId;
          group.add(model);
          meshes[i] = model;
        }
      }
    },

    setGhost(cellIndex, defId, valid) {
      if (cellIndex < 0 || !defId) {
        if (ghost) ghost.visible = false;
        return;
      }
      if (defId !== ghostDefId) buildGhost(defId);
      const g = ghost!;
      const mat = valid ? ghostMatValid : ghostMatInvalid;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.material = mat;
      });
      const p = cellToWorld(cellIndex);
      g.position.set(p.x, 0.09, p.z);
      g.visible = true;
    },
  };
}
