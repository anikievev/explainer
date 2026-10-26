import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { Label3D } from '../../components/Label3D.ts';
import {
  createDnsServer,
  createEdgeServer,
  createFileCube,
  createOriginServer,
  createUser,
  type NodeMesh,
} from '../../components/NodeMesh.ts';
import { PacketPool } from '../../components/PacketPool.ts';
import { fadeWindow, progress, ramp } from '../../components/Timeline.ts';
import { WorldMap, geo } from '../../components/WorldMap.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import {
  DNS_ASIA,
  DNS_EUROPE,
  EDGES,
  EDGE_ORDER,
  IPS,
  NEAREST_EDGE,
  ORIGIN_VIRGINIA,
  USERS,
  type EdgeKey,
  type UserKey,
} from './locations.ts';
import { PAGE_TRIPS } from './overlays.ts';

const USER_KEYS = Object.keys(USERS) as UserKey[];
const FAR_USERS: UserKey[] = ['tokyo', 'saoPaulo', 'sydney'];

const CACHED_FILES = [
  { name: 'logo.png', color: COLORS.healthy, at: 118 },
  { name: 'style.css', color: COLORS.network, at: 119.5 },
  { name: 'app.js', color: COLORS.warning, at: 121 },
  { name: 'font.woff2', color: COLORS.white, at: 125.5 },
  { name: 'video/seg-042.ts', color: COLORS.storage, at: 127.5 },
];

/** Pop-in at `inAt`, shrink-out at `outAt`. */
const life = (t: number, inAt: number, outAt = Infinity, dur = 0.6) =>
  outAt === Infinity
    ? progress(t, inAt, inAt + dur)
    : Math.min(progress(t, inAt, inAt + dur), 1 - progress(t, outAt, outAt + dur));

const lifted = (lonLat: [number, number]) => geo(lonLat[0], lonLat[1], 0.12);

/** Sections 0–2 and the recap: everything that happens on the world map. */
export class MapStage {
  readonly group = new THREE.Group();
  private readonly map = new WorldMap();
  private readonly pool = new PacketPool(120);

  private readonly origin = createOriginServer();
  private readonly users = {} as Record<UserKey, NodeMesh>;
  private readonly edges = {} as Record<EdgeKey, NodeMesh>;
  private readonly dnsEurope = createDnsServer();
  private readonly dnsAsia = createDnsServer();
  private readonly files: NodeMesh[] = [];

  private readonly toOrigin = {} as Record<UserKey, ArcPath>;
  private readonly toEdge = {} as Record<UserKey, ArcPath>;
  private readonly originToEdge = {} as Record<EdgeKey, ArcPath>;
  private readonly berlinToTokyoEdge: ArcPath;
  private readonly berlinToDns: ArcPath;
  private readonly tokyoToDns: ArcPath;

  private readonly labels: {
    origin: Label3D;
    users: Record<UserKey, Label3D>;
    edges: Record<EdgeKey, Label3D>;
    dnsEurope: Label3D;
    dnsAsia: Label3D;
  };
  private readonly arcs: ArcPath[] = [];
  private readonly nodes: NodeMesh[] = [];

