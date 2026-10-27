import * as THREE from 'three';
import { DESIGN_HEIGHT } from '../config/video-settings.ts';
import { Mascot, type MascotPose } from './Mascot.ts';
import { easeOutBack, clamp } from './Timeline.ts';

const DESIGN_WIDTH = (DESIGN_HEIGHT * 16) / 9;
const CAMERA_Z = 10;
const FOV = 30;
/** World units per design pixel on the z = 0 plane. */
const UNITS_PER_PX = (2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / DESIGN_HEIGHT;
const MASCOT_HEIGHT = 1.85;

/**
 * Screen-space "presenter" layer: the mascot rendered on top of the frame at
 * a position given in 1920×1080 design pixels, with its own lights.
 */
export class MascotLayer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, DESIGN_WIDTH / DESIGN_HEIGHT, 0.1, 50);
  readonly mascot = new Mascot();

  constructor() {
    this.camera.position.set(0, 0, CAMERA_Z);
    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0b1026, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 4, 6);
    const rim = new THREE.DirectionalLight(0x22d3ee, 1.2);
    rim.position.set(4, 2, -3);
    this.scene.add(key, rim, this.mascot.group);
    this.mascot.shadowVisible = false;
  }

  /**
   * Place the mascot with its feet at (x, y) design pixels, `heightPx` tall.
   * `appear` 0..1 pops it in/out. Returns false when hidden.
   */
  update(t: number, opts: { x: number; y: number; heightPx: number; appear: number; pose: MascotPose; yaw?: number }) {
    const k = clamp(opts.appear);
    this.mascot.group.visible = k > 0.001;
    if (!this.mascot.group.visible) return false;
    const scale = ((opts.heightPx * UNITS_PER_PX) / MASCOT_HEIGHT) * Math.max(0.001, easeOutBack(k));
    this.mascot.group.scale.setScalar(scale);
    this.mascot.group.position.set((opts.x - DESIGN_WIDTH / 2) * UNITS_PER_PX, (DESIGN_HEIGHT / 2 - opts.y) * UNITS_PER_PX, 0);
    this.mascot.group.rotation.y = opts.yaw ?? -0.25;
    this.mascot.apply(opts.pose, t);
    return true;
  }

  render(renderer: THREE.WebGLRenderer) {
    if (!this.mascot.group.visible) return;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.mascot.dispose();
  }
}
