import * as THREE from 'three';
import { easeInOut, progress } from './Timeline.ts';

export interface CameraShot {
  /** Time (s) at which the camera arrives at this shot. */
  at: number;
  position: THREE.Vector3Tuple;
  target: THREE.Vector3Tuple;
  /** Cut instantly to this shot instead of easing from the previous one. */
  cut?: boolean;
}

const tmpPos = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const a = new THREE.Vector3();
const b = new THREE.Vector3();

/**
 * Pre-planned camera path: eases between shots, holds on each shot until the
 * next transition starts. Each shot defines how long the move into it takes.
 */
export class CameraRig {
  readonly target = new THREE.Vector3();
  private readonly shots: Array<CameraShot & { moveDuration: number }>;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    shots: Array<CameraShot & { moveDuration?: number }>,
  ) {
    this.shots = shots.map((s) => ({ ...s, moveDuration: s.moveDuration ?? 2.5 }));
  }

  update(t: number) {
    const shots = this.shots;
    const moveStart = (s: (typeof shots)[number]) => (s.cut ? s.at : s.at - s.moveDuration);
    let i = 0;
    while (i + 1 < shots.length && moveStart(shots[i + 1]) <= t) i++;
    const current = shots[i];

    tmpPos.fromArray(current.position);
    tmpTarget.fromArray(current.target);

    // Moving into `current` from the previous shot.
    if (i > 0 && !current.cut && t < current.at) {
      const prev = shots[i - 1];
      const k = easeInOut(progress(t, current.at - current.moveDuration, current.at));
      tmpPos.copy(a.fromArray(prev.position).lerp(b.fromArray(current.position), k));
      tmpTarget.copy(a.fromArray(prev.target).lerp(b.fromArray(current.target), k));
    }

    this.camera.position.copy(tmpPos);
    this.target.copy(tmpTarget);
    this.camera.lookAt(this.target);
  }

  distanceToTarget() {
    return this.camera.position.distanceTo(this.target);
  }
}