  constructor() {
    this.group.add(this.map.group, this.pool.group);

    this.place(this.origin, lifted(ORIGIN_VIRGINIA).setY(0.04));
    for (const key of USER_KEYS) this.users[key] = this.place(createUser(), geo(...USERS[key].lonLat));
    for (const key of EDGE_ORDER) this.edges[key] = this.place(createEdgeServer(), geo(...EDGES[key].lonLat));
    this.place(this.dnsEurope, geo(...DNS_EUROPE));
    this.place(this.dnsAsia, geo(...DNS_ASIA));

    // Cache row floating above the Frankfurt edge (scales with the edge).
    CACHED_FILES.forEach((f, i) => {
      const file = createFileCube(f.color);
      file.group.position.set(-0.6 + i * 0.3, 0.8, 0);
      this.edges.frankfurt.group.add(file.group);
      this.files.push(file);
    });

    const originPos = lifted(ORIGIN_VIRGINIA);
    for (const key of USER_KEYS) {
      const userPos = lifted(USERS[key].lonLat);
      this.toOrigin[key] = this.arc(userPos, originPos, { radius: 0.035 });
      this.toEdge[key] = this.arc(userPos, lifted(EDGES[NEAREST_EDGE[key]].lonLat), { radius: 0.012, height: 0.25 });
    }
    for (const key of EDGE_ORDER) {
      this.originToEdge[key] = this.arc(originPos, lifted(EDGES[key].lonLat), { radius: 0.03, color: COLORS.storage });
    }
    this.berlinToTokyoEdge = this.arc(lifted(USERS.berlin.lonLat), lifted(EDGES.tokyo.lonLat), { radius: 0.04 });
    this.berlinToDns = this.arc(lifted(USERS.berlin.lonLat), lifted(DNS_EUROPE), { radius: 0.012, height: 0.3 });
    this.tokyoToDns = this.arc(lifted(USERS.tokyo.lonLat), lifted(DNS_ASIA), { radius: 0.012, height: 0.3 });

    this.labels = {
      origin: new Label3D(this.origin.top, 'Origin · Virginia', { accent: CSS.storage }),
      users: Object.fromEntries(
        USER_KEYS.map((k) => [k, new Label3D(this.users[k].top, USERS[k].name, { size: 22 })]),
      ) as Record<UserKey, Label3D>,
      edges: Object.fromEntries(
        EDGE_ORDER.map((k) => [k, new Label3D(this.edges[k].top, EDGES[k].name, { size: 18, accent: CSS.edge, offsetY: 18 })]),
      ) as Record<EdgeKey, Label3D>,
      dnsEurope: new Label3D(this.dnsEurope.top, 'DNS', { accent: CSS.network, size: 22 }),
      dnsAsia: new Label3D(this.dnsAsia.top, 'DNS', { accent: CSS.network, size: 22 }),
    };
  }

  private place(node: NodeMesh, position: THREE.Vector3) {
    node.group.position.copy(position);
    this.group.add(node.group);
    this.nodes.push(node);
    return node;
  }

  private arc(from: THREE.Vector3, to: THREE.Vector3, opts: ConstructorParameters<typeof ArcPath>[2]) {
    const a = new ArcPath(from, to, opts);
    this.group.add(a.mesh);
    this.arcs.push(a);
    return a;
  }

