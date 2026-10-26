import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Hud } from './components/Hud.ts';
import { getVideoSettings, type ResolutionName } from './config/video-settings.ts';
import { CdnScene } from './scenes/cdn/CdnScene.ts';

/**
 * Modes (query string):
 *   default            real-time preview, loops; `?t=95` starts at 95 s
 *   ?render=1          frame-exact rendering driven by src/scripts/record.ts
 *   ?res=4k            3840×2160 instead of 1920×1080
 *   ?captions=1        burn narration captions in (preview only)
 */
const params = new URLSearchParams(location.search);
const renderMode = params.has('render');
const settings = getVideoSettings((params.get('res') as ResolutionName) ?? '1080p', Number(params.get('fps') ?? 30));

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: renderMode });
renderer.setPixelRatio(1);
renderer.setSize(settings.width, settings.height, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);
if (!renderMode) document.body.classList.add('preview');

const cdn = new CdnScene(settings.width / settings.height, params.has('captions'));
const hud = new Hud(settings.width, settings.height, cdn.camera);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(settings.width, settings.height);
composer.addPass(new RenderPass(cdn.scene, cdn.camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(settings.width, settings.height), 0.55, 0.45, 0.72));
composer.addPass(new OutputPass());

function renderAt(t: number) {
  cdn.update(t);
  renderer.clear();
  composer.render();
  hud.begin();
  cdn.drawOverlay(hud, t);
  hud.end();
  renderer.render(hud.scene, hud.camera);
}

declare global {
  interface Window {
    __explainer?: {
      width: number;
      height: number;
      fps: number;
      duration: number;
      frameCount: number;
      renderFrame(frame: number): string;
    };
  }
}

await document.fonts.ready;

if (renderMode) {
  window.__explainer = {
    ...settings,
    duration: cdn.duration,
    frameCount: Math.round(cdn.duration * settings.fps),
    renderFrame(frame: number) {
      renderAt(frame / settings.fps);
      return renderer.domElement.toDataURL('image/png');
    },
  };
} else {
  const offset = Number(params.get('t') ?? 0);
  const startedAt = performance.now();
  const loop = () => {
    const t = (offset + (performance.now() - startedAt) / 1000) % cdn.duration;
    renderAt(t);
    requestAnimationFrame(loop);
  };
  loop();
}
