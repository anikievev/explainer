import * as THREE from 'three';
import { CameraRig, type CameraShot } from '../../components/CameraRig.ts';
import type { Hud } from '../../components/Hud.ts';
import { clamp, fadeWindow } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { DiagramStage } from './DiagramStage.ts';
import { MapStage } from './MapStage.ts';
import { drawEndCard, drawLatencyComparePanel, drawLimitsCards, drawRecap, drawRoundTripPanel } from './overlays.ts';
import { DURATION, SECTIONS, cueAt } from './script.ts';

type V3 = THREE.Vector3Tuple;

// Map shots.
const OVERVIEW: [V3, V3] = [[1.5, 25, 16.5], [1.5, 0, 0.5]];
const ATLANTIC: [V3, V3] = [[-3.1, 8.0, 3.6], [-3.1, 0, -4.6]];
const EUROPE: [V3, V3] = [[1.2, 2.6, -2.4], [1.2, 0, -5.2]];
const FRANKFURT: [V3, V3] = [[1.0, 2.2, -2.6], [0.95, 0.2, -5.05]];
const DNS_EUROPE: [V3, V3] = [[1.6, 3.4, -2.2], [1.6, 0, -5.4]];
const JAPAN: [V3, V3] = [[13.7, 3.6, -1.0], [13.7, 0, -4.1]];
const RECAP: [V3, V3] = [[-4.5, 25, 16.5], [-4.5, 0, 0.5]];
// Diagram shots.
const STAGE: [V3, V3] = [[0, 4.4, 13.6], [0, 1.2, 0]];
const STAGE_DRIFT: [V3, V3] = [[0.5, 4.1, 13.0], [0.1, 1.2, 0]];
const TTL_FOCUS: [V3, V3] = [[-1.6, 3.4, 9.0], [-1.6, 1.6, 0]];
const STAGE_HIGH: [V3, V3] = [[0, 6.6, 13.2], [-0.6, 0.6, -1.4]];
const ORIGIN_FOCUS: [V3, V3] = [[1.4, 4.0, 11.6], [1.8, 1.2, 0]];

const shot = (at: number, [position, target]: [V3, V3], moveDuration = 2.6, cut = false): CameraShot & { moveDuration: number } => ({
  at,
  position,
  target,
  moveDuration,
  cut,
});

const SHOTS = [
  shot(0, [[0, 31, 22], [0, 0, 1]]),
  shot(5.2, OVERVIEW, 5.2),
  shot(9, ATLANTIC, 3.4),
  shot(13.5, EUROPE, 2.6),
  shot(22, ATLANTIC, 2.6),
  shot(47, [[-3.4, 8.4, 4.0], [-3.1, 0, -4.4]], 20),
  shot(75.5, OVERVIEW, 3.2),
  shot(96, [[1.5, 24, 15.5], [1.5, 0, 0.3]], 14),
  shot(113, FRANKFURT, 3),
  shot(134.2, ATLANTIC, 2.8),
  shot(141, OVERVIEW, 3),
  shot(152, DNS_EUROPE, 3),
  shot(161, JAPAN, 2.5),
  shot(168.8, OVERVIEW, 2.8),
  shot(184, EUROPE, 3),
  shot(209.9, [[1.4, 2.4, -2.6], EUROPE[1]], 24),
  shot(210, STAGE, 0, true),
  shot(236.9, STAGE_DRIFT, 26),
  shot(237, STAGE, 0, true),
  shot(282, TTL_FOCUS, 3),
  shot(296.5, STAGE, 2.5),
  shot(318, STAGE_HIGH, 2.2),
  shot(325, STAGE, 2.2),
  shot(371, ORIGIN_FOCUS, 2.2),
  shot(384, STAGE, 2.2),
  shot(390, RECAP, 0, true),
  shot(420, [[-4.5, 27, 18], RECAP[1]], 30),
];

interface LowerThird {
  start: number;
  end: number;
  text: string;
  sub?: string;
  mono?: boolean;
  accent?: string;
}

