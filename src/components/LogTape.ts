import * as THREE from 'three';
import { COLORS } from '../config/theme.ts';
import { clamp } from './Timeline.ts';

/**
 * An append-only log (Kafka-style): a row of numbered slots along +x. Events
 * fill the slots left to right and stay there after being read; readers are
 * positions (offsets) along the tape, drawn by the scene's HUD.
 */
export class LogTape {
  readonly group = new THREE.Group();
  private readonly frameGeo: THREE.BoxGeometry;
  private readonly slotGeo = new THREE.BoxGeometry(0.26, 0.2, 0.3);
  private readonly frame: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private readonly slots: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>> = [];

  constructor(
    readonly capacity: number,
    readonly spacing = 0.36,
  ) {
    this.frameGeo = new THREE.BoxGeometry(capacity * spacing + 0.2, 0.06, 0.46);
    this.frame = new THREE.Mesh(
      this.frameGeo,
      new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: COLORS.storage, emissiveIntensity: 0.25, transparent: true }),
    );
    this.frame.position.set(((capacity - 1) * spacing) / 2, 0, 0);
    this.group.add(this.frame);
    for (let i = 0; i < capacity; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: COLORS.network, emissive: COLORS.network, emissiveIntensity: 0.8, transparent: true });
      const slot = new THREE.Mesh(this.slotGeo, mat);
      slot.position.set(i * spacing, 0.14, 0);
      this.group.add(slot);
      this.slots.push(slot);
    }
  }

  /** Local position of slot i (for labels and read heads). */
  slotPosition(i: number) {
    return new THREE.Vector3(i * this.spacing, 0.3, 0).applyMatrix4(this.group.matrixWorld);
  }

  /**
   * Show `count` events (fractional for the one being appended), coloured by
   * `color(i)`. `alpha` fades the whole tape.
   */
  update(count: number, alpha: number, color: (i: number) => THREE.ColorRepresentation = () => COLORS.network) {
    this.group.visible = alpha > 0.01;
    this.frame.material.opacity = alpha;
    this.slots.forEach((slot, i) => {
      const k = clamp(count - i);
      slot.visible = k > 0.01 && alpha > 0.01;
      slot.scale.setScalar(Math.max(0.001, k));
      slot.material.opacity = alpha;
      slot.material.color.set(color(i));
      slot.material.emissive.set(color(i));
    });
  }

  dispose() {
    this.frameGeo.dispose();
    this.slotGeo.dispose();
    this.frame.material.dispose();
    for (const s of this.slots) s.material.dispose();
  }
}
