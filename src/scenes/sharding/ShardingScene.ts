import * as THREE from 'three';
import { CameraRig, type CameraShot } from '../../components/CameraRig.ts';
import type { Hud } from '../../components/Hud.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { drawEndCard, drawRecapPanel } from '../../components/Overlays.ts';
import { clamp, fadeWindow } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { B } from './beats.ts';
import { updatePresenter } from './presenter.ts';
import { ShardingStage } from './ShardingStage.ts';
import { DURATION, SECTIONS, cueAt } from './script.ts';

type V3 = THREE.Vector3Tuple;

/** Camera looking at `target` from `distance`, raised `elevation` degrees above the floor (from +z). */
function view(target: V3, distance: number, elevation: number): [V3, V3] {
  const e = THREE.MathUtils.degToRad(elevation);
  return [[target[0], target[1] + distance * Math.sin(e), target[2] + distance * Math.cos(e)], target];
}

const HOOK = view([-1.8, 0.4, 0.0], 20, 46);
const SPLIT = view([1.2, 1.6, 0.0], 19, 40);
const WIDE = view([1.0, 0.6, 0.4], 21, 42);
const BARS = view([2.2, 0.4, 0.6], 18.5, 38);
const FIVE = view([4.6, 0.6, 0.4], 22, 40);
// Recap: system on the right, checklist panel on the left.
const RECAP = view([1.0, 0.3, 1.0], 33, 50);

const shot = (at: number, [position, target]: [V3, V3], moveDuration = 2.6, cut = false): CameraShot & { moveDuration: number } => ({
  at,
  position,
  target,
  moveDuration,
  cut,
});

const SHOTS = [
  shot(0, HOOK),
  shot(B.splits + 0.2, SPLIT, 2.4),
  shot(B.writesSplit + 0.2, WIDE, 2.4),
  shot(B.three + 0.2, BARS, 2.4),
  shot(B.fifth + 0.2, FIVE, 2.4),
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
  LT(B.onePrimary + 0.6, B.disks - 0.2, 'Every write → one primary', { accent: CSS.failure }),
  LT(B.disks + 0.4, B.fix - 0.2, 'Every replica is a full copy', { sub: 'more replicas = more copies, not more room', accent: CSS.failure }),
  LT(B.splits + 0.8, B.compare - 0.2, 'Sharding', { sub: 'one table split across several databases (shards)', accent: CSS.storage }),
  LT(B.writesSplit + 0.4, B.router - 0.2, 'Writes split too', { sub: 'each shard takes the writes for its own rows', accent: CSS.healthy }),
  LT(B.router + 0.6, B.names - 0.2, 'Shard key', { sub: 'the field the router uses to pick a shard', accent: CSS.network }),
  LT(B.names + 0.4, B.order - 0.2, 'mongos · VTGate', { sub: 'MongoDB · Vitess (for MySQL)', mono: true, accent: CSS.network }),
  LT(B.order + 0.6, B.s2 - 0.4, 'shard key = customer ID', { sub: 'order 1042 · customer 7 → shard 3 (example)', mono: true, accent: CSS.storage }),
  LT(B.dateDocs + 0.4, B.hash - 0.2, 'Always-increasing key = one hot shard', { sub: 'MongoDB docs: "the bottleneck for write operations"', accent: CSS.failure }),
  LT(B.hash + 0.6, B.balanced - 0.2, 'Hashed key', { sub: 'a hash scrambles the value: writes spread evenly', accent: CSS.healthy }),
  LT(B.balanced + 0.6, B.customer - 0.2, "Queries by customer ask every shard", { accent: CSS.warning }),
  LT(B.customer + 0.6, B.notion - 0.2, "One customer's orders stay together", { sub: 'customers spread across the shards', accent: CSS.healthy }),
  LT(B.notion + 0.4, B.goodKey - 0.2, 'Notion: shard key = workspace ID', { accent: CSS.storage }),
  LT(B.scatter + 0.4, B.txHarder - 0.2, 'Scatter-gather', { sub: 'MongoDB: can be long running · doesn\'t scale linearly', accent: CSS.warning }),
  LT(B.figma + 0.4, B.noTx - 0.2, '"Postgres can no longer be used to enforce transactionality"', { sub: 'Figma, on transactions across shards', accent: CSS.failure }),
  LT(B.noTx + 0.4, B.s4 - 0.4, 'Figma: no atomic cross-shard transactions', { sub: 'they work around the failures instead', accent: CSS.warning }),
  LT(B.hotDocs + 0.4, B.limit - 0.2, 'Many values ≠ an even spread', { sub: 'MongoDB docs: high cardinality alone doesn\'t guarantee it', accent: CSS.failure }),
  LT(B.limit + 0.4, B.suffix - 0.2, 'DynamoDB: max 1,000 write units/s per partition', { sub: 'and 3,000 read units/s', accent: CSS.warning }),
  LT(B.suffix + 0.6, B.suffixCost - 0.2, 'Split the hot key', { sub: 'add a suffix: seller 12#1 … 12#4', mono: false, accent: CSS.healthy }),
  LT(B.suffixCost + 0.4, B.s5 - 0.4, 'Cost: reads ask every piece, then merge', { accent: CSS.warning }),
  LT(B.balancer + 0.4, B.s5End + 0.8, 'MongoDB balancer', { sub: 'moves chunks between shards in the background', accent: CSS.storage }),
];

/** "How Database Sharding Works": one stage, cameras, lower thirds, recap and end card. */
export class ShardingScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = DURATION;
  readonly presenter = new MascotLayer();
  private readonly rig: CameraRig;
  private readonly stage = new ShardingStage();

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

    hud.titleCard('How Database Sharding Works', 'Shard keys, hot shards, and resharding', fadeWindow(t, B.fix + 0.2, B.s1 + 0.4, 0.5));

    for (const s of SECTIONS) {
      if (!s.index || s.index === '✓') continue;
      hud.chip(s.index, s.title, fadeWindow(t, s.start + 0.6, s.end - 0.3, 0.5));
    }
    for (const lt of LOWER_THIRDS) {
      hud.lowerThird(lt.text, { alpha: fadeWindow(t, lt.start, lt.end, 0.4), sub: lt.sub, mono: lt.mono, accent: lt.accent });
    }

    drawRecapPanel(hud, t, B.recap + 1, B.next - 0.2, [
      { at: B.recap1 + 0.4, title: 'Split the data', sub: 'each shard holds a slice and takes its own writes' },
      { at: B.recap2 + 0.4, title: 'The shard key decides everything', sub: 'growing key = hot shard · no key = ask every shard' },
      { at: B.recap3 + 0.4, title: 'Adding shards moves data', sub: 'many small logical shards keep it manageable' },
    ]);
    // Dim the 3D scene behind the end card.
    hud.fade(0.72 * fadeWindow(t, B.next - 0.6, DURATION + 1, 0.8));
    drawEndCard(hud, t, { at: B.next - 0.2, questionAt: B.ask, next: 'Consistent hashing', question: 'What would you pick as the shard key for your app?' });

    if (this.showCaptions) hud.caption(cueAt(t)?.text ?? '');
    hud.fade(Math.max(clamp(1 - t / 0.4), clamp((t - (DURATION - 1)) / 0.9)));
  }

  dispose() {
    this.stage.dispose();
    this.presenter.dispose();
  }
}
