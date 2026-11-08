import * as THREE from 'three';
import { CameraRig, type CameraShot } from '../../components/CameraRig.ts';
import type { Hud } from '../../components/Hud.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { drawEndCard, drawRecapPanel } from '../../components/Overlays.ts';
import { clamp, fadeWindow } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { B } from './beats.ts';
import { updatePresenter } from './presenter.ts';
import { ReplicationStage } from './ReplicationStage.ts';
import { DURATION, SECTIONS, cueAt } from './script.ts';

type V3 = THREE.Vector3Tuple;

/** Camera looking at `target` from `distance`, raised `elevation` degrees above the floor (from +z). */
function view(target: V3, distance: number, elevation: number): [V3, V3] {
  const e = THREE.MathUtils.degToRad(elevation);
  return [[target[0], target[1] + distance * Math.sin(e), target[2] + distance * Math.cos(e)], target];
}

const HOOK = view([-5.0, 0.4, -0.6], 18, 46);
const ONE = view([-1.6, 0.4, 0.4], 16.5, 48);
const COPIES = view([2.6, 0.5, 0.2], 14.5, 48);
const READS = view([-0.4, 0.5, 0.2], 18.5, 46);
const LAG = view([3.2, 0.6, -1.4], 13, 52);
const SYNC = view([2.6, 0.6, -1.6], 14, 46);
const FAIL = view([0.4, 0.5, 0.4], 17, 46);
// Recap: system on the right, checklist panel on the left.
const RECAP = view([-4.6, 0.3, 1.0], 25, 50);

const shot = (at: number, [position, target]: [V3, V3], moveDuration = 2.6, cut = false): CameraShot & { moveDuration: number } => ({
  at,
  position,
  target,
  moveDuration,
  cut,
});

const SHOTS = [
  shot(0, HOOK),
  shot(B.lastEp + 0.2, ONE, 2.4),
  shot(B.copies + 0.2, COPIES, 2.6),
  shot(B.spread - 0.2, READS, 2.4),
  shot(B.s3 + 0.2, LAG, 2.4),
  shot(B.s4 + 0.2, SYNC, 2.4),
  shot(B.dies - 0.2, FAIL, 2.2),
  shot(B.recap + 1.5, RECAP, 3),
  shot(DURATION, [[RECAP[0][0], RECAP[0][1] + 1.5, RECAP[0][2] + 1.5], RECAP[1]], 25),
];

interface LowerThird {
  start: number;
  end: number;
  text: string;
  sub?: string;
  mono?: boolean;
  accent?: string;
}

const LT = (start: number, end: number, text: string, extra: Omit<LowerThird, 'start' | 'end' | 'text'> = {}): LowerThird => ({ start, end, text, ...extra });

