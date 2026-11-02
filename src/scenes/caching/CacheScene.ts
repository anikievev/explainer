import * as THREE from 'three';
import { CameraRig, type CameraShot } from '../../components/CameraRig.ts';
import type { Hud } from '../../components/Hud.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { drawEndCard, drawRecapPanel } from '../../components/Overlays.ts';
import { clamp, fadeWindow } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { B } from './beats.ts';
import { CacheStage } from './CacheStage.ts';
import { updatePresenter } from './presenter.ts';
import { DURATION, SECTIONS, cueAt } from './script.ts';

type V3 = THREE.Vector3Tuple;

/** Camera looking at `target` from `distance`, raised `elevation` degrees above the floor (from +z). */
function view(target: V3, distance: number, elevation: number): [V3, V3] {
  const e = THREE.MathUtils.degToRad(elevation);
  return [[target[0], target[1] + distance * Math.sin(e), target[2] + distance * Math.cos(e)], target];
}

const HOOK = view([-4.6, 0.4, 0.2], 19, 44);
const PROBLEM = view([-2.4, 0.4, -0.4], 15.5, 48);
const CACHE = view([-1.6, 0.5, 0.7], 15, 50);
const SLOTS = view([0.6, 1.0, 1.6], 11, 28);
const CDN = view([-9.6, 0.4, 2.0], 14, 44);
const EVICT = view([0.3, 0.6, 2.5], 9.5, 30);
const TRAPS = view([-1.6, 0.4, 0.7], 16, 50);
// Recap: system on the right, checklist panel on the left.
const RECAP = view([-7.0, 0.3, 1.0], 25, 50);

const shot = (at: number, [position, target]: [V3, V3], moveDuration = 2.6, cut = false): CameraShot & { moveDuration: number } => ({
  at,
  position,
  target,
  moveDuration,
  cut,
});

const SHOTS = [
  shot(0, HOOK),
  shot(B.lbAgo + 0.4, PROBLEM, 2.4),
  shot(B.cacheIs + 0.4, CACHE, 2.4),
  shot(B.cdn + 0.2, CDN, 2.2),
  shot(B.s3 + 0.2, SLOTS, 2.4),
  shot(B.deleteKey - 0.2, CACHE, 2.2),
  shot(B.neverStale + 0.2, SLOTS, 2.0),
  shot(B.s4 + 0.4, EVICT, 2.4),
  shot(B.s5 + 0.4, TRAPS, 2.6),
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
  LT(B.fullWork + 0.3, B.thousands - 0.2, 'Same question, full work, every time', { accent: CSS.warning }),
  LT(B.cacheIs + 0.6, B.vendors - 0.2, 'Cache: a fast in-memory store next to the servers', { accent: CSS.storage }),
  LT(B.vendors + 0.3, B.aside - 0.2, 'Redis · Memcached', { sub: 'keys → values, in memory', accent: CSS.storage }),
  LT(B.aside + 0.3, B.checks + 2, 'Cache-aside (lazy loading)', { sub: 'check the cache first; on a miss, load and store', accent: CSS.storage }),
  LT(B.trips + 0.3, B.hit - 0.2, 'A miss costs three trips', { sub: 'cache → database → cache', accent: CSS.failure }),
  LT(B.micro + 0.4, B.ratio - 0.2, 'AWS ElastiCache: "microsecond latency"', { sub: "AWS's claim", accent: CSS.healthy }),
  LT(B.ratio + 0.4, B.cdn - 0.2, 'Hit ratio = hits ÷ all reads', { sub: 'the number to watch', accent: CSS.healthy }),
  LT(B.wrong + 0.3, B.ttl - 0.2, 'Stale data', { sub: 'the cache still has the old value', accent: CSS.warning }),
  LT(B.ttl + 0.4, B.expires - 0.2, 'TTL = time to live', { sub: 'each key expires after a set time', accent: CSS.warning }),
  LT(B.redisExpiry + 0.3, B.untilTimer - 0.2, 'Redis removes expired keys', { sub: 'when read · and by a periodic random check', accent: CSS.storage }),
  LT(B.deleteKey + 0.3, B.writeThrough - 0.2, 'Delete on write', { sub: 'the next read loads the new value', accent: CSS.healthy }),
  LT(B.writeThrough + 0.3, B.ttlEither - 0.2, 'Write-through', { sub: 'never stale · but fills up with data nobody reads', accent: CSS.storage }),
  LT(B.ttlEither + 0.4, B.s4 - 0.4, 'Keep a TTL as a backstop', { sub: "AWS: it still doesn't guarantee a value isn't stale", accent: CSS.warning }),
  LT(B.noEvict + 0.4, B.policy - 0.2, 'Redis default: maxmemory-policy noeviction', { sub: 'full → writes return an error', mono: true, accent: CSS.failure }),
  LT(B.policy + 0.3, B.lru - 0.2, 'maxmemory-policy allkeys-lru', { mono: true, accent: CSS.storage }),
  LT(B.lru + 0.4, B.sample - 0.2, 'LRU = least recently used', { accent: CSS.storage }),
  LT(B.sample + 0.3, B.s5 - 0.4, 'Redis approximates LRU', { sub: 'samples a few keys, evicts the one idle longest', accent: CSS.storage }),
  LT(B.herd + 0.3, B.hot + 1.5, 'Trap 1 · Thundering herd', { accent: CSS.failure }),
  LT(B.coalesce + 0.4, B.missing - 0.2, 'Request coalescing', { sub: 'one read per key; the rest wait for it', accent: CSS.healthy }),
  LT(B.missing + 0.3, B.p404 + 2, 'Trap 2 · Keys that don’t exist', { accent: CSS.failure }),
  LT(B.negative + 0.4, B.depend - 0.2, 'Negative cache', { sub: 'cache "not found" with its own TTL', accent: CSS.healthy }),
  LT(B.depend + 0.3, B.coldPlan - 0.2, 'Trap 3 · Cold cache', { sub: 'a restarted node starts empty', accent: CSS.failure }),
  LT(B.coldPlan + 0.4, B.coldPlan + 2.2, 'Plan for the cold start', { accent: CSS.warning }),
];