  update(t: number, nodeScale: number) {
    const s = nodeScale;
    const packetSize = 0.085 * s;
    const recap = t >= 390;
    const teaser = (inAt: number) => life(t, inAt, 5.0, 0.5);

    // ---- Nodes ------------------------------------------------------------
    this.origin.setBaseScale(s * 1.15);
    this.origin.setAppear(life(t, 5.8));
    const stress = ramp(t, 85.5, 87) * (1 - ramp(t, 91, 92.5));
    this.origin.setStatus(new THREE.Color(COLORS.healthy).lerp(new THREE.Color(COLORS.warning), stress));

    USER_KEYS.forEach((key, i) => {
      const user = this.users[key];
      user.setBaseScale(s);
      const main = key === 'berlin' ? life(t, 6.2) : life(t, 72.5 + (i - 1) * 1.0);
      user.setAppear(Math.max(teaser(0.3 + i * 0.1), main));
    });

    EDGE_ORDER.forEach((key, i) => {
      const edge = this.edges[key];
      edge.setBaseScale(s);
      let k = Math.max(teaser(0.2 + i * 0.08), life(t, 97 + i * 0.75));
      if (key === 'frankfurt') k = Math.max(k, life(t, 11.3, 19.4));
      edge.setAppear(k);
    });

    for (const dns of [this.dnsEurope, this.dnsAsia]) dns.setBaseScale(s);
    this.dnsEurope.setAppear(life(t, 150.5, 166.5));
    this.dnsAsia.setAppear(life(t, 159.5, 166.5));

    this.files.forEach((file, i) => file.setAppear(life(t, CACHED_FILES[i].at, 137)));

    // ---- Arcs -------------------------------------------------------------
    for (const a of this.arcs) a.setOpacity(0);

    // Users → origin (section 1).
    USER_KEYS.forEach((key, i) => {
      const arc = this.toOrigin[key];
      const start = key === 'berlin' ? 7 : 73 + (i - 1) * 1.0;
      const fadeOut = 1 - ramp(t, 90, 92);
      const dimForEdgeDemo = key === 'berlin' ? 1 - 0.7 * fadeWindow(t, 11.3, 20, 0.6) : 1;
      if (t < start || t > 92) return;
      arc.setReveal(ramp(t, start, start + 1.5));
      arc.setOpacity(0.55 * fadeOut * dimForEdgeDemo);
      const farTint = FAR_USERS.includes(key) ? ramp(t, 79, 80.5) : 0;
      arc.setColor(new THREE.Color(COLORS.network).lerp(new THREE.Color(COLORS.warning), farTint));
    });

    // Users → nearest edge.
    USER_KEYS.forEach((key, i) => {
      const arc = this.toEdge[key];
      let opacity = 0.75 * fadeWindow(t, 0.4, 5.3, 0.4);
      if (key === 'berlin') {
        if (t >= 11.6 && t < 20) arc.setReveal(ramp(t, 11.6, 12.2));
        opacity = Math.max(opacity, 0.85 * fadeWindow(t, 11.6, 19.6, 0.4));
        opacity = Math.max(opacity, 0.45 * fadeWindow(t, 138, 150, 0.6));
        if (t >= 157.3 && t < 166.5) arc.setReveal(ramp(t, 157.3, 158.5));
        opacity = Math.max(opacity, 0.9 * fadeWindow(t, 157.3, 166.5, 0.4));
      }
      if (key === 'tokyo') {
        if (t >= 164.4 && t < 166.5) arc.setReveal(ramp(t, 164.4, 165.4));
        opacity = Math.max(opacity, 0.9 * fadeWindow(t, 164.4, 166.5, 0.4));
      }
      // Anycast: every user to its nearest edge.
      const any = 173.5 + i * 0.4;
      if (t >= any && t < 181) arc.setReveal(ramp(t, any, any + 0.8));
      opacity = Math.max(opacity, 0.9 * fadeWindow(t, any, 181.2, 0.4));
      if (key === 'berlin') opacity = Math.max(opacity, 0.9 * fadeWindow(t, 181.2, 210, 0.4));
      if (recap) opacity = Math.max(opacity, 0.85 * ramp(t, 391, 392));
      if (t < 11.6 || (t >= 20 && t < 157.3) || t >= 166.5) arc.setReveal(1);
      arc.setOpacity(opacity);
      arc.setColor(t > 150 ? COLORS.healthy : COLORS.network);
    });

    this.berlinToTokyoEdge.setReveal(ramp(t, 139, 140.5));
    this.berlinToTokyoEdge.setOpacity(0.35 * fadeWindow(t, 139, 150, 0.6));
    this.berlinToTokyoEdge.setColor(COLORS.failure);

    this.berlinToDns.show(0.8 * fadeWindow(t, 151, 157.6, 0.4));
    this.tokyoToDns.show(0.8 * fadeWindow(t, 160.5, 164.6, 0.4));

    EDGE_ORDER.forEach((key) => {
      const arc = this.originToEdge[key];
      if (key === 'frankfurt' && t > 131 && t < 138) {
        arc.setReveal(ramp(t, 131.5, 132.8));
        arc.setOpacity(0.6 * fadeWindow(t, 131.5, 137.5, 0.4));
      }
      if (recap) arc.show(0.22 * ramp(t, 392, 394));
    });

    // ---- Packets ----------------------------------------------------------
    const p = this.pool;
    p.begin();
    const out = { color: COLORS.network, size: packetSize };
    const back = { color: COLORS.healthy, size: packetSize };

    if (t < 5.4) {
      for (const key of USER_KEYS) {
        p.stream(this.toEdge[key].curve, t, 0.6, 5.0, 0.9, 0.6, out);
        p.stream(this.toEdge[key].curve, t, 1.05, 5.0, 0.9, 0.6, { ...back, reverse: true });
      }
    }

    const berlinOrigin = this.toOrigin.berlin.curve;
    p.stream(berlinOrigin, t, 21, 26, 1.4, 2.2, out);
    p.stream(this.toEdge.berlin.curve, t, 12.3, 15.6, 0.7, 0.35, out);
    p.stream(this.toEdge.berlin.curve, t, 12.65, 15.9, 0.7, 0.35, { ...back, reverse: true });

    // Slow-motion single packet (speed of light in fiber).
    p.travel(berlinOrigin, t, 32.5, 6, { ...out, size: packetSize * 1.4, trail: 0.15 });
    p.roundTrip(berlinOrigin, t, 40, 6.5, { ...out, size: packetSize * 1.3 }, { ...back, size: packetSize * 1.3 });

    PAGE_TRIPS.forEach((trip, i) => {
      const dur = trip.end - trip.start;
      const copies = i === PAGE_TRIPS.length - 1 ? 3 : 1;
      for (let c = 0; c < copies; c++) {
        p.roundTrip(berlinOrigin, t, trip.start + c * 0.18, dur - 0.36, out, back);
      }
    });

    if (t > 73 && t < 92) {
      USER_KEYS.forEach((key, i) => {
        const curve = this.toOrigin[key].curve;
        const start = key === 'berlin' ? 73.5 : 74.5 + (i - 1) * 1.0;
        const travel = key === 'berlin' ? 1.4 : 2.4;
        const period = t > 85.5 ? 0.3 : 1.1;
        const stop = 90.2;
        const phase = start + i * 0.17;
        p.stream(curve, t, phase, stop, period, travel, out);
        p.stream(curve, t, phase + travel, stop + travel, period, travel, { ...back, reverse: true });
      });
    }

    p.stream(this.originToEdge.frankfurt.curve, t, 132.5, 137, 0.8, 1.8, { color: COLORS.storage, size: packetSize });

    p.travel(this.berlinToDns.curve, t, 151.6, 1.6, out);
    p.travel(this.berlinToDns.curve, t, 154.6, 1.6, { ...back, reverse: true });
    p.travel(this.toEdge.berlin.curve, t, 158.2, 0.9, out);
    p.travel(this.tokyoToDns.curve, t, 160.9, 1.4, out);
    p.travel(this.tokyoToDns.curve, t, 162.8, 1.4, { ...back, reverse: true });
    p.travel(this.toEdge.tokyo.curve, t, 165, 0.8, out);

    USER_KEYS.forEach((key, i) => {
      const curve = this.toEdge[key].curve;
      const start = 174.3 + i * 0.4;
      p.stream(curve, t, start, 180.6, 0.9, 0.7, out);
      p.stream(curve, t, start + 0.7, 181.3, 0.9, 0.7, { ...back, reverse: true });
      if (recap) {
        p.stream(curve, t, 392 + i * 0.3, 419, 1.1, 0.8, out);
        p.stream(curve, t, 392.8 + i * 0.3, 419.8, 1.1, 0.8, { ...back, reverse: true });
      }
    });
    p.stream(this.toEdge.berlin.curve, t, 182.5, 209.5, 0.6, 0.45, out);
    p.stream(this.toEdge.berlin.curve, t, 182.95, 209.95, 0.6, 0.45, { ...back, reverse: true });

    if (recap) {
      EDGE_ORDER.forEach((key, i) => {
        p.stream(this.originToEdge[key].curve, t, 393 + i * 0.37, 418, 3.7, 2.2, { color: COLORS.storage, size: packetSize * 0.8 });
      });
    }
    p.end();
  }

