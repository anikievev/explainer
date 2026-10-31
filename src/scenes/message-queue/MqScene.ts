import * as THREE from 'three';
import { CameraRig, type CameraShot } from '../../components/CameraRig.ts';
import type { Hud } from '../../components/Hud.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { drawEndCard, drawRecapPanel } from '../../components/Overlays.ts';
import { clamp, fadeWindow } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { B } from './beats.ts';
import { MqStage } from './MqStage.ts';
import { updatePresenter } from './presenter.ts';
import { DURATION, SECTIONS, cueAt } from './script.ts';

type V3 = THREE.Vector3Tuple;

/** Camera looking at `target` from `distance`, raised `elevation` degrees above the floor (from +z). */
function view(target: V3, distance: number, elevation: number): [V3, V3] {
  const e = THREE.MathUtils.degToRad(elevation);
  return [[target[0], target[1] + distance * Math.sin(e), target[2] + distance * Math.cos(e)], target];
}

const HOOK = view([-6.6, 0.4, 0], 11, 42);
const CHAIN = view([-3.4, 0.4, 0.2], 16, 50);
const MESSAGE = view([-3.4, 0.6, 0], 9.5, 36);
const STAGE = view([-0.2, 0.3, -0.3], 17.5, 50);
const CRASH = view([1.3, 0.5, 0], 10, 40);
const PAYMENT = view([3.4, 0.4, 0.2], 13.5, 46);
const POISON = view([0.9, 0.4, 2.2], 12.5, 52);
const LOG = view([1.7, 0.3, -7.8], 13, 55);
const TRAPS = view([-0.6, 0.3, 1.4], 17.5, 52);
// Recap: system on the right, checklist panel on the left.
const RECAP = view([-4.4, 0.3, 0.8], 25, 50);

const shot = (at: number, [position, target]: [V3, V3], moveDuration = 2.6, cut = false): CameraShot & { moveDuration: number } => ({
  at,
  position,
  target,
  moveDuration,
  cut,
});

const SHOTS = [
  shot(0, HOOK),
  shot(B.click + 1.2, CHAIN, 2.4),
  shot(B.message + 1.0, MESSAGE, 2.2),
  shot(B.consumers + 1.0, STAGE, 2.4),
  shot(B.s3 + 0.6, CRASH, 2.4),
  shot(B.twice + 0.8, PAYMENT, 2.2),
  shot(B.poison + 0.8, POISON, 2.2),
  shot(B.teams + 0.6, LOG, 2.8),
  shot(B.s5 + 0.6, TRAPS, 2.8),
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
  LT(B.inARow + 0.4, B.delays - 0.2, 'Synchronous: the user waits for every step'),
  LT(B.message + 0.4, B.drops - 0.2, 'Message: a small note that something happened', { accent: CSS.storage }),
  LT(B.producer + 0.3, B.consumers - 0.2, 'Producer: sends messages', { accent: CSS.network }),
  LT(B.consumers + 1.0, B.holds - 0.2, 'Consumers (workers): take messages and do the work', { accent: CSS.network }),
  LT(B.longer + 0.4, B.drains - 0.2, 'A spike makes the line longer, not the servers slower', { sub: 'load leveling', accent: CSS.storage }),
  LT(B.moreWorkers + 0.4, B.emailDown - 0.2, 'More workers = faster drain', { sub: 'each message still goes to one worker', accent: CSS.healthy }),
  LT(B.vendors + 0.3, B.s3 - 0.4, 'Amazon SQS · RabbitMQ', { sub: 'two popular message queues', accent: CSS.storage }),
  LT(B.timeout + 0.3, B.deletes - 0.2, 'Visibility timeout', { sub: 'Amazon SQS default: 30 s (max 12 h)', accent: CSS.warning }),
  LT(B.rabbit + 0.3, B.atLeastOnce - 0.2, 'RabbitMQ: not acknowledged → back in the queue', { accent: CSS.storage }),
  LT(B.idempotent + 0.3, B.example - 0.2, 'Idempotent = safe to run twice', { accent: CSS.healthy }),
  LT(B.dlq + 0.4, B.s4 - 0.4, 'Dead-letter queue', { sub: 'Amazon SQS: after maxReceiveCount receives', accent: CSS.failure }),
  LT(B.oneWorker + 0.4, B.teams - 0.2, 'Queue: one message → one worker → deleted', { accent: CSS.storage }),
  LT(B.keeps + 0.3, B.retention - 0.2, 'Log: events stay; each reader keeps its own offset', { accent: CSS.storage }),
  LT(B.retention + 0.3, B.partitions - 0.2, 'Kafka default retention: 7 days', { sub: 'set per topic', accent: CSS.storage }),
  LT(B.partitions + 0.6, B.standard - 0.2, 'Order is kept within a partition', { sub: 'same key → same partition', accent: CSS.storage }),
  LT(B.backlog + 0.3, B.dlqTrap - 0.4, 'Watch queue depth and the age of the oldest message', { accent: CSS.warning }),
  LT(B.silence + 0.4, B.notDone - 0.4, 'Amazon SQS default retention: 4 days', { sub: 'maximum 14 days · alarm on the dead-letter queue', accent: CSS.failure }),
  LT(B.confirmation + 0.3, B.s5End, 'Received ≠ done', { sub: 'show the status, handle late failures', accent: CSS.warning }),
];

/** "How Message Queues Work": one stage (MqStage), cameras, lower thirds, recap and end card. */
export class MqScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = DURATION;
  readonly presenter = new MascotLayer();
  private readonly rig: CameraRig;
  private readonly stage = new MqStage();

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

    hud.titleCard('How Message Queues Work', "Why your order is confirmed before anything happens", fadeWindow(t, 0.15, B.click - 0.2, 0.5));

    for (const s of SECTIONS) {
      if (!s.index || s.index === '✓') continue;
      hud.chip(s.index, s.title, fadeWindow(t, s.start + 0.6, s.end - 0.3, 0.5));
    }
    for (const lt of LOWER_THIRDS) {
      hud.lowerThird(lt.text, { alpha: fadeWindow(t, lt.start, lt.end, 0.4), sub: lt.sub, mono: lt.mono, accent: lt.accent });
    }

    drawRecapPanel(hud, t, B.recap + 1, B.next - 0.2, [
      { at: B.recap1 + 0.4, title: 'Answer now, work later', sub: 'producer → queue → workers at their own pace' },
      { at: B.recap2 + 0.4, title: 'Retries need idempotent jobs', sub: 'at least once · dead-letter queue · logs for many readers' },
      { at: B.recap3 + 0.4, title: 'Watch the traps', sub: 'backlog · unwatched DLQ · received ≠ done' },
    ]);
    // Dim the 3D scene behind the end card.
    hud.fade(0.72 * fadeWindow(t, B.next - 0.6, DURATION + 1, 0.8));
    drawEndCard(hud, t, { at: B.next - 0.2, questionAt: B.ask, next: 'Caching', question: 'What does your app put in a queue?' });

    if (this.showCaptions) hud.caption(cueAt(t)?.text ?? '');
    hud.fade(Math.max(clamp(1 - t / 0.4), clamp((t - (DURATION - 1)) / 0.9)));
  }

  dispose() {
    this.stage.dispose();
    this.presenter.dispose();
  }
}
