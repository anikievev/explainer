import * as THREE from 'three';
import { clamp } from './Timeline.ts';

/**
 * A curved network path between two points, drawn as a thin tube that can be
 * revealed progressively (`setReveal`) and faded (`setOpacity`).
 */
export class ArcPath {
  readonly curve: THREE.CubicBezierCurve3;
  readonly mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  private readonly indexCount: number;

  constructor(
    from: THREE.Vector3,
    to: THREE.Vector3,
    opts: { height?: number; radius?: number; color?: THREE.ColorRepresentation; segments?: number } = {},
  ) {
    const distance = from.distanceTo(to);
    const height = opts.height ?? Math.max(0.3, distance * 0.28);
    const c1 = from.clone().lerp(to, 0.25);
    const c2 = from.clone().lerp(to, 0.75);
    c1.y += height;
    c2.y += height;
    this.curve = new THREE.CubicBezierCurve3(from.clone(), c1, c2, to.clone());
    const geometry = new THREE.TubeGeometry(this.curve, opts.segments ?? 96, opts.radius ?? 0.025, 8, false);
    this.indexCount = geometry.index!.count;
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: opts.color ?? 0x38bdf8, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    this.mesh.renderOrder = 2;
  }

  /** Show only the portion of the path between `start` and `end` (0..1). */
  setReveal(end: number, start = 0) {
    const perSegment = this.indexCount / (this.mesh.geometry.parameters.tubularSegments);
    const s = Math.floor(clamp(start) * this.mesh.geometry.parameters.tubularSegments) * perSegment;
    const e = Math.floor(clamp(end) * this.mesh.geometry.parameters.tubularSegments) * perSegment;
    this.mesh.geometry.setDrawRange(s, Math.max(0, e - s));
    this.mesh.visible = e > s;
  }

  setOpacity(opacity: number) {
    this.mesh.material.opacity = opacity;
    if (opacity <= 0.001) this.mesh.visible = false;
  }

  setColor(color: THREE.ColorRepresentation) {
    this.mesh.material.color.set(color);
  }

  /** Reveal fully at a given opacity, or hide when opacity is 0. */
  show(opacity: number) {
    this.setReveal(1);
    this.setOpacity(opacity);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
