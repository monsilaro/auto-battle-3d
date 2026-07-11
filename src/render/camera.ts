import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Fixed isometric-ish view with limited orbit freedom. The whole diorama is
// visible; the player can nudge the angle but never get lost or clip under
// the terrain.

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  update(dt: number): void;
  onResize(): void;
}

export function createCameraRig(canvas: HTMLCanvasElement): CameraRig {
  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    300,
  );
  camera.position.set(2, 38, 34);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(2, 0, 0); // between village and battlefield
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 20;
  controls.maxDistance = 60;
  controls.minPolarAngle = THREE.MathUtils.degToRad(30);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(55);
  controls.minAzimuthAngle = THREE.MathUtils.degToRad(-35);
  controls.maxAzimuthAngle = THREE.MathUtils.degToRad(35);
  controls.update();

  return {
    camera,
    controls,
    update() {
      controls.update();
    },
    onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    },
  };
}
