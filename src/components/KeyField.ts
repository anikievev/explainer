import * as THREE from 'three';

/**
 * Many small keys (rows) drawn as one instanced mesh. The caller places every
 * key each frame with `place()` and then calls `commit()`, so the field is a
 * pure function of time like everything else.
 */
export class KeyField {
  readonly mesh: THREE.InstancedMesh;
  private readonly geometry: THREE.BoxGeometry;
  private readonly material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scaleV = new THREE.Vector3();
  private readonly color = new THREE.Color();

  /** `lit`: shaded blocks (big keys read as stacked slabs); unlit: flat colour (tiny keys). */
  constructor(readonly count: number, size = 0.11, lit = false) {
    this.geometry = new THREE.BoxGeometry(size, size * 0.55, size);
    this.material = lit ? new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05, transparent: true }) : new THREE.MeshBasicMaterial({ transparent: true });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) this.place(i, new THREE.Vector3(), 0x000000, 0);
    this.commit();
  }

  /** Position, colour and scale (0 hides it) of key i. */
  place(i: number, position: THREE.Vector3, color: THREE.ColorRepresentation, scale = 1) {
    this.scaleV.setScalar(Math.max(scale, 1e-4));
    this.matrix.compose(position, this.quaternion, this.scaleV);
    this.mesh.setMatrixAt(i, this.matrix);
    this.mesh.setColorAt(i, this.color.set(color));
  }

  setOpacity(opacity: number) {
    this.material.opacity = opacity;
    this.mesh.visible = opacity > 0.01;
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}

/**
 * Slot j of a key stack hovering over a database: rings of `perRing` keys,
 * stacked upwards. Returns a world position.
 */
export function stackSlot(center: THREE.Vector3, j: number, opts: { perRing?: number; radius?: number; baseY?: number; layer?: number } = {}) {
  const perRing = opts.perRing ?? 50;
  const ring = Math.floor(j / perRing);
  const a = ((j % perRing) / perRing) * Math.PI * 2 + ring * 0.31;
  const r = opts.radius ?? 0.8;
  return new THREE.Vector3(center.x + Math.cos(a) * r, (opts.baseY ?? 2.0) + ring * (opts.layer ?? 0.11), center.z + Math.sin(a) * r);
}
