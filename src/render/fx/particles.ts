import * as THREE from 'three';

// CPU-updated point particles with a tiny custom shader (per-point size,
// color, and life-based fade — PointsMaterial can't do any of those).

const VERT = /* glsl */ `
attribute float aSize;
attribute float aLife;
attribute vec3 aColor;
varying float vLife;
varying vec3 vColor;
void main() {
  vLife = aLife;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (140.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying float vLife;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.12, d);
  gl_FragColor = vec4(vColor, soft * vLife);
}`;

export class ParticleSystem {
  readonly points: THREE.Points;
  readonly pos: Float32Array; // exposed for recycle loops (ash wrap-around)
  private vel: Float32Array;
  private life: Float32Array; // 0..1 remaining
  private decay: Float32Array; // life lost per second
  private sizes: Float32Array;
  private colors: Float32Array;
  private geo: THREE.BufferGeometry;
  private cursor = 0;

  constructor(
    readonly capacity: number,
    blending: THREE.Blending = THREE.NormalBlending,
  ) {
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.decay = new Float32Array(capacity);
    this.sizes = new Float32Array(capacity);
    this.colors = new Float32Array(capacity * 3);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(2, 5, 0), 200);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    color: THREE.Color,
    lifeSeconds: number,
  ): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = 1;
    this.decay[i] = 1 / Math.max(0.05, lifeSeconds);
    this.sizes[i] = size;
    this.colors[i * 3] = color.r;
    this.colors[i * 3 + 1] = color.g;
    this.colors[i * 3 + 2] = color.b;
  }

  update(dt: number, gravity = 0): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= this.decay[i] * dt;
      if (this.life[i] < 0) this.life[i] = 0;
      this.vel[i * 3 + 1] += gravity * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.getAttribute('aLife').needsUpdate = true;
    this.geo.getAttribute('aSize').needsUpdate = true;
    this.geo.getAttribute('aColor').needsUpdate = true;
  }
}

// ── Game FX built on the particle systems ───────────────────────────

const ASH_COLOR = new THREE.Color(0x6a7080);
const EMBER_COLORS = [new THREE.Color(0xffa040), new THREE.Color(0xff6a2a), new THREE.Color(0xffd080)];
const BLOOD_COLOR = new THREE.Color(0x902828);
const BONE_COLOR = new THREE.Color(0xb9b4a4);
const MAGIC_COLOR = new THREE.Color(0x8fd4ff);

export interface Fx {
  update(dt: number): void;
  hitBurst(x: number, y: number, z: number): void;
  deathBurst(x: number, y: number, z: number, enemy: boolean): void;
  blessingBurst(x: number, y: number, z: number): void;
}

export function createFx(scene: THREE.Scene, emberSpots: { x: number; z: number }[]): Fx {
  const ash = new ParticleSystem(320);
  const embers = new ParticleSystem(160, THREE.AdditiveBlending);
  const bursts = new ParticleSystem(700);
  scene.add(ash.points, embers.points, bursts.points);

  // Pre-fill drifting ash over the island.
  for (let i = 0; i < 320; i++) {
    ash.spawn(
      -30 + Math.random() * 66,
      Math.random() * 12,
      -22 + Math.random() * 44,
      0.25 + Math.random() * 0.3,
      -0.22 - Math.random() * 0.2,
      0.08 * (Math.random() - 0.5),
      0.10 + Math.random() * 0.08,
      ASH_COLOR,
      9999,
    );
  }

  let emberTimer = 0;

  return {
    update(dt) {
      // Ash: recycle by teleporting fallen flakes back up (infinite life).
      ash.update(dt);
      const p = ash.pos;
      for (let i = 0; i < 320; i++) {
        if (p[i * 3 + 1] < -0.5) {
          p[i * 3] = -30 + Math.random() * 66;
          p[i * 3 + 1] = 10 + Math.random() * 3;
          p[i * 3 + 2] = -22 + Math.random() * 44;
        }
      }

      emberTimer -= dt;
      if (emberTimer <= 0) {
        emberTimer = 0.08;
        for (const s of emberSpots) {
          if (Math.random() < 0.7) {
            embers.spawn(
              s.x + (Math.random() - 0.5) * 0.5,
              2.1 + Math.random() * 0.3,
              s.z + (Math.random() - 0.5) * 0.5,
              (Math.random() - 0.5) * 0.3,
              0.7 + Math.random() * 0.7,
              (Math.random() - 0.5) * 0.3,
              0.07 + Math.random() * 0.05,
              EMBER_COLORS[(Math.random() * 3) | 0],
              1.1 + Math.random() * 0.7,
            );
          }
        }
      }
      embers.update(dt);
      bursts.update(dt, -5.5);
    },

    hitBurst(x, y, z) {
      for (let i = 0; i < 5; i++) {
        bursts.spawn(
          x, y + 0.9, z,
          (Math.random() - 0.5) * 3.2,
          1.2 + Math.random() * 2.2,
          (Math.random() - 0.5) * 3.2,
          0.09 + Math.random() * 0.05,
          BLOOD_COLOR,
          0.4 + Math.random() * 0.25,
        );
      }
    },

    deathBurst(x, y, z, enemy) {
      const color = enemy ? BONE_COLOR : BLOOD_COLOR;
      for (let i = 0; i < 14; i++) {
        bursts.spawn(
          x, y + 0.7, z,
          (Math.random() - 0.5) * 4.4,
          1.6 + Math.random() * 3.2,
          (Math.random() - 0.5) * 4.4,
          0.12 + Math.random() * 0.08,
          color,
          0.55 + Math.random() * 0.4,
        );
      }
    },

    blessingBurst(x, y, z) {
      for (let i = 0; i < 26; i++) {
        bursts.spawn(
          x, y + 0.4, z,
          (Math.random() - 0.5) * 6,
          2.5 + Math.random() * 4,
          (Math.random() - 0.5) * 6,
          0.14 + Math.random() * 0.08,
          MAGIC_COLOR,
          0.7 + Math.random() * 0.5,
        );
      }
    },
  };
}
