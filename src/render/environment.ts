import * as THREE from 'three';
import { CELLS } from '../sim/village';
import { Rng } from '../sim/rng';
import { cellToWorld, HEX_CORNERS, HEX_SIZE } from './coords';
import type { AssetLibrary, ModelKey } from './assets';

// Diorama island: wobbled landmass over a dark ocean, chunky rock rim,
// graveyard on the horde side, lantern posts by the village. Prop scatter
// uses a fixed seed so the island looks identical every load.

const ISLAND_CENTER = { x: 2, z: 0 };
const ISLAND_RX = 37;
const ISLAND_RZ = 25;

function islandRadius(angle: number): number {
  return 1 + 0.07 * Math.sin(3 * angle + 1.7) + 0.05 * Math.sin(7 * angle + 0.4);
}

export interface Environment {
  group: THREE.Group;
  setHexGridVisible(v: boolean): void;
  emberSpots: { x: number; z: number }[];
  update(dt: number): void;
}

export function createEnvironment(scene: THREE.Scene, assets: AssetLibrary): Environment {
  const group = new THREE.Group();
  const rng = new Rng(0x5eed);

  // ── Landmass ──
  const shape = new THREE.Shape();
  const STEPS = 64;
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    const w = islandRadius(a);
    const x = ISLAND_CENTER.x + Math.cos(a) * ISLAND_RX * w;
    const y = -(ISLAND_CENTER.z + Math.sin(a) * ISLAND_RZ * w); // shape XY → world XZ
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const islandGeo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
  const islandMat = new THREE.MeshStandardMaterial({ color: 0x2b3a2e, roughness: 1 });
  // Painterly radial grade: moss center → cold dark rim, plus large mottling.
  islandMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGmWorld;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvGmWorld = (modelMatrix * vec4(position, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGmWorld;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 wp = vGmWorld.xz;
          float d = length((wp - vec2(2.0, 0.0)) / vec2(37.0, 25.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.095, 0.115), smoothstep(0.72, 1.02, d));
          float n = sin(wp.x * 0.33 + 1.7) * sin(wp.y * 0.41) + 0.5 * sin(wp.x * 0.9) * sin(wp.y * 0.7 + 0.9);
          diffuseColor.rgb *= 1.0 + 0.05 * n;
        }`,
      );
  };
  const island = new THREE.Mesh(islandGeo, islandMat);
  island.rotation.x = -Math.PI / 2;
  island.position.y = -3; // extrudes +z → top lands at y = 0
  island.receiveShadow = true;
  group.add(island);

  // ── Ash battlefield patch ──
  const ashShape = new THREE.Shape();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const w = 1 + 0.09 * Math.sin(4 * a + 0.9);
    const x = 13 + Math.cos(a) * 17.5 * w;
    const y = -(0 + Math.sin(a) * 12 * w);
    if (i === 0) ashShape.moveTo(x, y);
    else ashShape.lineTo(x, y);
  }
  const ash = new THREE.Mesh(
    new THREE.ShapeGeometry(ashShape),
    new THREE.MeshStandardMaterial({ color: 0x47443f, roughness: 1 }),
  );
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.03;
  ash.receiveShadow = true;
  group.add(ash);

  // ── Ocean — slow swell + moving color bands, one time uniform ──
  const timeUniform = { value: 0 };
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0d1826,
    roughness: 0.7,
    metalness: 0.2,
  });
  oceanMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vGmWorld;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
          transformed.z += sin(uTime * 0.7 + wp0.x * 0.14) * 0.22 + cos(uTime * 0.53 + wp0.z * 0.19) * 0.18;
          vGmWorld = wp0;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vGmWorld;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float band = sin(vGmWorld.x * 0.22 + uTime * 0.5) * sin(vGmWorld.z * 0.26 - uTime * 0.34);
          diffuseColor.rgb *= 1.0 + 0.16 * band;
          diffuseColor.rgb += vec3(0.02, 0.035, 0.05) * smoothstep(0.6, 1.0, band);
        }`,
      );
  };
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(400, 300, 96, 72), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -1.7;
  group.add(ocean);

  // ── Rock rim (instanced per rock type) ──
  const rockKeys: ModelKey[] = ['rock_a', 'rock_b', 'rock_c', 'rock_d', 'rock_e'];
  const ROCKS = 52;
  const perType: THREE.Matrix4[][] = rockKeys.map(() => []);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < ROCKS; i++) {
    const a = (i / ROCKS) * Math.PI * 2 + rng.range(-0.04, 0.04);
    const w = islandRadius(a) * rng.range(0.93, 1.0);
    tmp.position.set(
      ISLAND_CENTER.x + Math.cos(a) * ISLAND_RX * w,
      rng.range(-0.4, 0.1),
      ISLAND_CENTER.z + Math.sin(a) * ISLAND_RZ * w,
    );
    tmp.rotation.set(0, rng.range(0, Math.PI * 2), 0);
    tmp.scale.setScalar(rng.range(1.6, 3.4));
    tmp.updateMatrix();
    perType[rng.int(rockKeys.length)].push(tmp.matrix.clone());
  }
  rockKeys.forEach((key, k) => {
    const mats = perType[k];
    if (mats.length === 0) return;
    let src: THREE.Mesh | null = null;
    assets.gltf(key).scene.traverse((o) => {
      if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
    });
    if (!src) return;
    const mesh = src as THREE.Mesh;
    const material = (mesh.material as THREE.MeshStandardMaterial).clone();
    material.color.multiply(new THREE.Color(0x9aa3b5)); // cold rocks
    const inst = new THREE.InstancedMesh(mesh.geometry, material, mats.length);
    mats.forEach((m, j) => inst.setMatrixAt(j, m));
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  });

  // ── Prop scatter helper ──
  function applySway(mat: THREE.MeshStandardMaterial): void {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
            float sway = sin(uTime * 1.3 + wp0.x * 0.6 + wp0.z * 0.4) * position.y * 0.028;
            transformed.x += sway;
            transformed.z += sway * 0.6;
          }`,
        );
    };
  }

  function place(
    key: ModelKey,
    x: number,
    z: number,
    scale: number,
    rotY: number,
    tint?: number,
    sway = false,
  ): void {
    const clone = assets.gltf(key).scene.clone(true);
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        if (tint || sway) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          if (tint) mat.color.multiply(new THREE.Color(tint));
          if (sway) applySway(mat);
          m.material = mat;
        }
      }
    });
    clone.position.set(x, 0, z);
    clone.rotation.y = rotY;
    clone.scale.setScalar(scale);
    group.add(clone);
  }

  // Dead trees — village fringe + horde side.
  const deadTrees: ModelKey[] = ['tree_dead_l', 'tree_dead_m', 'tree_dead_s'];
  for (let i = 0; i < 11; i++) {
    const westSide = i < 5;
    const x = westSide ? rng.range(-23, -17) : rng.range(24, 32);
    const z = rng.range(-16, 16);
    place(deadTrees[rng.int(3)], x, z, rng.range(1.6, 2.6), rng.range(0, Math.PI * 2), 0x8b8fa0, true);
  }
  // A few cold living trees behind the village.
  for (let i = 0; i < 5; i++) {
    place(
      rng.next() < 0.5 ? 'tree_a' : 'tree_b',
      rng.range(-22, -16),
      rng.range(-18, 18),
      rng.range(1.4, 2.2),
      rng.range(0, Math.PI * 2),
      0x7d90a8,
      true,
    );
  }

  // Graveyard behind the horde spawn.
  place('crypt', 31, 2.5, 2.2, -Math.PI / 2 - 0.2, 0xaab0c0);
  const graves: ModelKey[] = ['gravestone', 'grave_a', 'grave_b'];
  for (let i = 0; i < 9; i++) {
    place(
      graves[rng.int(3)],
      rng.range(28.5, 33.5),
      rng.range(-13, 13),
      rng.range(1.1, 1.7),
      -Math.PI / 2 + rng.range(-0.4, 0.4),
      0xaab0c0,
    );
  }
  for (let i = 0; i < 4; i++) {
    place('fence_broken', rng.range(27.5, 31), rng.range(-14, 14), 1.6, rng.range(0, Math.PI), 0x9aa0b0);
  }
  // Bones on the ash field.
  for (let i = 0; i < 7; i++) {
    place(
      rng.next() < 0.6 ? 'bone' : 'skull',
      rng.range(2, 24),
      rng.range(-8, 8),
      rng.range(1.2, 2.0),
      rng.range(0, Math.PI * 2),
    );
  }

  // Lantern posts by the village — warm counterpoint to the moonlight.
  const lanternSpots = [
    { x: -4.5, z: -6.5 },
    { x: -4.5, z: 6.5 },
  ];
  for (const s of lanternSpots) {
    place('post_lantern', s.x, s.z, 1.8, Math.PI / 2);
    const light = new THREE.PointLight(0xe08a3c, 14, 14, 1.6);
    light.position.set(s.x, 2.6, s.z);
    group.add(light);
  }

  // ── Hex grid overlay (build phase) ──
  const pts: number[] = [];
  for (let i = 0; i < CELLS.length; i++) {
    const c = cellToWorld(i);
    for (let k = 0; k < 6; k++) {
      const a = HEX_CORNERS[k];
      const b = HEX_CORNERS[(k + 1) % 6];
      pts.push(
        c.x + a.x * HEX_SIZE * 0.98, 0.13, c.z + a.z * HEX_SIZE * 0.98,
        c.x + b.x * HEX_SIZE * 0.98, 0.13, c.z + b.z * HEX_SIZE * 0.98,
      );
    }
  }
  const hexGeo = new THREE.BufferGeometry();
  hexGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const hexGrid = new THREE.LineSegments(
    hexGeo,
    new THREE.LineBasicMaterial({ color: 0xc8b795, transparent: true, opacity: 0.28 }),
  );
  group.add(hexGrid);

  scene.add(group);
  return {
    group,
    setHexGridVisible(v: boolean) {
      hexGrid.visible = v;
    },
    emberSpots: lanternSpots,
    update(dt: number) {
      timeUniform.value += dt;
    },
  };
}
