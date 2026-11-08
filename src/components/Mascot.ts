import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FONTS } from '../config/theme.ts';
import { clamp, lerp } from './Timeline.ts';

/** Channel mascot: "Data Packet" (see mascota.png). Built procedurally, ~2 units tall. */
const MASCOT_COLORS = {
  body: 0x2f80ff,
  crimp: 0x4b93ff,
  limb: 0x1e3a8a,
  eyeWhite: 0xffffff,
  pupil: 0x0b1026,
  tongue: 0xef4444,
  labelText: '#1d4ed8',
  labelLines: '#93c5fd',
};

export type Expression = 'smile' | 'happy' | 'surprised' | 'worried' | 'sad' | 'scared' | 'thinking' | 'determined';

type MouthShape = 'smile' | 'happy' | 'surprised' | 'frown' | 'flat' | 'gasp';

/**
 * How each expression sets the face. `browTilt` > 0 lifts the inner ends
 * (worried, sad); < 0 pulls them down (determined). `browLift` raises both.
 * `eyeOpen` scales the eye height (lids); `look` shifts the pupils.
 */
const FACES: Record<Expression, { mouth: MouthShape; browTilt: number; browLift: number; eyeOpen: number; look: [number, number]; sweat?: boolean }> = {
  smile: { mouth: 'smile', browTilt: 0, browLift: 0, eyeOpen: 1, look: [0, 0] },
  happy: { mouth: 'happy', browTilt: 0, browLift: 0.02, eyeOpen: 1, look: [0, 0] },
  surprised: { mouth: 'surprised', browTilt: 0, browLift: 0.06, eyeOpen: 1.12, look: [0, 0] },
  worried: { mouth: 'frown', browTilt: 0.55, browLift: 0.03, eyeOpen: 1, look: [0, -0.01], sweat: true },
  sad: { mouth: 'frown', browTilt: 0.6, browLift: -0.01, eyeOpen: 0.62, look: [0, -0.025] },
  scared: { mouth: 'gasp', browTilt: 0.55, browLift: 0.07, eyeOpen: 1.18, look: [0, 0], sweat: true },
  thinking: { mouth: 'flat', browTilt: -0.12, browLift: 0.02, eyeOpen: 0.9, look: [0.03, 0.03] },
  determined: { mouth: 'flat', browTilt: -0.55, browLift: -0.03, eyeOpen: 0.85, look: [0, 0] },
};

export interface LimbPose {
  /** 0 = hanging down, 1 = straight up (arms) — outward swing in the body plane. */
  raise: number;
  /** Forward/back swing in radians (walking, pointing forward). */
  swing: number;
}

export interface MascotPose {
  expression: Expression;
  armL: LimbPose;
  armR: LimbPose;
  legL: number;
  legR: number;
  /** Forward lean (radians). */
  lean: number;
  /** Sideways tilt (radians). */
  tilt: number;
  /** Vertical bounce of the body, in body units. */
  bob: number;
  /** Extra pupil offset (x right, y up, body units), e.g. glancing at something. */
  look?: [number, number];
}

const BODY_BOTTOM = 0.4;
const BODY_H = 1.3;
const BODY_W = 1.0;
const BODY_D = 0.6;
const FRONT_Z = BODY_D / 2;

function labelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#eef4ff';
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 184, 28);
  ctx.fill();
  ctx.fillStyle = MASCOT_COLORS.labelText;
  ctx.font = `700 50px ${FONTS.sans}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('DATA', 36, 64);
  ctx.fillText('PACKET', 36, 126);
  ctx.strokeStyle = MASCOT_COLORS.labelLines;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(300, 50 + i * 30);
    ctx.lineTo(470, 50 + i * 30);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class Mascot {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly eyes: THREE.Group[] = [];
  private readonly closedEyes: THREE.Mesh[] = [];
  private readonly mouths: Record<MouthShape, THREE.Object3D>;
  private readonly pupils: THREE.Mesh[] = [];
  private readonly sweat = new THREE.Group();
  private readonly brows: THREE.Mesh[] = [];
  private readonly shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor() {
    const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
      this.track(new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, ...extra }));
    const bodyMat = mat(MASCOT_COLORS.body, { emissive: MASCOT_COLORS.body, emissiveIntensity: 0.12 });
    const limbMat = mat(MASCOT_COLORS.limb);
    const whiteMat = mat(MASCOT_COLORS.eyeWhite, { roughness: 0.25 });
    const pupilMat = mat(MASCOT_COLORS.pupil, { roughness: 0.2 });
    const shineMat = this.track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const tongueMat = mat(MASCOT_COLORS.tongue);
    const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, pos: THREE.Vector3Tuple) => {
      const o = new THREE.Mesh(this.track(geo), m);
      o.position.fromArray(pos);
      parent.add(o);
      return o;
    };

    this.group.add(this.body, this.legL, this.legR);

    // Carton body + crimped top seam.
    mesh(new RoundedBoxGeometry(BODY_W, BODY_H, BODY_D, 4, 0.12), bodyMat, this.body, [0, BODY_BOTTOM + BODY_H / 2, 0]);
    mesh(new RoundedBoxGeometry(BODY_W * 1.03, 0.16, BODY_D * 0.5, 2, 0.05), mat(MASCOT_COLORS.crimp), this.body, [
      0,
      BODY_BOTTOM + BODY_H + 0.04,
      0,
    ]);

    // Label.
    const label = mesh(
      new THREE.PlaneGeometry(0.8, 0.3),
      this.track(new THREE.MeshStandardMaterial({ map: this.track(labelTexture()), roughness: 0.6 })),
      this.body,
      [0, BODY_BOTTOM + 0.3, FRONT_Z + 0.004],
    );
    label.rotation.z = 0.02;

    // Eyes.
    const eyeY = BODY_BOTTOM + 0.86;
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.2, eyeY, FRONT_Z);
      mesh(new THREE.SphereGeometry(0.15, 24, 16), whiteMat, eye, [0, 0, 0]).scale.set(1, 1.18, 0.35);
      this.pupils.push(mesh(new THREE.SphereGeometry(0.09, 20, 14), pupilMat, eye, [0.03, -0.03, 0.04]));
      this.pupils[this.pupils.length - 1].scale.set(1, 1.18, 0.45);
      mesh(new THREE.SphereGeometry(0.028, 12, 8), shineMat, eye, [0.0, 0.02, 0.085]);
      this.body.add(eye);
      this.eyes.push(eye);

      // Closed "^" eye for the happy face.
      const closed = mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20, Math.PI * 0.8), limbMat, this.body, [side * 0.2, eyeY - 0.04, FRONT_Z + 0.01]);
      closed.rotation.z = Math.PI * 0.1;
      this.closedEyes.push(closed);

      const brow = mesh(new THREE.TorusGeometry(0.1, 0.024, 8, 16, Math.PI * 0.55), limbMat, this.body, [side * 0.2, eyeY + 0.12, FRONT_Z + 0.01]);
      brow.rotation.z = Math.PI * 0.225;
      this.brows.push(brow);
    }

    // Mouths.
    const mouthY = BODY_BOTTOM + 0.64;
    const smile = mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 20, Math.PI * 0.75), limbMat, this.body, [0, mouthY + 0.05, FRONT_Z + 0.01]);
    smile.rotation.z = Math.PI + Math.PI * 0.125;
    const happy = new THREE.Group();
    happy.position.set(0, mouthY + 0.04, FRONT_Z + 0.006);
    mesh(new THREE.CircleGeometry(0.13, 24, Math.PI, Math.PI), pupilMat, happy, [0, 0, 0]);
    mesh(new THREE.CircleGeometry(0.06, 20, Math.PI, Math.PI), tongueMat, happy, [0, -0.06, 0.003]).scale.set(1.2, 0.9, 1);
    this.body.add(happy);
    const surprised = new THREE.Group();
    surprised.position.set(0, mouthY, FRONT_Z + 0.006);
    mesh(new THREE.CircleGeometry(0.05, 20), pupilMat, surprised, [0, 0, 0]).scale.set(0.85, 1.15, 1);
    mesh(new THREE.CircleGeometry(0.025, 16), tongueMat, surprised, [0, -0.02, 0.003]);
    this.body.add(surprised);
    // Frown: the smile arc turned over. Flat: a short straight line.
    const frown = mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 20, Math.PI * 0.7), limbMat, this.body, [0, mouthY - 0.03, FRONT_Z + 0.01]);
    frown.rotation.z = Math.PI * 0.15;
    const flat = mesh(new THREE.CapsuleGeometry(0.02, 0.12, 4, 8), limbMat, this.body, [0, mouthY + 0.01, FRONT_Z + 0.01]);
    flat.rotation.z = Math.PI / 2;
    // Gasp: a wide-open oval with teeth-white rim, bigger than "surprised".
    const gasp = new THREE.Group();
    gasp.position.set(0, mouthY - 0.01, FRONT_Z + 0.006);
    mesh(new THREE.CircleGeometry(0.085, 24), pupilMat, gasp, [0, 0, 0]).scale.set(1.1, 0.85, 1);
    mesh(new THREE.CircleGeometry(0.04, 16), tongueMat, gasp, [0, -0.035, 0.003]).scale.set(1.3, 0.8, 1);
    this.body.add(gasp);
    this.mouths = { smile, happy, surprised, frown, flat, gasp };

    // Sweat drop on the side of the head (worried, scared).
    const sweatMat = mat(0x7dd3fc, { emissive: 0x38bdf8, emissiveIntensity: 0.5, roughness: 0.15 });
    mesh(new THREE.SphereGeometry(0.07, 16, 12), sweatMat, this.sweat, [0, 0, 0]);
    const tip = mesh(new THREE.ConeGeometry(0.06, 0.1, 16), sweatMat, this.sweat, [0, 0.07, 0]);
    tip.scale.set(1, 1, 1);
    this.sweat.position.set(BODY_W / 2 - 0.04, BODY_BOTTOM + 1.05, FRONT_Z);
    this.body.add(this.sweat);

    // Arms: pivot at the shoulder, hanging down.
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(side * (BODY_W / 2 + 0.02), BODY_BOTTOM + 0.72, 0);
      mesh(new THREE.CapsuleGeometry(0.065, 0.3, 6, 12), limbMat, arm, [0, -0.2, 0]);
      mesh(new THREE.SphereGeometry(0.1, 16, 12), limbMat, arm, [0, -0.42, 0]);
      this.body.add(arm);
    }

    // Legs: pivot at the hip.
    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(side * 0.22, BODY_BOTTOM + 0.04, 0);
      mesh(new THREE.CapsuleGeometry(0.075, 0.18, 6, 12), limbMat, leg, [0, -0.17, 0]);
      mesh(new THREE.SphereGeometry(0.1, 16, 12), limbMat, leg, [0, -0.36, 0.05]).scale.set(1.2, 0.6, 1.6);
    }

    // Soft contact shadow.
    this.shadow = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(0.6, 32)),
      this.track(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.005;
    this.shadow.scale.set(1, 0.6, 1);
    this.group.add(this.shadow);
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  /** Apply a pose. `t` drives the deterministic blink. */
  apply(pose: MascotPose, t: number) {
    const armRot = (arm: THREE.Group, limb: LimbPose, side: number) => {
      arm.rotation.set(-limb.swing, 0, side * limb.raise * Math.PI * 0.85);
    };
    armRot(this.armL, pose.armL, -1);
    armRot(this.armR, pose.armR, 1);
    this.legL.rotation.x = -pose.legL;
    this.legR.rotation.x = -pose.legR;

    this.body.position.y = pose.bob;
    this.body.rotation.set(pose.lean, 0, pose.tilt);
    this.shadow.scale.setScalar(1 - pose.bob * 0.6).multiply(new THREE.Vector3(1, 0.6, 1));

    const face = FACES[pose.expression];
    const happy = pose.expression === 'happy';
    const blinking = t % 3.7 < 0.13;
    for (const eye of this.eyes) {
      eye.visible = !happy;
      eye.scale.y = blinking ? 0.12 : face.eyeOpen;
    }
    const [lx, ly] = pose.look ?? [0, 0];
    for (const pupil of this.pupils) pupil.position.set(0.03 + face.look[0] + lx, -0.03 + face.look[1] + ly, 0.04);
    for (const c of this.closedEyes) c.visible = happy;
    this.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1;
      b.position.y = BODY_BOTTOM + 0.98 + face.browLift;
      // Rotating each arc about its own centre: the inner end rises when side * rotation < 0.
      b.rotation.z = Math.PI * 0.225 - side * face.browTilt;
    });
    for (const [key, mouth] of Object.entries(this.mouths)) mouth.visible = key === face.mouth;
    // The drop slides down the side of the head and starts again.
    this.sweat.visible = !!face.sweat;
    this.sweat.position.y = BODY_BOTTOM + 1.08 - ((t * 0.5) % 1) * 0.22;
  }

  set shadowVisible(v: boolean) {
    this.shadow.visible = v;
  }

  /** Fade the whole figure (1 = solid). Used for "hidden" / in-flight states. */
  setOpacity(opacity: number) {
    this.body.parent?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh === this.shadow) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        m.transparent = opacity < 1;
        m.opacity = opacity;
        m.depthWrite = opacity >= 1;
      }
    });
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}

// ---- Pose library -------------------------------------------------------

export function poseIdle(t: number, expression: Expression = 'smile'): MascotPose {
  const breathe = Math.sin(t * 2.2) * 0.015;
  return {
    expression,
    armL: { raise: 0.08 + breathe, swing: 0.05 },
    armR: { raise: 0.08 + breathe, swing: 0.05 },
    legL: 0,
    legR: 0,
    lean: 0,
    tilt: Math.sin(t * 1.1) * 0.025,
    bob: breathe,
  };
}

export function poseWave(t: number): MascotPose {
  const p = poseIdle(t, 'happy');
  p.armR = { raise: 0.82 + Math.sin(t * 9) * 0.12, swing: 0.1 };
  p.tilt = -0.06 + Math.sin(t * 4.5) * 0.03;
  return p;
}

export function poseCheer(t: number): MascotPose {
  const hop = Math.abs(Math.sin(t * 6)) * 0.12;
  return {
    expression: 'happy',
    armL: { raise: 0.85, swing: 0.2 },
    armR: { raise: 0.85, swing: 0.2 },
    legL: 0.1,
    legR: -0.1,
    lean: 0,
    tilt: Math.sin(t * 6) * 0.05,
    bob: hop,
  };
}

export function poseSurprised(t: number): MascotPose {
  const p = poseIdle(t, 'surprised');
  p.armL = { raise: 0.32, swing: 0.25 };
  p.armR = { raise: 0.32, swing: 0.25 };
  p.lean = -0.08;
  p.bob = 0.03;
  return p;
}

/** Right arm points sideways toward screen-right. */
export function posePoint(t: number): MascotPose {
  const p = poseIdle(t, 'smile');
  p.armR = { raise: 0.55, swing: 0.15 };
  p.tilt = -0.05;
  return p;
}

/** Hands up near the chest, shrinking back: something is going wrong. */
export function poseWorried(t: number): MascotPose {
  const p = poseIdle(t, 'worried');
  const fidget = Math.sin(t * 5) * 0.05;
  p.armL = { raise: 0.18, swing: 0.75 + fidget };
  p.armR = { raise: 0.18, swing: 0.75 - fidget };
  p.lean = -0.04;
  p.tilt = Math.sin(t * 1.6) * 0.04;
  return p;
}

/** Slumped, arms hanging, eyes half closed: something was lost. */
export function poseSad(t: number): MascotPose {
  const p = poseIdle(t, 'sad');
  p.armL = { raise: 0.02, swing: -0.05 };
  p.armR = { raise: 0.02, swing: -0.05 };
  p.lean = 0.14;
  p.tilt = 0.06;
  p.bob = -0.035 + Math.sin(t * 1.4) * 0.008;
  return p;
}

/** Hands on head, trembling: a disaster on screen. */
export function poseScared(t: number): MascotPose {
  const shake = Math.sin(t * 38) * 0.035;
  return {
    expression: 'scared',
    armL: { raise: 0.92, swing: 0.55 },
    armR: { raise: 0.92, swing: 0.55 },
    legL: 0.08,
    legR: -0.08,
    lean: -0.1,
    tilt: shake,
    bob: 0.02 + Math.abs(shake) * 0.4,
  };
}

/** Hand to chin, eyes up and to the side, head tilted: considering a trade-off. */
export function poseThinking(t: number): MascotPose {
  const p = poseIdle(t, 'thinking');
  p.armR = { raise: 0.12, swing: 1.05 };
  p.armL = { raise: 0.06, swing: 0.1 };
  p.tilt = -0.1 + Math.sin(t * 1.2) * 0.02;
  return p;
}

/** Palms out, shoulders up: "it depends" / no free lunch. */
export function poseShrug(t: number): MascotPose {
  const p = poseIdle(t, 'thinking');
  const lift = 0.04 + Math.abs(Math.sin(t * 2.5)) * 0.02;
  p.armL = { raise: 0.4, swing: -0.25 };
  p.armR = { raise: 0.4, swing: -0.25 };
  p.tilt = 0.08;
  p.bob = lift;
  p.look = [-0.03, 0];
  return p;
}

/** Fists up, leaning in: here's the fix. */
export function poseDetermined(t: number): MascotPose {
  const pump = Math.max(0, Math.sin(t * 4)) * 0.08;
  return {
    expression: 'determined',
    armL: { raise: 0.3, swing: 0.7 + pump },
    armR: { raise: 0.3, swing: 0.7 + pump },
    legL: 0.06,
    legR: -0.06,
    lean: 0.1,
    tilt: 0,
    bob: pump * 0.3,
  };
}

/** Nodding with a smile: agreeing with the narration. */
export function poseNod(t: number): MascotPose {
  const p = poseIdle(t, 'smile');
  p.lean = 0.06 + Math.max(0, Math.sin(t * 6)) * 0.1;
  return p;
}

export function poseRun(t: number, cadence = 7): MascotPose {
  const phase = t * cadence;
  const s = Math.sin(phase);
  return {
    expression: 'smile',
    armL: { raise: 0.12, swing: s * 0.9 },
    armR: { raise: 0.12, swing: -s * 0.9 },
    legL: -s * 0.8,
    legR: s * 0.8,
    lean: 0.18,
    tilt: 0,
    bob: Math.abs(Math.cos(phase)) * 0.09,
  };
}

/** Blend two poses (expression switches at k = 0.5). */
export function blendPose(a: MascotPose, b: MascotPose, k: number): MascotPose {
  const kk = clamp(k);
  const limb = (x: LimbPose, y: LimbPose) => ({ raise: lerp(x.raise, y.raise, kk), swing: lerp(x.swing, y.swing, kk) });
  return {
    expression: kk < 0.5 ? a.expression : b.expression,
    armL: limb(a.armL, b.armL),
    armR: limb(a.armR, b.armR),
    legL: lerp(a.legL, b.legL, kk),
    legR: lerp(a.legR, b.legR, kk),
    lean: lerp(a.lean, b.lean, kk),
    tilt: lerp(a.tilt, b.tilt, kk),
    bob: lerp(a.bob, b.bob, kk),
    look: [lerp(a.look?.[0] ?? 0, b.look?.[0] ?? 0, kk), lerp(a.look?.[1] ?? 0, b.look?.[1] ?? 0, kk)],
  };
}

