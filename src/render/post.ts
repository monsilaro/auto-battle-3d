import * as THREE from 'three';
import {
  BloomEffect,
  BrightnessContrastEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  SMAAEffect,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

// Post stack: Render → N8AO (half-res) → Bloom → grade/vignette/SMAA.
// Grading is done with hue/saturation + contrast effects instead of a LUT
// file — same grim result, no asset to author.

export interface Post {
  render(dt: number): void;
  setSize(w: number, h: number): void;
  toggle(): boolean;
  enabled: boolean;
}

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): Post {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
  });
  composer.addPass(new RenderPass(scene, camera));

  const n8ao = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
  n8ao.configuration.aoRadius = 2.2;
  n8ao.configuration.intensity = 3.2;
  n8ao.configuration.halfRes = true;
  n8ao.configuration.color = new THREE.Color(0x06070c);
  composer.addPass(n8ao);

  const bloom = new BloomEffect({
    luminanceThreshold: 0.68,
    luminanceSmoothing: 0.2,
    intensity: 0.9,
    mipmapBlur: true,
  });
  const grade = new HueSaturationEffect({ saturation: -0.1 });
  const contrast = new BrightnessContrastEffect({ brightness: 0.015, contrast: 0.1 });
  const vignette = new VignetteEffect({ darkness: 0.46, offset: 0.26 });
  const smaa = new SMAAEffect();
  composer.addPass(new EffectPass(camera, bloom, grade, contrast, vignette, smaa));

  const post: Post = {
    enabled: true,
    render(dt: number) {
      if (post.enabled) composer.render(dt);
      else renderer.render(scene, camera);
    },
    setSize(w: number, h: number) {
      composer.setSize(w, h);
      n8ao.setSize(w, h);
    },
    toggle() {
      post.enabled = !post.enabled;
      return post.enabled;
    },
  };
  return post;
}
