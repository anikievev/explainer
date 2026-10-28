import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Mascot, poseIdle } from './components/Mascot.ts';
import { Hud } from './components/Hud.ts';
import { getVideoSettings, type ResolutionName } from './config/video-settings.ts';
import { CdnScene } from './scenes/cdn/CdnScene.ts';
import { CdnThumbnail } from './scenes/cdn/Thumbnail.ts';
import { ChannelBanner } from './scenes/channel/ChannelBanner.ts';
import { DEFAULT_EPISODE } from './scenes/episodes.ts';

/** What every renderable scene (video, thumbnail, banner) provides. */
interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly duration: number;
  readonly presenter: { render(renderer: THREE.WebGLRenderer): void };
  update(t: number): void;
  drawOverlay(hud: Hud, t: number): void;
}

/** Scene classes per episode id (ids match src/scenes/episodes.ts). */
const SCENES: Record<string, { video(aspect: number, captions: boolean): Stage; thumbnail(aspect: number): Stage }> = {
  cdn: {
    video: (aspect, captions) => new CdnScene(aspect, captions),
    thumbnail: (aspect) => new CdnThumbnail(aspect),
  },
};

/**
 * Modes (query string):
 *   default            real-time preview, loops; `?t=95` starts at 95 s
 *   ?render=1          frame-exact rendering driven by src/scripts/record.ts
 *   ?episode=cdn       which episode (default: the latest)
 *   ?res=4k            3840×2160 instead of 1920×1080
 *   ?captions=1        burn narration captions in (preview only)
 *   ?thumbnail=1       the static YouTube thumbnail instead of the video
 *   ?banner=1          the YouTube channel banner
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

const aspect = settings.width / settings.height;
const episodeScenes = SCENES[params.get('episode') ?? DEFAULT_EPISODE];
if (!episodeScenes) throw new Error(`Unknown episode "${params.get('episode')}"`);
const stage: Stage = params.has('banner')
  ? new ChannelBanner(aspect)
  : params.has('thumbnail')
    ? episodeScenes.thumbnail(aspect)
    : episodeScenes.video(aspect, params.has('captions'));
const hud = new Hud(settings.width, settings.height, stage.camera);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(settings.width, settings.height);
composer.addPass(new RenderPass(stage.scene, stage.camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(settings.width, settings.height), 0.55, 0.45, 0.72));
composer.addPass(new OutputPass());

function renderAt(t: number) {
  stage.update(t);
  renderer.clear();
  composer.render();
  hud.begin();
  stage.drawOverlay(hud, t);
  hud.end();
  renderer.render(hud.scene, hud.camera);
  stage.presenter.render(renderer);
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
      exportMascotGlb(): Promise<string>;
    };
  }
}

await document.fonts.ready;

if (renderMode) {
  window.__explainer = {
    ...settings,
    duration: stage.duration,
    frameCount: Math.round(stage.duration * settings.fps),
    renderFrame(frame: number) {
      renderAt(frame / settings.fps);
      return renderer.domElement.toDataURL('image/png');
    },
    async exportMascotGlb() {
      const mascot = new Mascot();
      mascot.apply(poseIdle(0), 1);
      const glb = (await new GLTFExporter().parseAsync(mascot.group, { binary: true })) as ArrayBuffer;
      mascot.dispose();
      let binary = '';
      const bytes = new Uint8Array(glb);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    },
  };
} else {
  const offset = Number(params.get('t') ?? 0);
  const startedAt = performance.now();
  const loop = () => {
    const t = (offset + (performance.now() - startedAt) / 1000) % stage.duration;
    renderAt(t);
    requestAnimationFrame(loop);
  };
  loop();
}
