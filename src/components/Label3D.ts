import * as THREE from 'three';
import type { Hud } from './Hud.ts';

export interface Label3DOptions {
  sub?: string;
  accent?: string;
  /** World-space offset from the anchor's origin. */
  offset?: THREE.Vector3Tuple;
  offsetY?: number;
  size?: number;
  mono?: boolean;
  below?: boolean;
}

const tmp = new THREE.Vector3();

/**
 * A label attached to a 3D object. It is drawn by the HUD in screen space so
 * it stays crisp and readable regardless of camera distance.
 */
export class Label3D {
  constructor(
    readonly anchor: THREE.Object3D,
    public text: string,
    public options: Label3DOptions = {},
  ) {}

  draw(hud: Hud, alpha: number, overrides: Partial<Label3DOptions> & { text?: string } = {}) {
    if (alpha <= 0.001) return;
    const opts = { ...this.options, ...overrides };
    this.anchor.updateWorldMatrix(true, false);
    tmp.fromArray(opts.offset ?? [0, 0, 0]).applyMatrix4(this.anchor.matrixWorld);
    hud.label(tmp, overrides.text ?? this.text, { ...opts, alpha });
  }
}
