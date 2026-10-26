import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { Label3D } from '../../components/Label3D.ts';
import { createEdgeServer, createFileCube, createOriginServer, createUser, type NodeMesh } from '../../components/NodeMesh.ts';
import { PacketPool } from '../../components/PacketPool.ts';
import { clamp, easeInOut, fadeWindow, lerp, progress, pulse, ramp } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { formatCountdown } from './overlays.ts';

const FILE_NEUTRAL = 0xe2e8f0;
const FILE_V2 = 0x7dd3fc;
const NODE_SCALE = 1.9;
const FILE_SCALE = 1.5;

const POS = {
  user: new THREE.Vector3(-5.6, 0, 0.6),
  user2: new THREE.Vector3(-5.9, 0, 2.3),
  userNear: new THREE.Vector3(3.4, 0, 2.4),
  edge: new THREE.Vector3(-2.4, 0, 0),
  origin: new THREE.Vector3(5.2, 0, 0),
};
const SLOT_Y = 1.95;
const slotPosition = (i: number) => new THREE.Vector3(POS.edge.x + (i - 1.5) * 1.0, SLOT_Y, 0);
const GHOST_EDGES = [new THREE.Vector3(-4.6, 0, -3.2), new THREE.Vector3(-0.2, 0, -3.2), new THREE.Vector3(2.0, 0, -3.6)];

const life = (t: number, inAt: number, outAt = Infinity, dur = 0.5) =>
  outAt === Infinity
    ? progress(t, inAt, inAt + dur)
    : Math.min(progress(t, inAt, inAt + dur), 1 - progress(t, outAt, outAt + dur));

/** Circle used for the cache-lifetime ring, starting at 12 o'clock, clockwise. */
class CircleCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly radius: number) {
    super();
  }
  getPoint(u: number, target = new THREE.Vector3()) {
    const a = Math.PI / 2 - u * Math.PI * 2;
    return target.set(Math.cos(a) * this.radius, Math.sin(a) * this.radius, 0);
  }
}

/** Sections 3–4: a close-up "user → edge → origin" diagram. */
export class DiagramStage {
  readonly group = new THREE.Group();
  private readonly pool = new PacketPool(40, 0.12);
  private readonly disposables: Array<{ dispose(): void }> = [];

  private readonly user = createUser();
  private readonly user2 = createUser();
  private readonly userNear = createUser();
  private readonly edge = createEdgeServer();
  private readonly origin = createOriginServer();
  private readonly ghosts = GHOST_EDGES.map(() => createEdgeServer());
  private readonly ghostFiles = GHOST_EDGES.map(() => createFileCube(FILE_NEUTRAL));
  private readonly shelf = [0, 1, 2].map(() => createFileCube(FILE_NEUTRAL));
  private readonly hero = createFileCube(FILE_NEUTRAL);
  private readonly heroV2 = createFileCube(FILE_V2);
  private readonly appV2 = createFileCube(FILE_V2);

  private readonly userToEdge: ArcPath;
  private readonly user2ToEdge: ArcPath;
  private readonly edgeToOrigin: ArcPath;
  private readonly nearToOrigin: ArcPath;
  private readonly arcs: ArcPath[];

  private readonly ttlRing: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  private readonly emptySlot: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  private readonly rack: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  private readonly purgeWaves: Array<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly nodes: NodeMesh[];

  private readonly labels: Record<'user' | 'user2' | 'userNear' | 'edge' | 'origin', Label3D>;

