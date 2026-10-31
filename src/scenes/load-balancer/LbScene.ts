import * as THREE from 'three';
import { CameraRig, type CameraShot } from '../../components/CameraRig.ts';
import type { Hud } from '../../components/Hud.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { drawEndCard, drawRecapPanel } from '../../components/Overlays.ts';
import { clamp, fadeWindow } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { B } from './beats.ts';
import { IntroMap } from './IntroMap.ts';
import { updatePresenter } from './presenter.ts';
import { DURATION, SECTIONS, cueAt } from './script.ts';
import { ShopStage } from './ShopStage.ts';

type V3 = THREE.Vector3Tuple;

/** Map intro ends here: hard cut (hidden by a fade) into the shop stage. */
const CUT = B.shop + 2.6;

/** Camera looking at `target` from `distance`, raised `elevation` degrees above the floor (from +z). */
function view(target: V3, distance: number, elevation: number): [V3, V3] {
  const e = THREE.MathUtils.degToRad(elevation);
  return [[target[0], target[1] + distance * Math.sin(e), target[2] + distance * Math.cos(e)], target];
}

// Map shots (episode 1 geometry: x = lon / 10, z = -lat / 10).
const MAP_WIDE: [V3, V3] = [[-3.1, 8.0, 3.6], [-3.1, 0, -4.6]];
const MAP_VIRGINIA: [V3, V3] = [[-7.2, 2.8, -1.5], [-7.75, 0.3, -3.9]];
// Stage shots: looking down ~50° so the server column (spread along z) separates on screen.
const SINGLE = view([-2.6, 0.5, 0], 12, 40);
const SCALE = view([1.4, 1.2, 0], 9, 25);
const STAGE = view([-2.6, 0.3, 0.2], 13.5, 50);
const LB_CLOSE = view([-3, 0.5, 0], 10.5, 40);
const AUTOSCALE = view([-2.4, 0.3, 1.8], 16.5, 52);
const WIDE = view([-0.3, 0.3, -0.4], 16, 50);
const SPOF = view([-3, 0.3, -1.4], 13, 58);
const DATABASE = view([2.6, 0.4, -0.2], 14, 55);
// Recap: system on the right, checklist panel on the left.
const RECAP = view([-5.9, 0.3, 0.4], 25, 50);

const shot = (at: number, [position, target]: [V3, V3], moveDuration = 2.6, cut = false): CameraShot & { moveDuration: number } => ({
  at,
  position,
  target,
  moveDuration,
  cut,
});

const SHOTS = [
  shot(0, MAP_WIDE),
  shot(CUT - 0.05, MAP_VIRGINIA, CUT - 2.5),
  shot(CUT, SINGLE, 0, true),
  shot(B.scaleUp + 1, SCALE, 2.4),
  shot(B.scaleOut + 0.8, STAGE, 2.4),
  shot(B.address + 1, LB_CLOSE, 2.2),
  shot(B.hidden + 1, STAGE, 2.4),
  shot(B.autoscale + 1.2, AUTOSCALE, 2.4),
  shot(B.s4 + 0.6, STAGE, 2.4),
  shot(B.sticky + 0.6, WIDE, 2.4),
  shot(B.spof + 1, SPOF, 2.4),
  shot(B.cloud + 0.8, STAGE, 2.4),
  shot(B.database + 1, DATABASE, 2.4),
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
  LT(B.limits + 0.4, B.queue - 0.2, 'Limits: CPU · memory · connections'),
  LT(B.queue + 0.4, B.crash - 0.2, 'Requests wait in a queue', { accent: CSS.warning }),
  LT(B.scaleUp + 0.4, B.scaleOut - 0.2, 'Scale up = a bigger server', { sub: 'there is always a biggest size' }),
  LT(B.scaleOut + 0.4, B.question - 0.2, 'Scale out = more servers', { accent: CSS.edge }),
  LT(B.job + 0.4, B.dns - 0.2, 'Load balancer = one entry point for many servers', { accent: CSS.network }),
  LT(B.dns + 0.3, B.hidden - 0.2, 'shop.example → 203.0.113.10', { mono: true, sub: 'DNS points the name at the load balancer', accent: CSS.network }),
  LT(B.roundRobin + 0.3, B.weighted - 0.2, 'Round robin', { sub: '1 → 2 → 3 → 1 …', accent: CSS.network }),
  LT(B.weighted + 0.3, B.leastConn - 0.2, 'Weighted round robin', { sub: 'a bigger server gets a bigger share (here 1 : 1 : 2)', accent: CSS.network }),
  LT(B.leastConn + 0.3, B.hash - 0.2, 'Least connections', { sub: 'AWS ALB calls it "least outstanding requests"', accent: CSS.network }),
  LT(B.hash + 0.3, B.defaults - 0.2, 'Hashing', { sub: 'same client IP → same server', accent: CSS.network }),
  LT(B.defaults + 0.3, B.s3 - 0.4, 'Default in NGINX and AWS ALB: round robin'),
  LT(B.checking + 0.4, B.awsDefaults - 0.2, 'Health check', { sub: 'the load balancer requests a health page, on a schedule', accent: CSS.healthy }),
  LT(B.awsDefaults + 0.3, B.noNew + 2, 'AWS ALB defaults', { sub: 'every 30 s · 2 fails → unhealthy · 5 passes → healthy', accent: CSS.healthy }),
  LT(B.failOpen + 2.5, B.deploys - 0.2, 'All targets unhealthy → AWS ALB sends to all of them', { sub: 'it "fails open"', accent: CSS.warning }),
  LT(B.draining + 0.4, B.autoscale - 0.2, 'Draining: no new requests, in-flight ones finish', { sub: 'AWS default deregistration delay: 300 s', accent: CSS.warning }),
  LT(B.autoscale + 0.5, B.s4 - 0.4, 'Autoscaling adds servers', { sub: 'they get traffic once they pass a health check', accent: CSS.healthy }),
  LT(B.l4 + 0.3, B.l4Fast + 3, 'Layer 4: IP addresses and ports', { sub: 'e.g. AWS Network Load Balancer (NLB)', accent: CSS.network }),
  LT(B.l7 + 0.3, B.paths - 0.2, 'Layer 7: reads the HTTP request', { sub: 'path · host name · headers', accent: CSS.network }),
  LT(B.vendors + 0.3, B.tls - 0.2, 'AWS ALB = Layer 7 · AWS NLB = Layer 4', { sub: 'NGINX and HAProxy can work at either layer' }),
  LT(B.tls + 0.3, B.xff - 0.2, 'Both can terminate TLS', { sub: 'only Layer 7 reads the request inside' }),
  LT(B.xff + 0.3, B.s5 - 0.4, 'X-Forwarded-For: 203.0.113.7', { mono: true, sub: "the user's real IP, added by the load balancer", accent: CSS.network }),
  LT(B.sticky + 0.4, B.cookie - 0.2, 'Sticky sessions: one user → one server', { accent: CSS.warning }),
  LT(B.cookie + 0.3, B.pileUp - 0.2, 'Set-Cookie: AWSALB=…', { mono: true, sub: "AWS ALB's stickiness cookie", accent: CSS.warning }),
  LT(B.store + 0.4, B.spof - 0.4, 'Fix: keep sessions in a shared store', { accent: CSS.healthy }),
  LT(B.spof + 0.4, B.runTwo - 0.2, 'One load balancer = a single point of failure', { accent: CSS.failure }),
  LT(B.runTwo + 0.4, B.cloud - 0.2, 'Active + standby share a virtual IP', { sub: 'e.g. VRRP with keepalived', accent: CSS.healthy }),
  LT(B.zones + 0.3, B.database - 0.4, 'AWS ALB: nodes in at least two Availability Zones', { accent: CSS.network }),
  LT(B.dbNotFaster + 0.3, B.dbTools - 0.2, "Load balancing doesn't scale the database", { accent: CSS.warning }),
  LT(B.dbTools + 0.4, B.s5End, 'Database scaling: caching · read replicas', { sub: 'stories for future videos', accent: CSS.storage }),
];