const LOWER_THIRDS: LowerThird[] = [
  LT(B.oneMachine + 0.2, B.fix - 0.2, 'One database = one point of failure', { accent: CSS.failure }),
  LT(B.copies + 0.6, B.primary - 0.2, 'Replication', { sub: 'copies of the database on other servers', accent: CSS.storage }),
  LT(B.primary + 0.6, B.replicas - 0.2, 'Primary', { sub: 'takes all the writes', accent: CSS.warning }),
  LT(B.replicas + 0.6, B.leader - 0.2, 'Replicas', { sub: 'apply every change, in the same order', accent: CSS.storage }),
  LT(B.leader + 0.3, B.order - 0.2, 'primary = leader · replica = follower', { accent: CSS.muted }),
  LT(B.readOnly + 0.4, B.pgReadOnly - 0.2, 'Replicas are read-only', { sub: 'reads yes · writes no', accent: CSS.storage }),
  LT(B.pgReadOnly + 0.4, B.spread - 0.2, 'PostgreSQL: "strictly read-only"', { sub: 'INSERT and UPDATE fail on a replica', accent: CSS.failure }),
  LT(B.aws + 0.4, B.addReplica - 0.2, 'AWS RDS read replicas', { sub: 'route reads to a replica to reduce load on the primary', accent: CSS.healthy }),
  LT(B.async + 0.4, B.savedEarly - 0.2, 'Asynchronous by default', { sub: 'PostgreSQL · MySQL', accent: CSS.warning }),
  LT(B.behind + 0.6, B.watch - 0.2, 'Usually under a second', { sub: 'PostgreSQL docs: if the replica keeps up with the load', accent: CSS.warning }),
  LT(B.ryw + 0.6, B.ownReads - 0.2, 'Read-your-writes', { sub: 'after you save, you should see your save', accent: CSS.warning }),
  LT(B.ownReads + 0.4, B.s4 - 0.4, "Fix: read a user's own recent changes from the primary", { accent: CSS.healthy }),
  LT(B.crash + 0.6, B.moreLag - 0.2, 'Async + crash = lost writes', { sub: 'saved for the user, but never reached a replica', accent: CSS.failure }),
  LT(B.moreLag + 0.3, B.syncMode - 0.2, 'More lag, more loss', { sub: 'PostgreSQL: proportional to the replication delay', accent: CSS.failure }),
  LT(B.syncMode + 0.4, B.syncSafe - 0.2, 'Synchronous replication', { sub: 'each save waits for a replica to confirm', accent: CSS.healthy }),
  LT(B.syncSafe + 2.4, B.vendors - 0.2, 'Cost: at least one round trip per write', { accent: CSS.warning }),
  LT(B.vendors + 0.3, B.rds - 0.2, 'synchronous_standby_names', { sub: 'PostgreSQL · MySQL: semi-synchronous replication', mono: true, accent: CSS.storage }),
  LT(B.rds + 0.4, B.summary - 0.2, 'RDS Multi-AZ: a synchronous standby', { sub: "another availability zone · can't serve reads", accent: CSS.storage }),
  LT(B.summary + 0.3, B.s5 - 0.4, 'Async: fast, can lose writes · Sync: safer, slower', { accent: CSS.muted }),
  LT(B.notice + 0.4, B.tool - 0.2, 'Failover', { sub: 'promote a replica to be the new primary', accent: CSS.healthy }),
  LT(B.tool + 0.4, B.back - 0.2, "PostgreSQL doesn't detect the failure itself", { sub: 'an external tool watches and triggers the switch', accent: CSS.edge }),
  LT(B.lostWrites + 0.3, B.splitBrain - 0.2, 'Trap 1 · Lost writes', { sub: "async: what hadn't reached the replica is gone", accent: CSS.failure }),
  LT(B.splitBrain + 0.3, B.docsWarn - 0.2, 'Trap 2 · Split brain', { sub: 'two servers think they are the primary', accent: CSS.failure }),
  LT(B.docsWarn + 0.3, B.stonith - 0.2, '"confusion and ultimately data loss"', { sub: 'PostgreSQL docs', accent: CSS.failure }),
  LT(B.stonith + 0.3, B.shutOut - 0.2, 'STONITH', { sub: 'shoot the other node in the head', accent: CSS.warning }),
  LT(B.shutOut + 0.3, B.s5End + 0.8, 'Only ever one primary', { sub: 'fence the old one out', accent: CSS.healthy }),
];

/** "How Database Replication Works": one stage, cameras, lower thirds, recap and end card. */
export class ReplicationScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = DURATION;
  readonly presenter = new MascotLayer();
  private readonly rig: CameraRig;
  private readonly stage = new ReplicationStage();

  constructor(aspect: number, private readonly showCaptions = false) {
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
    this.rig = new CameraRig(this.camera, SHOTS);
    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.Fog(COLORS.fog, 34, 80);
    this.scene.add(new THREE.HemisphereLight(0x9cc3ff, 0x05080f, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(6, 12, 8);
    this.scene.add(key, this.stage.group);
  }

  update(t: number) {
    this.rig.update(t);
    this.stage.update(t);
    updatePresenter(this.presenter, t);
  }

  drawOverlay(hud: Hud, t: number) {
    this.stage.drawOverlay(hud, t);

    hud.titleCard('How Database Replication Works', 'Primaries, replicas, and lag', fadeWindow(t, B.fix + 0.2, B.s1 + 0.4, 0.5));

    for (const s of SECTIONS) {
      if (!s.index || s.index === '✓') continue;
      hud.chip(s.index, s.title, fadeWindow(t, s.start + 0.6, s.end - 0.3, 0.5));
    }
    for (const lt of LOWER_THIRDS) {
      hud.lowerThird(lt.text, { alpha: fadeWindow(t, lt.start, lt.end, 0.4), sub: lt.sub, mono: lt.mono, accent: lt.accent });
    }

    drawRecapPanel(hud, t, B.recap + 1, B.next - 0.2, [
      { at: B.recap1 + 0.4, title: 'One primary, many replicas', sub: 'writes go to the primary · replicas serve reads' },
      { at: B.recap2 + 0.4, title: 'Async lags; sync waits', sub: 'stale reads and lost writes vs. a round trip per write' },
      { at: B.recap3 + 0.4, title: 'Failover promotes a replica', sub: 'fence the old primary: no split brain' },
    ]);
    // Dim the 3D scene behind the end card.
    hud.fade(0.72 * fadeWindow(t, B.next - 0.6, DURATION + 1, 0.8));
    drawEndCard(hud, t, { at: B.next - 0.2, questionAt: B.ask, next: 'Sharding', question: 'Ever seen your own change disappear after saving?' });

    if (this.showCaptions) hud.caption(cueAt(t)?.text ?? '');
    hud.fade(Math.max(clamp(1 - t / 0.4), clamp((t - (DURATION - 1)) / 0.9)));
  }

  dispose() {
    this.stage.dispose();
    this.presenter.dispose();
  }
}
