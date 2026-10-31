import * as THREE from 'three';
import { COLORS } from '../config/theme.ts';
import { clamp } from './Timeline.ts';

/**
 * A line of waiting requests in front of a server: small glowing blocks laid
 * out along `direction`, the newest one furthest away. `setLength` accepts a
 * fractional count so the last block can fade in smoothly.
 */
export class RequestQueue {
  readonly group = new THREE.Group();
  private readonly blocks: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>> = [];
  private readonly geometry = new THREE.BoxGeometry(0.16, 0.16, 0.16);

  constructor(
    readonly capacity: number,
    direction: THREE.Vector3 = new THREE.Vector3(-1, 0, 0),
    spacing = 0.24,
  ) {
    const step = direction.clone().normalize().multiplyScalar(spacing);
    for (let i = 0; i < capacity; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.network,
        emissive: COLORS.network,
        emissiveIntensity: 1.6,
        transparent: true,
      });
      const block = new THREE.Mesh(this.geometry, mat);
      block.position.copy(step).multiplyScalar(i);
      this.group.add(block);
      this.blocks.push(block);
    }
  }

  /** Show `length` blocks (fractional for the one arriving); colour shifts as the queue fills. */
  setLength(length: number, color: THREE.ColorRepresentation = COLORS.network) {
    const c = new THREE.Color(color);
    this.blocks.forEach((block, i) => {
      const k = clamp(length - i);
      block.visible = k > 0.01;
      block.scale.setScalar(Math.max(0.001, k));
      block.material.opacity = k;
      block.material.color.copy(c);
      block.material.emissive.copy(c);
    });
  }

  dispose() {
    this.geometry.dispose();
    for (const b of this.blocks) b.material.dispose();
  }
}
