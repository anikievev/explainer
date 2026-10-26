import * as THREE from 'three';
import { DataPacket } from './DataPacket.ts';

export interface EmitOptions {
  color?: THREE.ColorRepresentation;
  size?: number;
  reverse?: boolean;
  trail?: number;
}

/**
 * Fixed pool of packets re-assigned every frame. Flows are described as pure
 * functions of time, so a frame never depends on the frames before it.
 */
export class PacketPool {
  readonly group = new THREE.Group();
  private readonly packets: DataPacket[] = [];
  private used = 0;

  constructor(count: number, private readonly defaultSize = 0.07) {
    for (let i = 0; i < count; i++) {
      const p = new DataPacket(undefined, defaultSize);
      this.packets.push(p);
      this.group.add(p.group);
    }
  }

  begin() {
    this.used = 0;
  }

  /** Place one packet at progress k (0..1) on the curve. */
  emit(curve: THREE.Curve<THREE.Vector3>, k: number, opts: EmitOptions = {}) {
    if (k <= 0 || k >= 1 || this.used >= this.packets.length) return;
    const p = this.packets[this.used++];
    p.setColor(opts.color ?? 0x38bdf8);
    p.setSize(opts.size ?? this.defaultSize);
    p.update(curve, k, opts.trail ?? 0.08, opts.reverse);
  }

  /** One packet travelling from start to start+duration. */
  travel(curve: THREE.Curve<THREE.Vector3>, t: number, start: number, duration: number, opts: EmitOptions = {}) {
    this.emit(curve, (t - start) / duration, opts);
  }

  /** Out along the curve then back, total `duration`. */
  roundTrip(
    curve: THREE.Curve<THREE.Vector3>,
    t: number,
    start: number,
    duration: number,
    out: EmitOptions = {},
    back: EmitOptions = {},
  ) {
    const half = duration / 2;
    this.travel(curve, t, start, half, out);
    this.travel(curve, t, start + half, half, { ...back, reverse: !(back.reverse ?? false) });
  }

  /** A packet launched every `period` seconds within [start, end). */
  stream(
    curve: THREE.Curve<THREE.Vector3>,
    t: number,
    start: number,
    end: number,
    period: number,
    duration: number,
    opts: EmitOptions = {},
  ) {
    const first = Math.max(0, Math.floor((t - start - duration) / period));
    const last = Math.floor((t - start) / period);
    for (let n = first; n <= last; n++) {
      const launch = start + n * period;
      if (launch >= end) break;
      this.travel(curve, t, launch, duration, opts);
    }
  }

  end() {
    for (let i = this.used; i < this.packets.length; i++) this.packets[i].hide();
  }

  dispose() {
    for (const p of this.packets) p.dispose();
  }
}