/** Triangular fade used to hide hard cuts. */
const cutFade = (t: number, at: number, half = 0.6) => clamp(1 - Math.abs(t - at) / half);

export class LbScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = DURATION;
  readonly presenter = new MascotLayer();
  private readonly rig: CameraRig;
  private readonly intro = new IntroMap();
  private readonly stage = new ShopStage();

  constructor(aspect: number, private readonly showCaptions = false) {
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
    this.rig = new CameraRig(this.camera, SHOTS);
    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.Fog(COLORS.fog, 34, 80);
    this.scene.add(new THREE.HemisphereLight(0x9cc3ff, 0x05080f, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(6, 12, 8);
    this.scene.add(key, this.intro.group, this.stage.group);
  }

  update(t: number) {
    this.rig.update(t);
    const onMap = t < CUT;
    this.intro.group.visible = onMap;
    this.stage.group.visible = !onMap;
    if (onMap) this.intro.update(t);
    else this.stage.update(t);
    updatePresenter(this.presenter, t);
  }

  drawOverlay(hud: Hud, t: number) {
    if (t < CUT) this.intro.drawOverlay(hud, t);
    else this.stage.drawOverlay(hud, t);

    hud.titleCard('How Load Balancers Work', 'Why one server is never enough', fadeWindow(t, 0.15, B.shop - 0.2, 0.5));

    for (const s of SECTIONS) {
      if (!s.index || s.index === '✓') continue;
      hud.chip(s.index, s.title, fadeWindow(t, s.start + 0.6, s.end - 0.3, 0.5));
    }
    for (const lt of LOWER_THIRDS) {
      hud.lowerThird(lt.text, { alpha: fadeWindow(t, lt.start, lt.end, 0.4), sub: lt.sub, mono: lt.mono, accent: lt.accent });
    }

    drawRecapPanel(hud, t, B.recap + 1, B.next - 0.2, [
      { at: B.recap1 + 0.4, title: 'One address, many servers', sub: 'round robin · weighted · least conn · hash' },
      { at: B.recap2 + 0.4, title: 'Health checks route around failures', sub: 'Layer 4 = connections · Layer 7 = HTTP' },
      { at: B.recap3 + 0.4, title: 'Watch the traps', sub: 'sticky sessions · single LB · shared database' },
    ]);
    // Dim the 3D scene behind the end card.
    hud.fade(0.72 * fadeWindow(t, B.next - 0.6, DURATION + 1, 0.8));
    drawEndCard(hud, t, { at: B.next - 0.2, questionAt: B.ask, next: 'Message queues', question: 'How many servers sit behind your load balancer?' });

    if (this.showCaptions) hud.caption(cueAt(t)?.text ?? '');
    hud.fade(Math.max(cutFade(t, CUT, 0.5), clamp((t - (DURATION - 1)) / 0.9)));
  }

  dispose() {
    this.intro.dispose();
    this.stage.dispose();
    this.presenter.dispose();
  }
}