/** "How Caching Works": one stage (CacheStage), cameras, lower thirds, recap and end card. */
export class CacheScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = DURATION;
  readonly presenter = new MascotLayer();
  private readonly rig: CameraRig;
  private readonly stage = new CacheStage();

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

    hud.titleCard('How Caching Works', 'Hits, misses, and stale data', fadeWindow(t, B.fix + 0.2, B.s1 + 0.4, 0.5));

    for (const s of SECTIONS) {
      if (!s.index || s.index === '✓') continue;
      hud.chip(s.index, s.title, fadeWindow(t, s.start + 0.6, s.end - 0.3, 0.5));
    }
    for (const lt of LOWER_THIRDS) {
      hud.lowerThird(lt.text, { alpha: fadeWindow(t, lt.start, lt.end, 0.4), sub: lt.sub, mono: lt.mono, accent: lt.accent });
    }

    drawRecapPanel(hud, t, B.recap + 1, B.next - 0.2, [
      { at: B.recap1 + 0.4, title: 'Most reads never reach the database', sub: 'cache-aside: hit from memory, miss → load → store' },
      { at: B.recap2 + 0.4, title: 'Cached answers go stale', sub: 'TTL as a backstop · update or delete on write' },
      { at: B.recap3 + 0.4, title: 'Protect the database', sub: 'eviction policy · stampedes · missing keys · cold starts' },
    ]);
    // Dim the 3D scene behind the end card.
    hud.fade(0.72 * fadeWindow(t, B.next - 0.6, DURATION + 1, 0.8));
    drawEndCard(hud, t, { at: B.next - 0.2, questionAt: B.ask, next: 'Replication', question: 'What do you cache in your app?' });

    if (this.showCaptions) hud.caption(cueAt(t)?.text ?? '');
    hud.fade(Math.max(clamp(1 - t / 0.4), clamp((t - (DURATION - 1)) / 0.9)));
  }

  dispose() {
    this.stage.dispose();
    this.presenter.dispose();
  }
}
