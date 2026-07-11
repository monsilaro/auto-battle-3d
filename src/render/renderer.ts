import * as THREE from 'three';

export interface RenderCore {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  canvas: HTMLCanvasElement;
}

export function createRenderCore(mount: HTMLElement): RenderCore {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e16);
  scene.fog = new THREE.FogExp2(0x131a26, 0.008);

  // Lighting rig v0 — cold moon + dusk ambient. Tuned properly in M4.
  const moon = new THREE.DirectionalLight(0xb8c8e8, 3.0);
  moon.position.set(-20, 35, -15);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -40;
  moon.shadow.camera.right = 40;
  moon.shadow.camera.top = 40;
  moon.shadow.camera.bottom = -40;
  moon.shadow.camera.far = 100;
  moon.shadow.bias = -0.0005;
  scene.add(moon);

  const hemi = new THREE.HemisphereLight(0x36466a, 0x1a1815, 1.2);
  scene.add(hemi);

  return { renderer, scene, canvas: renderer.domElement };
}
