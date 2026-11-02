import * as THREE from 'three';
import { COLORS } from '../config/theme.ts';
import { clamp } from './Timeline.ts';

export interface SlotState {
  /** 0 = empty, 1 = full size (fractional while appearing or leaving). */
  fill: number;
  color?: THREE.ColorRepresentation;
  /** Brightness 0..1: dims for keys nobody has read in a while (LRU). */
  glow?: number;
  /** Dashed "ghost" look (a key that isn't really there). */
  ghost?: boolean;
}

/**
 * The cache's memory, drawn as a row of key slots along +x on a dark tray.
 * Each slot holds one key; the HUD draws key names, TTL rings and badges at
 * `slotPosition(i)`.
 */
export class KeySlots {
  readonly group = new THREE.Group();
  private readonly trayGeo: THREE.BoxGeometry;
  private readonly tray: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private readonly slotGeo: THREE.BoxGeometry;
  private readonly slots: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>> = [];

  constructor(
    readonly capacity: number,
    readonly spacing = 0.6,
  ) {
    this.slotGeo = new THREE.BoxGeometry(spacing * 0.7, 0.24, 0.36);
    this.trayGeo = new THREE.BoxGeometry(capacity * spacing + 0.16, 0.05, 0.5);
    this.tray = new THREE.Mesh(this.trayGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: COLORS.storage, emissiveIntensity: 0.2, transparent: true }));
    this.tray.position.set(((capacity - 1) * spacing) / 2, 0, 0);
    this.group.add(this.tray);
    for (let i = 0; i < capacity; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: COLORS.storage, emissive: COLORS.storage, emissiveIntensity: 1, transparent: true });
      const slot = new THREE.Mesh(this.slotGeo, mat);
      slot.position.set(i * spacing, 0.15, 0);
      this.group.add(slot);
      this.slots.push(slot);
    }
  }

  /** World position just above slot i (for labels and rings). */
  slotPosition(i: number) {
    return new THREE.Vector3(i * this.spacing, 0.3, 0).applyMatrix4(this.group.matrixWorld);
  }

  update(alpha: number, state: (i: number) => SlotState) {
    this.group.visible = alpha > 0.01;
    this.tray.material.opacity = alpha;
    this.slots.forEach((slot, i) => {
      const s = state(i);
      const k = clamp(s.fill);
      slot.visible = k > 0.01 && alpha > 0.01;
      slot.scale.set(Math.max(0.001, k), Math.max(0.001, k), Math.max(0.001, k));
      const glow = s.glow ?? 1;
      slot.material.color.set(s.color ?? COLORS.storage);
      slot.material.emissive.set(s.color ?? COLORS.storage);
      slot.material.emissiveIntensity = 0.15 + 1.1 * glow;
      slot.material.opacity = alpha * (s.ghost ? 0.3 : 0.35 + 0.65 * glow);
      slot.material.wireframe = s.ghost ?? false;
    });
  }

  dispose() {
    this.trayGeo.dispose();
    this.slotGeo.dispose();
    this.tray.material.dispose();
    for (const s of this.slots) s.material.dispose();
  }
}
