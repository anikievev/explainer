import * as THREE from 'three';
import { COLORS } from '../config/theme.ts';
import { clamp } from './Timeline.ts';

const TRAIL = 8;

/**
 * A glowing packet that travels along a curve with a short fading trail.
 * Position is set from a 0..1 progress value, so it is fully deterministic.
 */
export class DataPacket {
  readonly group = new THREE.Group();
  private readonly head: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly trail: Array<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly geometry = new THREE.SphereGeometry(1, 16, 12);

  constructor(color: THREE.ColorRepresentation = COLORS.network, private size = 0.07) {
    this.head = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ color }));
    this.group.add(this.head);
    for (let i = 0; i < TRAIL; i++) {
      const m = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
      this.trail.push(m);
      this.group.add(m);
    }
    this.group.visible = false;
  }

  setColor(color: THREE.ColorRepresentation) {
    this.head.material.color.set(color);
    for (const m of this.trail) m.material.color.set(color);
  }

  setSize(size: number) {
    this.size = size;
  }

  /**
   * Place the packet at `k` (0..1) along `curve`. Hidden outside (0, 1).
   * `trailLength` is the fraction of the curve covered by the trail.
   */
  update(curve: THREE.Curve<THREE.Vector3>, k: number, trailLength = 0.08, reverse = false) {
    if (k <= 0 || k >= 1) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const at = (p: number) => curve.getPointAt(clamp(reverse ? 1 - p : p));
    this.head.position.copy(at(k));
    this.head.scale.setScalar(this.size);
    for (let i = 0; i < TRAIL; i++) {
      const p = k - ((i + 1) / TRAIL) * trailLength;
      const m = this.trail[i];
      m.visible = p > 0;
      if (!m.visible) continue;
      m.position.copy(at(p));
      const fall = 1 - (i + 1) / (TRAIL + 1);
      m.scale.setScalar(this.size * (0.35 + 0.6 * fall));
      m.material.opacity = 0.75 * fall;
    }
  }

  hide() {
    this.group.visible = false;
  }

  dispose() {
    this.geometry.dispose();
    this.head.material.dispose();
    for (const m of this.trail) m.material.dispose();
  }
}
