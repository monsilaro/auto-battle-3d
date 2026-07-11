import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import type { AssetLibrary, ModelKey } from './assets';
import { UNIT_VISUALS } from './unitVisuals';
import { BUILDING_MODELS } from './villageView';

// Renders each building/unit model once into an offscreen canvas and returns
// data-URL thumbnails — real icons that always match the in-world models.

export interface IconSet {
  building(defId: string): string;
  unit(defId: string): string;
}

const SIZE = 96;

export function renderIcons(assets: AssetLibrary): IconSet {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(SIZE, SIZE);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0x8ea2c8, 0x3a352f, 1.6));
  const key = new THREE.DirectionalLight(0xfff2dd, 2.6);
  key.position.set(3, 5, 4);
  scene.add(key);

  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const sphere = new THREE.Sphere();

  function snapshot(subject: THREE.Object3D): string {
    scene.add(subject);
    box.setFromObject(subject);
    box.getBoundingSphere(sphere);
    box.getCenter(center);
    const dist = sphere.radius * 2.3;
    camera.position.set(center.x + dist * 0.72, center.y + dist * 0.55, center.z + dist * 0.72);
    camera.lookAt(center);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(subject);
    return url;
  }

  const buildingIcons = new Map<string, string>();
  for (const [defId, modelKey] of Object.entries(BUILDING_MODELS)) {
    buildingIcons.set(defId, snapshot(assets.gltf(modelKey).scene.clone(true)));
  }

  const unitIcons = new Map<string, string>();
  for (const [defId, spec] of Object.entries(UNIT_VISUALS)) {
    const subject = skeletonClone(assets.gltf(spec.model as ModelKey).scene);
    if (spec.tint) {
      subject.traverse((o: THREE.Object3D) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = mats.map((m) => {
          const c = (m as THREE.MeshStandardMaterial).clone();
          c.color.multiply(new THREE.Color(spec.tint!));
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      });
    }
    unitIcons.set(defId, snapshot(subject));
  }

  renderer.dispose();

  return {
    building: (defId) => buildingIcons.get(defId) ?? '',
    unit: (defId) => unitIcons.get(defId) ?? '',
  };
}