  /** Labels and map-specific overlays. Called after the 3D update. */
  drawOverlay(hud: Hud, t: number) {
    const L = this.labels;
    const berlinPos = lifted(USERS.berlin.lonLat);

    // Origin.
    let originSub: string | undefined;
    let originAccent: string = CSS.storage;
    if (t >= 26 && t < 32.5) originSub = 'files · app · database';
    if (t >= 85.5 && t < 91.5) {
      originSub = 'answers every request';
      originAccent = CSS.warning;
    }
    if (t >= 131.5 && t < 137.5) originSub = 'source of truth';
    const originText = t >= 72 && t < 92 ? 'Origin' : 'Origin · Virginia';
    L.origin.draw(hud, fadeWindow(t, 6.6, 92, 0.5) + fadeWindow(t, 131.5, 137.5, 0.5), {
      sub: originSub,
      accent: originAccent,
      text: originText,
    });

    // Berlin user.
    const youAlpha = Math.max(fadeWindow(t, 6.8, 72, 0.5), fadeWindow(t, 110.5, 131, 0.5), fadeWindow(t, 181.5, 209.6, 0.5));
    L.users.berlin.draw(hud, youAlpha, { text: 'You · Berlin', size: 24 });
    L.users.berlin.draw(hud, fadeWindow(t, 137.5, 150, 0.5), { text: 'You · Berlin', sub: 'which edge?', size: 24 });

    // City names during the multi-user scene.
    for (const key of USER_KEYS) {
      L.users[key].draw(hud, fadeWindow(t, 73 + Math.max(0, USER_KEYS.indexOf(key) - 1), 91.5, 0.5), {
        accent: FAR_USERS.includes(key) && t > 79 ? CSS.warning : undefined,
      });
    }

    // Distance and RTT callouts on the Atlantic arc.
    const mid = this.toOrigin.berlin.curve.getPointAt(0.5);
    hud.label(mid, '≈ 6,700 km', { alpha: fadeWindow(t, 7.8, 11.2, 0.4), size: 26, offsetY: 10 });
    hud.label(mid, 'round trip ≈ 70 ms in theory · ~100 ms real', {
      alpha: fadeWindow(t, 41, 48, 0.5),
      size: 24,
      offsetY: 10,
      accent: CSS.network,
    });

    // Hook demo + Europe close-ups.
    L.edges.frankfurt.draw(hud, fadeWindow(t, 11.8, 19.4, 0.4), { text: 'CDN edge · Frankfurt', size: 24, offsetY: 30 });
    const edgeFrankfurtAlpha = Math.max(fadeWindow(t, 111, 131, 0.5), fadeWindow(t, 181.5, 209.6, 0.5));
    L.edges.frankfurt.draw(hud, edgeFrankfurtAlpha, { text: 'Edge · Frankfurt', size: 24, offsetY: 64 });
    L.edges.frankfurt.draw(hud, fadeWindow(t, 131.5, 137.5, 0.5), { text: 'Edge · Frankfurt', sub: 'copies', size: 24, offsetY: 30 });
    const fraMid = this.toEdge.berlin.curve.getPointAt(0.5);
    hud.label(fraMid, '≈ 420 km', { alpha: fadeWindow(t, 183, 196, 0.5), size: 24, offsetY: 10, accent: CSS.healthy, below: true });

    // Edge cities as they pop in.
    EDGE_ORDER.forEach((key, i) => {
      L.edges[key].draw(hud, fadeWindow(t, 97.3 + i * 0.75, 110, 0.4));
      L.edges[key].draw(hud, fadeWindow(t, 166.8 + i * 0.3, 181, 0.4), { text: IPS.anycast, mono: true });
    });
    L.edges.tokyo.draw(hud, fadeWindow(t, 139, 150, 0.5), { text: 'Tokyo?', accent: CSS.failure, size: 22 });

    // DNS exchange — Berlin, then Tokyo.
    L.dnsEurope.draw(hud, fadeWindow(t, 151, 166, 0.4));
    L.dnsAsia.draw(hud, fadeWindow(t, 160, 166, 0.4));
    hud.label(berlinPos, 'cdn.example.com ?', { alpha: fadeWindow(t, 151.3, 155.2, 0.3), mono: true, size: 24, offsetY: 70, below: true });
    hud.label(berlinPos, `→ ${IPS.frankfurt} · Frankfurt`, {
      alpha: fadeWindow(t, 156, 159.6, 0.3),
      mono: true,
      size: 24,
      offsetY: 70,
      below: true,
      accent: CSS.healthy,
    });
    const tokyoPos = lifted(USERS.tokyo.lonLat);
    L.users.tokyo.draw(hud, fadeWindow(t, 160, 166, 0.4), { text: 'User · Tokyo', size: 22 });
    hud.label(tokyoPos, 'cdn.example.com ?', { alpha: fadeWindow(t, 160.6, 163.5, 0.3), mono: true, size: 24, offsetY: 70, below: true });
    hud.label(tokyoPos, `→ ${IPS.tokyo} · Tokyo`, {
      alpha: fadeWindow(t, 164, 166.2, 0.3),
      mono: true,
      size: 24,
      offsetY: 70,
      below: true,
      accent: CSS.healthy,
    });

    this.drawCachePanel(hud, t);
  }

  private drawCachePanel(hud: Hud, t: number) {
    const alpha = fadeWindow(t, 117.5, 131, 0.5);
    if (alpha <= 0) return;
    const x = 1400 + (1 - alpha) * 30;
    const y = 220;
    hud.roundRect(x, y, 440, 110 + CACHED_FILES.length * 58, 22, CSS.panel, CSS.edge, alpha);
    hud.text('Cache · Frankfurt edge', x + 30, y + 46, { size: 26, weight: 700, color: CSS.edge, alpha });
    CACHED_FILES.forEach((f, i) => {
      const a = alpha * ramp(t, f.at, f.at + 0.5);
      const yy = y + 110 + i * 58;
      hud.roundRect(x + 30, yy - 14, 22, 28, 4, `#${f.color.toString(16).padStart(6, '0')}`, undefined, a);
      hud.text(f.name, x + 70, yy, { size: 26, weight: 500, mono: true, alpha: a });
    });
  }

  dispose() {
    this.map.dispose();
    this.pool.dispose();
    for (const n of this.nodes) n.dispose();
    for (const f of this.files) f.dispose();
    for (const a of this.arcs) a.dispose();
  }
}