  constructor() {
    // Floor: dark disc with a faint grid.
    const floorGeo = new THREE.CircleGeometry(80, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    const grid = new THREE.GridHelper(160, 160, COLORS.oceanGrid, COLORS.oceanGrid);
    this.group.add(floor, grid, this.pool.group);
    this.disposables.push(floorGeo, floorMat, grid.geometry, grid.material as THREE.Material);

    const place = (node: NodeMesh, pos: THREE.Vector3, scale: number) => {
      node.group.position.copy(pos);
      node.setBaseScale(scale);
      this.group.add(node.group);
      return node;
    };
    place(this.user, POS.user, NODE_SCALE);
    place(this.user2, POS.user2, NODE_SCALE);
    place(this.userNear, POS.userNear, NODE_SCALE);
    place(this.edge, POS.edge, NODE_SCALE * 1.1);
    place(this.origin, POS.origin, NODE_SCALE * 1.15);
    this.ghosts.forEach((g, i) => {
      place(g, GHOST_EDGES[i], NODE_SCALE * 0.75);
      this.ghostFiles[i].group.position.set(0, 0.85, 0);
      this.ghostFiles[i].setBaseScale(1.2);
      g.group.add(this.ghostFiles[i].group);
    });
    this.shelf.forEach((f, i) => place(f, slotPosition(i), FILE_SCALE));
    place(this.hero, slotPosition(3), FILE_SCALE);
    place(this.heroV2, slotPosition(3), FILE_SCALE);
    place(this.appV2, slotPosition(3), FILE_SCALE);

    // Cache rack outline above the edge, plus a dashed outline for an empty slot.
    const rackGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(4.2, 0.85, 0.6));
    this.rack = new THREE.LineSegments(rackGeo, new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true }));
    this.rack.position.set(POS.edge.x, SLOT_Y + 0.25, 0);
    const slotGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.4, 0.5, 0.15));
    this.emptySlot = new THREE.LineSegments(slotGeo, new THREE.LineBasicMaterial({ color: COLORS.warning, transparent: true }));
    this.emptySlot.position.copy(slotPosition(3)).setY(SLOT_Y + 0.22);
    this.group.add(this.rack, this.emptySlot);
    this.disposables.push(rackGeo, this.rack.material, slotGeo, this.emptySlot.material);

    const ringGeo = new THREE.TubeGeometry(new CircleCurve(0.42), 96, 0.035, 8, false);
    this.ttlRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLORS.healthy }));
    this.ttlRing.position.copy(slotPosition(3)).setY(SLOT_Y + 0.22);
    this.group.add(this.ttlRing);
    this.disposables.push(ringGeo, this.ttlRing.material);

    const waveGeo = new THREE.RingGeometry(0.9, 1.0, 48);
    this.disposables.push(waveGeo);
    for (const pos of [POS.edge, ...GHOST_EDGES]) {
      const mat = new THREE.MeshBasicMaterial({ color: COLORS.failure, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      const wave = new THREE.Mesh(waveGeo, mat);
      wave.rotation.x = -Math.PI / 2;
      wave.position.copy(pos).setY(0.05);
      this.group.add(wave);
      this.purgeWaves.push(wave);
      this.disposables.push(mat);
    }

    const at = (p: THREE.Vector3, y = 0.9) => p.clone().setY(y);
    this.userToEdge = new ArcPath(at(POS.user), at(POS.edge), { height: 0.9, radius: 0.03 });
    this.user2ToEdge = new ArcPath(at(POS.user2), at(POS.edge), { height: 0.9, radius: 0.03 });
    this.edgeToOrigin = new ArcPath(at(POS.edge), at(POS.origin), { height: 2.6, radius: 0.035 });
    this.nearToOrigin = new ArcPath(at(POS.userNear), at(POS.origin), { height: 0.7, radius: 0.03 });
    this.arcs = [this.userToEdge, this.user2ToEdge, this.edgeToOrigin, this.nearToOrigin];
    for (const a of this.arcs) this.group.add(a.mesh);

    this.nodes = [this.user, this.user2, this.userNear, this.edge, this.origin, ...this.ghosts, ...this.ghostFiles, ...this.shelf,
      this.hero, this.heroV2, this.appV2];

    this.labels = {
      user: new Label3D(this.user.top, 'You · Berlin', { size: 26 }),
      user2: new Label3D(this.user2.top, 'Next user · Tokyo', { size: 22, below: true, offsetY: 150 }),
      userNear: new Label3D(this.userNear.top, 'User · Washington', { size: 24 }),
      edge: new Label3D(this.edge.top, 'Edge · Frankfurt', { size: 26, accent: CSS.edge, offset: [0, -0.62, 0], below: true, offsetY: 24 }),
      origin: new Label3D(this.origin.top, 'Origin · Virginia', { size: 26, accent: CSS.storage }),
    };
  }

  update(t: number) {
    const limits = t >= 330;

    // ---- Nodes ------------------------------------------------------------
    this.user.setAppear(life(t, 210.2));
    this.edge.setAppear(life(t, 210.4));
    this.origin.setAppear(life(t, 210.6));
    this.user2.setAppear(life(t, 259.4, 271.5));
    this.userNear.setAppear(life(t, 362.3, 369.5));

    const originIdle = fadeWindow(t, 223.5, 236.6, 0.6);
    const dbWork = fadeWindow(t, 372.3, 374.7, 0.3) * pulse(t, 0.5);
    this.origin.setStatus(
      new THREE.Color(COLORS.healthy).lerp(new THREE.Color(COLORS.serverDark), originIdle).lerp(new THREE.Color(COLORS.warning), dbWork),
      2.2 - originIdle * 1.8,
    );

    this.ghosts.forEach((g, i) => {
      g.setAppear(life(t, 316.4 + i * 0.25, 329.5));
      this.ghostFiles[i].setAppear(life(t, 316.8 + i * 0.25, 319.2, 0.35));
    });

    // Shelf files: the site's shared assets.
    this.shelf.forEach((f, i) => {
      f.setAppear(life(t, 211 + i * 0.35, 356.6, 0.4));
      f.setStatus(FILE_NEUTRAL, 0.5);
    });
    const hitFlash = (start: number, end: number) => fadeWindow(t, start, end, 0.25);
    const logoHit = hitFlash(219.6, 222.4);
    this.shelf[0].setStatus(new THREE.Color(FILE_NEUTRAL).lerp(new THREE.Color(COLORS.healthy), logoHit), 0.5 + 2 * logoHit);
    // Repeated hits on the fast path.
    for (let n = 0; n < 6; n++) {
      const start = 226.4 + n * 1.6 + 0.6;
      const k = hitFlash(start, start + 0.8);
      if (k > 0) this.shelf[n % 3].setStatus(new THREE.Color(FILE_NEUTRAL).lerp(new THREE.Color(COLORS.healthy), k), 0.5 + 2 * k);
    }

    // hero.jpg v1: arrives from the origin on a miss, replaced at 315, gone before v2 is purged.
    const heroTravel = progress(t, 251.2, 254.4);
    const heroSettle = ramp(t, 254.4, 255.2);
    this.hero.setAppear(t < 251.2 ? 0 : life(t, 251.2, 314.6, 0.4));
    if (heroSettle <= 0) {
      this.hero.group.position.copy(this.edgeToOrigin.curve.getPointAt(1 - easeInOut(clamp(heroTravel))));
    } else {
      this.hero.group.position.copy(this.edgeToOrigin.curve.getPointAt(0)).lerp(slotPosition(3), heroSettle);
    }
    const heroHit = Math.max(hitFlash(262.6, 265.4), ...[288, 290.3, 292.6].map((s) => hitFlash(s + 0.6, s + 1.3)));
    const heroQuestion = fadeWindow(t, 273, 279, 0.4) * pulse(t, 0.8);
    this.hero.setStatus(
      new THREE.Color(FILE_NEUTRAL).lerp(new THREE.Color(COLORS.healthy), heroHit).lerp(new THREE.Color(COLORS.warning), heroQuestion),
      0.5 + 2 * Math.max(heroHit, heroQuestion),
    );

    // hero.jpg v2: appears at the origin, travels to the edge, then purged.
    this.heroV2.setAppear(life(t, 309.3, 319.2, 0.35));
    const v2Pos = POS.origin.clone().add(new THREE.Vector3(-0.2, 1.9, 0.9));
    const v2Travel = progress(t, 312.4, 314.8);
    if (v2Travel <= 0) this.heroV2.group.position.copy(v2Pos);
    else if (v2Travel < 1) this.heroV2.group.position.copy(this.edgeToOrigin.curve.getPointAt(1 - easeInOut(v2Travel)));
    else this.heroV2.group.position.copy(this.edgeToOrigin.curve.getPointAt(0)).lerp(slotPosition(3), ramp(t, 314.8, 315.5));

    this.appV2.setAppear(life(t, 324, 356.6, 0.4));
    this.edge.setStatus(COLORS.healthy);

    // Empty slot outline while the file is missing.
    this.emptySlot.visible = (t >= 238 && t < 255) || (t >= 319.6 && t < 324);
    this.emptySlot.material.opacity = 0.4 + 0.6 * pulse(t, 0.7);
    this.emptySlot.material.color.set(t < 300 ? COLORS.warning : COLORS.failure);
    this.rack.material.opacity = 0.55 * ramp(t, 210.6, 211.4);
    this.rack.visible = !limits || t < 362;

    // TTL ring: full at 280, drains 287→294, refills after 304, drains fast at 309.
    const ringAlpha = fadeWindow(t, 280, 316, 0.4);
    let remaining = 1;
    if (t >= 287 && t < 306.5) remaining = 1 - ramp(t, 287, 294, (k) => k);
    if (t >= 306.5) remaining = ramp(t, 306.5, 307.6);
    if (t >= 309.4) remaining = 1 - ramp(t, 309.4, 310.4, (k) => k);
    if (t >= 315) remaining = ramp(t, 315, 315.6);
    this.ttlRing.visible = ringAlpha > 0;
    const ringGeo = this.ttlRing.geometry;
    const perSeg = ringGeo.index!.count / ringGeo.parameters.tubularSegments;
    const expired = remaining <= 0.02;
    const drawn = expired ? 1 : remaining;
    ringGeo.setDrawRange(0, Math.max(perSeg, Math.floor(drawn * ringGeo.parameters.tubularSegments) * perSeg));
    this.ttlRing.material.color.set(remaining > 0.3 ? COLORS.healthy : expired ? COLORS.failure : COLORS.warning);
    this.ttlRing.scale.setScalar(Math.max(0.001, ringAlpha));

    // Purge shockwaves.
    this.purgeWaves.forEach((w, i) => {
      const k = progress(t, 318.4 + i * 0.15, 319.6 + i * 0.15);
      w.visible = k > 0 && k < 1;
      w.scale.setScalar(0.3 + 1.6 * k);
      w.material.opacity = 1 - k;
      if (i > 0) w.visible &&= this.ghosts[i - 1].group.visible;
    });

    // ---- Arcs -------------------------------------------------------------
    const base = ramp(t, 210.8, 211.8);
    this.userToEdge.show(0.5 * base);
    this.user2ToEdge.show(0.5 * fadeWindow(t, 260, 271.5, 0.4));
    const warm = fadeWindow(t, 350, 356.4, 0.5);
    this.edgeToOrigin.show(lerp(0.3 * base, 0.95, warm) * (t >= 362.5 && t < 369 ? 0.35 : 1));
    this.edgeToOrigin.setColor(warm > 0 ? COLORS.healthy : COLORS.network);
    this.nearToOrigin.show(0.7 * fadeWindow(t, 362.8, 369.3, 0.4));

    // ---- Packets ----------------------------------------------------------
    const p = this.pool;
    p.begin();
    const out = { color: COLORS.network };
    const back = { color: COLORS.healthy, reverse: true };
    const fromOrigin = { color: COLORS.storage, reverse: true };
    const u = this.userToEdge.curve;
    const o = this.edgeToOrigin.curve;

    // HIT (Berlin).
    p.travel(u, t, 218.0, 1.6, out);
    p.travel(u, t, 221.6, 1.6, back);
    p.stream(u, t, 226.4, 236, 1.6, 0.6, out);
    p.stream(u, t, 227.2, 236.8, 1.6, 0.6, back);

    // MISS (Tokyo).
    p.travel(u, t, 239.0, 1.8, out);
    p.travel(o, t, 244.6, 4.2, out);
    p.travel(o, t, 249.4, 1.8, fromOrigin);
    p.travel(u, t, 255.6, 1.8, back);
    p.travel(this.user2ToEdge.curve, t, 261.0, 1.5, out);
    p.travel(this.user2ToEdge.curve, t, 263.2, 1.5, back);

    // Fresh copies served while the timer runs.
    for (const s of [288, 290.3, 292.6]) {
      p.travel(u, t, s, 0.6, out);
      p.travel(u, t, s + 0.8, 0.6, back);
    }
    // Revalidation: small request, tiny 304.
    p.travel(o, t, 295.6, 3.8, { color: COLORS.network, size: 0.09 });
    p.travel(o, t, 302.6, 3.6, { color: COLORS.healthy, size: 0.07, reverse: true });
    // Changed: request, then 200 + new file (the cube itself travels).
    p.travel(o, t, 310.6, 1.7, { color: COLORS.network, size: 0.09 });

    // Bypass (private data): all the way through.
    p.travel(u, t, 338.0, 1.5, out);
    p.travel(o, t, 340.0, 3.6, out);
    p.travel(o, t, 344.2, 3.6, fromOrigin);
    p.travel(u, t, 348.2, 1.5, { ...back, color: COLORS.storage });
    p.stream(u, t, 351.0, 355.6, 1.5, 0.5, out);
    p.stream(o, t, 351.5, 356.1, 1.5, 1.4, out);
    p.stream(o, t, 352.9, 357.5, 1.5, 1.4, fromOrigin);

    // Rare file: misses.
    p.travel(u, t, 357.4, 1.0, out);
    p.travel(o, t, 358.6, 2.6, { ...out, color: COLORS.warning });

    // Near the origin: short trip either way.
    p.stream(this.nearToOrigin.curve, t, 363.5, 368.5, 1.0, 0.5, out);
    p.stream(this.nearToOrigin.curve, t, 364.0, 369.0, 1.0, 0.5, back);

    // Slow backend: fast network, slow database.
    p.travel(u, t, 369.8, 0.9, out);
    p.travel(o, t, 370.8, 1.4, out);
    p.travel(o, t, 374.8, 1.4, fromOrigin);
    p.travel(u, t, 376.3, 0.9, { ...back, color: COLORS.storage });
    p.end();
  }

  drawOverlay(hud: Hud, t: number) {
    const L = this.labels;
    const tokyo = t >= 237 && t < 330;
    const limits = t >= 330;
    const city = (name: string) => (limits ? '' : ` · ${name}`);

    const show = fadeWindow(t, 210.8, 389.6, 0.4) * (1 - fadeWindow(t, 236.6, 237.4, 0.2));
    L.user.draw(hud, show, { text: limits ? 'You' : tokyo ? 'User · Tokyo' : 'You · Berlin' });
    L.edge.draw(hud, show, { text: `Edge${city(tokyo ? 'Tokyo' : 'Frankfurt')}` });
    let originSub: string | undefined;
    if (t >= 224 && t < 236.6) originSub = 'not involved';
    if (t >= 350 && t < 356.4) originSub = 'still does the work';
    if (t >= 370 && t < 377) originSub = 'database: 2 s';
    L.origin.draw(hud, show, { text: limits ? 'Origin' : 'Origin · Virginia', sub: originSub });
    L.user2.draw(hud, fadeWindow(t, 259.8, 271.5, 0.4));
    L.userNear.draw(hud, fadeWindow(t, 362.6, 369.5, 0.4), { sub: 'already close' });

    // Cache rack title + file names.
    const rackLabel = POS.edge.clone().setY(SLOT_Y + 0.9).setX(POS.edge.x - 2.3);
    hud.label(rackLabel, 'Cache', { alpha: fadeWindow(t, 211, 362, 0.4), size: 22, accent: CSS.edge, offsetY: 0 });
    const names = ['logo.png', 'style.css', t >= 323.4 ? 'app.v1.js' : 'app.js'];
    this.shelf.forEach((_, i) => {
      hud.label(slotPosition(i), names[i], {
        alpha: fadeWindow(t, 211.4 + i * 0.35, 356.8, 0.4),
        mono: true,
        size: 18,
        below: true,
        offsetY: 8,
      });
    });
    hud.label(slotPosition(3), t >= 315 ? 'hero.jpg v2' : 'hero.jpg', {
      alpha: fadeWindow(t, 255, 319.2, 0.4),
      mono: true,
      size: 18,
      below: true,
      offsetY: 8,
    });
    hud.label(slotPosition(3), 'app.v2.js', { alpha: fadeWindow(t, 324.2, 356.8, 0.4), mono: true, size: 18, below: true, offsetY: 8, accent: CSS.network });
    hud.label(POS.origin.clone().add(new THREE.Vector3(-0.2, 1.9, 0.9)), 'hero.jpg v2', {
      alpha: fadeWindow(t, 309.5, 312.6, 0.3),
      mono: true,
      size: 18,
      offsetY: 30,
      accent: CSS.network,
    });

    hud.label(GHOST_EDGES[1].clone().setY(1.6), 'other edges', { alpha: fadeWindow(t, 316.8, 329.2, 0.4), size: 20, accent: CSS.edge });

    // Requests.
    const userLabel = (text: string, start: number, end: number) =>
      L.user.draw(hud, fadeWindow(t, start, end, 0.3), { text, mono: true, size: 22, offsetY: 110, accent: CSS.network });
    userLabel('GET /logo.png', 217.4, 221.6);
    userLabel('GET /hero.jpg', 238.4, 242.6);
    userLabel('GET /cart', 337.4, 341.4);
    userLabel('GET /report-2019.pdf', 356.9, 361.6);
    L.user2.draw(hud, fadeWindow(t, 260.6, 263.4, 0.3), { text: 'GET /hero.jpg', mono: true, size: 20, offsetY: 110, accent: CSS.network, below: false });

    // Status stamps above the cache rack.
    const stampAt = POS.edge.clone().setY(SLOT_Y + 1.3);
    hud.badge(stampAt, 'HIT', CSS.healthy, fadeWindow(t, 220.0, 229.5, 0.3), 1, 40);
    hud.badge(stampAt, 'HIT', CSS.healthy, fadeWindow(t, 262.8, 266.4, 0.3), 1, 40);
    hud.badge(stampAt, 'MISS', CSS.warning, fadeWindow(t, 241.2, 250.5, 0.3), 1, 40);
    hud.badge(stampAt, 'BYPASS', CSS.warning, fadeWindow(t, 339.4, 349.6, 0.3), 1, 40);
    hud.badge(stampAt, 'MISS', CSS.warning, fadeWindow(t, 358.2, 361.8, 0.3), 1, 40);
    hud.badge(stampAt, 'PURGE', CSS.failure, fadeWindow(t, 318.2, 322.6, 0.3), 1, 40);

    // Long-haul label on the edge ↔ origin path.
    const mid = this.edgeToOrigin.curve.getPointAt(0.5);
    hud.label(mid, 'long trip to the origin', { alpha: fadeWindow(t, 244.6, 252, 0.4), size: 22, offsetY: 16 });
    hud.label(mid, 'If-None-Match: "a1b2c3"', { alpha: fadeWindow(t, 295.6, 301.8, 0.3), size: 22, mono: true, offsetY: 16, accent: CSS.network });
    hud.label(mid, '304 Not Modified', { alpha: fadeWindow(t, 302.6, 308.8, 0.3), size: 24, mono: true, offsetY: 16, accent: CSS.healthy });
    hud.label(mid, '200 OK · new file', { alpha: fadeWindow(t, 312.2, 315.8, 0.3), size: 24, mono: true, offsetY: 16, accent: CSS.network });
    hud.label(mid, 'connection kept warm', { alpha: fadeWindow(t, 350.4, 356.2, 0.4), size: 22, offsetY: 16, accent: CSS.healthy });

    // TTL countdown next to the ring.
    let remaining = 1;
    if (t >= 287) remaining = 1 - progress(t, 287, 294);
    const ringLabelAt = slotPosition(3).add(new THREE.Vector3(0.95, 0.25, 0));
    const expired = t >= 294 && t < 306.5;
    hud.label(ringLabelAt, expired ? 'expired' : `expires in ${formatCountdown(remaining)}`, {
      alpha: fadeWindow(t, 280.4, 306.4, 0.4),
      mono: true,
      size: 20,
      offsetY: 0,
      accent: expired ? CSS.failure : CSS.healthy,
    });

    // Slow backend progress above the origin.
    const dbAlpha = fadeWindow(t, 371.6, 376.6, 0.3);
    if (dbAlpha > 0) {
      const pt = hud.project(POS.origin.clone().setY(2.4));
      const fill = progress(t, 372.3, 374.7);
      hud.roundRect(pt.x - 130, pt.y - 140, 260, 64, 14, CSS.panel, CSS.warning, dbAlpha, 2);
      hud.text(`DB query ${(fill * 2).toFixed(1)} s`, pt.x, pt.y - 122, { size: 20, weight: 700, mono: true, align: 'center', alpha: dbAlpha });
      hud.roundRect(pt.x - 110, pt.y - 102, 220, 12, 6, 'rgba(148,163,184,0.25)', undefined, dbAlpha);
      hud.roundRect(pt.x - 110, pt.y - 102, Math.max(12, 220 * fill), 12, 6, CSS.warning, undefined, dbAlpha);
    }
  }

  dispose() {
    this.pool.dispose();
    for (const n of this.nodes) n.dispose();
    for (const a of this.arcs) a.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