const LOWER_THIRDS: LowerThird[] = [
  { start: 15.8, end: 19.9, text: 'CDN = Content Delivery Network', accent: CSS.edge },
  { start: 21, end: 25.8, text: 'Without a CDN: every request → one origin' },
  { start: 32.5, end: 38.8, text: 'Light in fiber ≈ 200,000 km/s', sub: 'about two-thirds of its speed in a vacuum', accent: CSS.network },
  { start: 40, end: 47.8, text: 'RTT = round-trip time', sub: 'there and back again', accent: CSS.network },
  { start: 53, end: 59.9, text: 'TCP = the connection  ·  TLS = the encryption' },
  { start: 79, end: 84.8, text: 'Farther away → longer wait', accent: CSS.warning },
  { start: 85.5, end: 89.8, text: 'One origin answers every request', accent: CSS.warning },
  { start: 90.5, end: 95.8, text: 'Idea: move the content closer to users', accent: CSS.edge },
  { start: 103.5, end: 109.8, text: 'PoP = Point of Presence', sub: 'a location with CDN edge servers', accent: CSS.edge },
  { start: 117.5, end: 123.8, text: 'Cache = stored copies at the edge', accent: CSS.edge },
  { start: 124.2, end: 130.8, text: 'Same for every visitor → cacheable' },
  { start: 131.6, end: 136.8, text: 'Origin = source of truth  ·  Edges = copies', accent: CSS.storage },
  { start: 144.4, end: 149.8, text: 'Routing: DNS or Anycast' },
  { start: 150.5, end: 158.8, text: 'DNS = Domain Name System', sub: 'turns a name into an IP address', accent: CSS.network },
  { start: 166.6, end: 172.8, text: 'Anycast = one IP address, many locations', accent: CSS.edge },
  { start: 173.2, end: 180.8, text: 'BGP = Border Gateway Protocol', sub: "the internet's routing system picks the nearest edge, in network terms" },
  { start: 203, end: 209.6, text: 'The edge handles: connection · encryption · cached files', accent: CSS.healthy },

  { start: 230.2, end: 236.5, text: 'Cache HIT → served straight from the edge', accent: CSS.healthy },
  { start: 266.2, end: 271.8, text: 'MISS = one long trip, then HITs for everyone nearby', accent: CSS.warning },
  { start: 273, end: 278.8, text: "Copies can't live forever" },
  { start: 279.4, end: 286.8, text: 'Cache-Control: max-age=3600', sub: 'keep this copy for one hour (3600 s)', mono: true, accent: CSS.network },
  { start: 295, end: 301.8, text: 'Revalidate: has it changed?', sub: 'the edge sends the version tag (ETag) of its copy', accent: CSS.network },
  { start: 302.4, end: 308.8, text: '304 Not Modified', sub: 'no file sent · the timer starts again', mono: true, accent: CSS.healthy },
  { start: 309.6, end: 315.8, text: '200 OK', sub: 'the new version replaces the old copy', mono: true, accent: CSS.network },
  { start: 316.4, end: 322.8, text: 'Purge = drop cached copies on the edges, now', accent: CSS.failure },
  { start: 323.6, end: 329.8, text: 'app.v1.js → app.v2.js', sub: 'a new name is a new cache entry: no stale copies', mono: true, accent: CSS.network },

  { start: 330.4, end: 335.8, text: "A CDN isn't magic" },
  { start: 343.2, end: 349.8, text: 'Cache-Control: private, no-store', sub: 'personal data is not stored in a shared cache', mono: true, accent: CSS.warning },
  { start: 356.6, end: 361.8, text: 'Rarely requested → cold cache → mostly MISS', accent: CSS.warning },
  { start: 362.6, end: 368.8, text: 'Already near the origin → small gain', accent: CSS.warning },
  { start: 376.2, end: 382.8, text: "A CDN shortens the distance. It doesn't fix slow code.", accent: CSS.warning },
];

/** Triangular fade used to hide hard cuts between stages. */
const cutFade = (t: number, at: number, half = 0.6) => clamp(1 - Math.abs(t - at) / half);

export class CdnScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = DURATION;
  private readonly rig: CameraRig;
  private readonly mapStage = new MapStage();
  private readonly diagramStage = new DiagramStage();

  constructor(aspect: number, private readonly showCaptions = false) {
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
    this.rig = new CameraRig(this.camera, SHOTS);

    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.Fog(COLORS.fog, 34, 80);
    this.scene.add(new THREE.HemisphereLight(0x9cc3ff, 0x05080f, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(6, 12, 8);
    this.scene.add(key);

    this.scene.add(this.mapStage.group, this.diagramStage.group);
  }

  update(t: number) {
    this.rig.update(t);
    const onMap = t < 210 || t >= 390;
    this.mapStage.group.visible = onMap;
    this.diagramStage.group.visible = !onMap;
    if (onMap) {
      const nodeScale = clamp(this.rig.distanceToTarget() / 14, 0.22, 1.6);
      this.mapStage.update(t, nodeScale);
    } else {
      this.diagramStage.update(t);
    }
  }

  drawOverlay(hud: Hud, t: number) {
    const onMap = t < 210 || t >= 390;
    if (onMap) this.mapStage.drawOverlay(hud, t);
    else this.diagramStage.drawOverlay(hud, t);

    // Title card: topic is clear within the first 3 seconds.
    hud.titleCard('How a CDN Works', 'Why do websites load fast across the world?', fadeWindow(t, 0.15, 5.0, 0.5));

    for (const s of SECTIONS) {
      if (!s.index) continue;
      hud.chip(s.index, s.title, fadeWindow(t, s.start + 0.6, s.end - 0.3, 0.5));
    }

    for (const lt of LOWER_THIRDS) {
      hud.lowerThird(lt.text, { alpha: fadeWindow(t, lt.start, lt.end, 0.4), sub: lt.sub, mono: lt.mono, accent: lt.accent });
    }

    drawRoundTripPanel(hud, t);
    drawLatencyComparePanel(hud, t);
    drawLimitsCards(hud, t);
    drawRecap(hud, t);
    drawEndCard(hud, t);

    if (this.showCaptions) hud.caption(cueAt(t)?.text ?? '');

    hud.fade(Math.max(cutFade(t, 210), cutFade(t, 237, 0.35), cutFade(t, 390), clamp((t - 419) / 0.9)));
  }

  dispose() {
    this.mapStage.dispose();
    this.diagramStage.dispose();
  }
}
