import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

// Central asset registry. Everything loads up-front behind the loading
// screen — total payload is small (~37 MB uncompressed, served locally).

export const MODEL_MANIFEST = {
  // Characters (rigged + animated)
  knight: 'models/units/Knight.glb',
  barbarian: 'models/units/Barbarian.glb',
  mage: 'models/units/Mage.glb',
  rogue: 'models/units/Rogue.glb',
  rogue_hooded: 'models/units/Rogue_Hooded.glb',
  skeleton_warrior: 'models/units/Skeleton_Warrior.glb',
  skeleton_minion: 'models/units/Skeleton_Minion.glb',
  skeleton_mage: 'models/units/Skeleton_Mage.glb',
  skeleton_rogue: 'models/units/Skeleton_Rogue.glb',
  // Buildings
  b_home: 'models/hex/building_home_A_red.gltf',
  b_barracks: 'models/hex/building_barracks_red.gltf',
  b_tavern: 'models/hex/building_tavern_red.gltf',
  b_archery: 'models/hex/building_archeryrange_red.gltf',
  b_church: 'models/hex/building_church_red.gltf',
  b_blacksmith: 'models/hex/building_blacksmith_red.gltf',
  b_castle: 'models/hex/building_castle_red.gltf',
  b_shrine: 'models/spooky/shrine_candles.gltf',
  // Environment / props
  hex_grass: 'models/hex/hex_grass.gltf',
  rock_a: 'models/hex/rock_single_A.gltf',
  rock_b: 'models/hex/rock_single_B.gltf',
  rock_c: 'models/hex/rock_single_C.gltf',
  rock_d: 'models/hex/rock_single_D.gltf',
  rock_e: 'models/hex/rock_single_E.gltf',
  tree_a: 'models/hex/tree_single_A.gltf',
  tree_b: 'models/hex/tree_single_B.gltf',
  gravestone: 'models/spooky/gravestone.gltf',
  grave_a: 'models/spooky/grave_A.gltf',
  grave_b: 'models/spooky/grave_B.gltf',
  tree_dead_l: 'models/spooky/tree_dead_large.gltf',
  tree_dead_m: 'models/spooky/tree_dead_medium.gltf',
  tree_dead_s: 'models/spooky/tree_dead_small.gltf',
  crypt: 'models/spooky/crypt.gltf',
  fence_broken: 'models/spooky/fence_broken.gltf',
  post_lantern: 'models/spooky/post_lantern.gltf',
  bone: 'models/spooky/bone_A.gltf',
  skull: 'models/spooky/skull.gltf',
} as const;

export type ModelKey = keyof typeof MODEL_MANIFEST;

export class AssetLibrary {
  private gltfs = new Map<ModelKey, GLTF>();

  async loadAll(onProgress: (done: number, total: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const entries = Object.entries(MODEL_MANIFEST) as [ModelKey, string][];
    let done = 0;
    onProgress(0, entries.length);
    await Promise.all(
      entries.map(async ([key, path]) => {
        const gltf = await loader.loadAsync(import.meta.env.BASE_URL + path);
        this.gltfs.set(key, gltf);
        done++;
        onProgress(done, entries.length);
      }),
    );
  }

  gltf(key: ModelKey): GLTF {
    const g = this.gltfs.get(key);
    if (!g) throw new Error(`Asset not loaded: ${key}`);
    return g;
  }
}
