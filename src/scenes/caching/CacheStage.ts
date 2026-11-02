import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { CacheEvent } from '../../components/CacheSim.ts';
import type { Hud } from '../../components/Hud.ts';
import { KeySlots, type SlotState } from '../../components/KeySlots.ts';
import { Label3D } from '../../components/Label3D.ts';
import { Mascot, poseCheer, poseIdle, poseSurprised } from '../../components/Mascot.ts';
import {
  createCacheNode,
  createDatabase,
  createEdgeServer,
  createFileCube,
  createLoadBalancer,
  createOriginServer,
  createUser,
  type NodeMesh,
} from '../../components/NodeMesh.ts';
import { drawCounter, drawMeter } from '../../components/Overlays.ts';
import { PacketPool, type EmitOptions } from '../../components/PacketPool.ts';
import { RequestQueue } from '../../components/RequestQueue.ts';
import { clamp, easeInOut, fadeWindow, progress, pulse, ramp } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { B } from './beats.ts';
import { COALESCE_EXPIRE, DB_CAPACITY, GHOST, HOT, RESTART_AT, STAMPEDE_EXPIRE, allFlows, type Flow } from './traffic.ts';

const NODE_SCALE = 1.9;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const POS = {
  users: [V(-11.5, 0, -2.4), V(-11.5, 0, 0), V(-11.5, 0, 2.4)],
  lb: V(-8.6, 0, 0),
  servers: [V(-5.4, 0, -2.4), V(-5.4, 0, 0), V(-5.4, 0, 2.4)],
  cache: V(-1.9, 0, 2.5),
  /** Key slots tray right of the cache; slot 0 is product:42 (the mascot stands on it). */
  slots: V(-0.5, 0, 2.6),
  db: V(2.6, 0, -0.4),
  edge: V(-11.5, 0, 4.8),
  /** A new key waiting to get in (eviction beat). */
  incoming: V(0.7, 1.9, 2.6),
};

const SLOT_COUNT = 5;
/** Keys in the slots during sections 3–4 (slot 0 is always product:42). */
const SLOT_KEYS = [HOT, 'product:7', 'product:13', 'product:99', 'product:5'];
/** Illustrative prices, labelled "example" on screen. */
const OLD_PRICE = '€49';
const NEW_PRICE = '€39';
const CARD: [number, number] = [60, 120];

const life = (t: number, inAt: number, outAt = Infinity, dur = 0.5) =>
  outAt === Infinity ? progress(t, inAt, inAt + dur) : Math.min(progress(t, inAt, inAt + dur), 1 - progress(t, outAt, outAt + dur));
const at = (p: THREE.Vector3, y = 0.7) => p.clone().setY(y);
const within = (t: number, a: number, b: number) => t >= a && t < b;
const mix = (a: number, b: number, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(k));

/** Every visual beat of the episode. */
export class CacheStage {
  readonly group = new THREE.Group();
  private readonly pool = new PacketPool(280, 0.09);
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly arcs: ArcPath[] = [];

  private readonly users = POS.users.map(() => createUser());
  private readonly lb = createLoadBalancer();
  private readonly servers = POS.servers.map(() => createOriginServer(false));
  private readonly cache = createCacheNode();
  private readonly db = createDatabase();
  private readonly edge = createEdgeServer();
  private readonly incoming = createFileCube(COLORS.storage);
  private readonly slots = new KeySlots(SLOT_COUNT);
  private readonly waiting = new RequestQueue(16, V(-1, 0, 0), 0.22);
  private readonly mascot = new Mascot();
  private readonly nodes: NodeMesh[];

  private readonly userToLb: ArcPath[];
  private readonly lbToServer: ArcPath[];
  private readonly serverToCache: ArcPath[];
  private readonly serverToDb: ArcPath[];

  private readonly flows = allFlows();
  private readonly labels: { lb: Label3D; servers: Label3D[]; cache: Label3D; db: Label3D; edge: Label3D };

  constructor() {
    const floorGeo = new THREE.CircleGeometry(80, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    const grid = new THREE.GridHelper(160, 160, COLORS.oceanGrid, COLORS.oceanGrid);
    this.group.add(floor, grid, this.pool.group, this.slots.group, this.waiting.group, this.mascot.group);
    this.disposables.push(floorGeo, floorMat, grid.geometry, grid.material as THREE.Material, this.slots, this.waiting);

    const place = (node: NodeMesh, pos: THREE.Vector3, scale = NODE_SCALE) => {
      node.group.position.copy(pos);
      node.setBaseScale(scale);
      this.group.add(node.group);
      return node;
    };
    this.users.forEach((u, i) => place(u, POS.users[i]));
    place(this.lb, POS.lb, NODE_SCALE * 1.1);
    this.servers.forEach((s, i) => place(s, POS.servers[i]));
    place(this.cache, POS.cache, NODE_SCALE * 0.95);
    place(this.db, POS.db, NODE_SCALE * 1.5);
    place(this.edge, POS.edge, NODE_SCALE * 0.75);
    place(this.incoming, POS.incoming, 1.6);
    this.slots.group.position.copy(POS.slots);
    this.waiting.group.position.copy(POS.cache).add(V(-1.4, 0.3, -0.9));
    this.mascot.shadowVisible = false;
    this.nodes = [...this.users, this.lb, ...this.servers, this.cache, this.db, this.edge, this.incoming];

    const arc = (from: THREE.Vector3, to: THREE.Vector3, height: number, radius = 0.03) => {
      const a = new ArcPath(from, to, { height, radius });
      this.group.add(a.mesh);
      this.arcs.push(a);
      return a;
    };
    this.userToLb = POS.users.map((u) => arc(at(POS.users[POS.users.indexOf(u)], 0.5), at(POS.lb, 0.5), 0.5));
    this.lbToServer = POS.servers.map((s) => arc(at(POS.lb, 0.5), at(s, 0.6), 0.6));
    this.serverToCache = POS.servers.map((s) => arc(at(s, 0.6), at(POS.cache, 0.6), 0.7));
    this.serverToDb = POS.servers.map((s) => arc(at(s, 0.6), at(POS.db, 0.9), 1.6));

    this.labels = {
      lb: new Label3D(this.lb.top, 'Load balancer', { size: 22, accent: CSS.network }),
      servers: this.servers.map((s, i) => new Label3D(s.top, `App server ${i + 1}`, { size: 20, offset: [0, 0, 0] })),
      cache: new Label3D(this.cache.top, 'Cache', { size: 26, accent: CSS.storage }),
      db: new Label3D(this.db.top, 'Database', { size: 26, accent: CSS.storage }),
      edge: new Label3D(this.edge.top, 'CDN edge', { size: 22, accent: CSS.edge }),
    };
  }

  // ---- Timing helpers -------------------------------------------------------

  private activeFlow(t: number): Flow | undefined {
    return Object.values(this.flows).find((f) => t >= f.start - 1.2 && t < f.end + 1.5);
  }

  /** The scripted first request of section 2: check → miss → database → store. */
  private firstMiss() {
    return {
      check: B.checks + 0.4,
      missBack: B.miss + 0.4,
      dbOut: B.fill + 0.4,
      dbBack: B.fill + 1.6,
      store: B.fill + 2.7,
      stored: B.fill + 3.4,
    };
  }

  /** Section 3: the TTL of product:42 runs out here and the fresh price is loaded. */
  private ttlOut() {
    return B.expires + 0.4;
  }
  private reloaded() {
    return this.ttlOut() + 2.2;
  }

  /** Stampede: product:42 disappears at its expiry and comes back with the first answer. */
  private hotGap(flow: Flow, expireAt: number): [number, number] {
    const first = flow.sim.events.find((e) => e.key === HOT && e.outcome === 'miss' && e.at >= expireAt);
    return [expireAt, first ? first.doneAt : expireAt];
  }

  /** Cold start: share of catalogue keys loaded again since the restart (0..1). */
  private warmth(t: number) {
    const f = this.flows.cold;
    if (t < RESTART_AT()) return 1;
    const loaded = new Set(f.sim.events.filter((e) => e.outcome === 'miss' && e.doneAt <= t && e.at >= RESTART_AT()).map((e) => e.key));
    return loaded.size / 40;
  }

  private dbLoad(t: number) {
    const flow = this.activeFlow(t);
    let reads = flow ? flow.sim.dbReadsAt(t) : 0;
    // Scripted single reads (section 2 first miss, section 3 reloads and writes).
    const f = this.firstMiss();
    if (within(t, f.dbOut, f.dbBack + 0.8)) reads += 1;
    if (within(t, this.ttlOut() + 0.6, this.reloaded())) reads += 1;
    return reads / DB_CAPACITY;
  }

  private slotsCenter() {
    this.slots.group.updateMatrixWorld(true);
    return this.slots.slotPosition(2);
  }

  /** Database is down at the end of trap 3 (serving stale data). */
  private dbDownFrom() {
    return B.coldPlan + 3.2;
  }

  // ---- Update ---------------------------------------------------------------

  update(t: number) {
    this.users.forEach((u, i) => u.setAppear(life(t, 0.2 + i * 0.1)));
    this.lb.setAppear(life(t, 0.4));
    this.servers.forEach((s, i) => s.setAppear(life(t, 0.5 + i * 0.1)));
    this.db.setAppear(life(t, 0.8));

    // Cache: appears in section 2; blinks off and on in the cold-start trap.
    let cacheAppear = life(t, B.cacheIs + 0.2, Infinity, 0.6);
    if (within(t, RESTART_AT() - 0.6, RESTART_AT() + 0.6)) cacheAppear = Math.abs(t - RESTART_AT()) / 0.6;
    this.cache.setAppear(cacheAppear);
    this.cache.setStatus(within(t, RESTART_AT() - 0.6, RESTART_AT() + 2) ? COLORS.failure : COLORS.storage, 2.2);

    const load = this.dbLoad(t);
    if (t >= this.dbDownFrom() && t < B.recap) this.db.setStatus(COLORS.failure, 0.5 + 2 * pulse(t, 0.7));
    else this.db.setStatus(load > 1 ? mix(COLORS.warning, COLORS.failure, pulse(t, 0.5)) : load > 0.6 ? COLORS.warning : COLORS.healthy, 2.2);
    this.servers.forEach((s) => s.setStatus(COLORS.healthy, 1.6));

    this.edge.setAppear(life(t, B.cdn + 0.3, B.s3 - 0.2));
    this.updateIncoming(t);

    // ---- Arcs ---------------------------------------------------------------
    const front = life(t, 0.5);
    this.userToLb.forEach((a) => a.show(0.4 * front));
    this.lbToServer.forEach((a) => a.show(0.4 * front));
    this.serverToCache.forEach((a) => a.show(0.45 * life(t, B.cacheIs + 0.6, Infinity, 0.6)));
    this.serverToDb.forEach((a) => a.show(0.4 * life(t, 0.8)));
    this.serverToDb.forEach((a) => a.setColor(load > 1 ? COLORS.failure : COLORS.network));

    this.updateSlots(t);
    this.updateWaiting(t);
    this.updatePackets(t);
    this.updateMascot(t);
  }

  /** New keys knocking on a full cache (section 4). */
  private updateIncoming(t: number) {
    const k77 = life(t, B.full + 0.3, B.lru + 3.0, 0.4);
    const k88 = life(t, B.sample + 0.4, B.sample + 3.6, 0.4);
    this.incoming.setAppear(Math.max(k77, k88));
    const bounced = within(t, B.noEvict + 0.4, B.policy + 0.2);
    this.incoming.setStatus(bounced ? COLORS.failure : COLORS.storage, bounced ? 0.6 + 2 * pulse(t, 0.6) : 1.2);
    const p = POS.incoming.clone();
    // 77 drops into slot 3 when LRU evicts product:99; 88 into slot 2 after sampling.
    const drop = (from: number, slot: number) => {
      const k = ramp(t, from, from + 0.7);
      if (k <= 0) return;
      this.slots.group.updateMatrixWorld(true);
      p.lerp(this.slots.slotPosition(slot).setY(0.15), k);
    };
    if (t < B.sample) drop(B.lru + 2.4, 3);
    else drop(B.sample + 2.8, 2);
    if (bounced) p.y += 0.25 * Math.abs(Math.sin((t - B.noEvict) * 6)) * (1 - progress(t, B.noEvict + 0.4, B.noEvict + 2));
    this.incoming.group.position.copy(p);
  }

  private slotKey(t: number, i: number) {
    if (i === 3 && t >= B.lru + 3.0) return 'product:77';
    if (i === 2 && t >= B.sample + 3.4) return 'product:88';
    return SLOT_KEYS[i];
  }

  private updateSlots(t: number) {
    const tray = life(t, B.vendors + 0.4, B.recap - 0.4);
    const f = this.firstMiss();
    this.slots.update(tray, (i): SlotState => {
      // Slot 0: product:42, the mascot's slot.
      if (i === 0) {
        let fill = progress(t, f.stored - 0.3, f.stored);
        let color: THREE.ColorRepresentation = COLORS.storage;
        if (within(t, B.priceDrop + 0.8, this.ttlOut())) color = COLORS.warning;
        if (within(t, this.ttlOut(), this.reloaded())) fill = 1 - progress(t, this.ttlOut(), this.ttlOut() + 0.4);
        if (within(t, B.deleteKey + 1.2, B.deleteKey + 3.4)) fill = 1 - progress(t, B.deleteKey + 1.2, B.deleteKey + 1.6);
        for (const [flow, exp] of [[this.flows.stampede, STAMPEDE_EXPIRE()], [this.flows.coalesced, COALESCE_EXPIRE()]] as const) {
          const [a, b] = this.hotGap(flow, exp);
          if (within(t, a, b + 0.3)) fill = 1 - progress(t, a, a + 0.3) + progress(t, b, b + 0.3);
        }
        if (t >= RESTART_AT()) fill = Math.min(fill, this.warmth(t) > 0.1 ? 1 : 0);
        return { fill, color };
      }
      // Slot 4 doubles as the ghost key in trap 2.
      if (i === 4 && within(t, B.p404 + 0.2, B.depend)) {
        const cached = t >= B.negative + 1.2 + 0.9;
        return { fill: 1, color: cached ? COLORS.serverDark : COLORS.failure, ghost: !cached, glow: cached ? 0.5 : 1 };
      }
      // Slots 1-4: other products, filled during "never stale / never read" and kept for section 4.
      const fillIn = B.neverStale + 0.6 + i * 0.25;
      let fill = progress(t, fillIn, fillIn + 0.4);
      if (i === 3) fill = Math.min(fill, 1 - progress(t, B.lru + 2.0, B.lru + 2.4)) + progress(t, B.lru + 2.9, B.lru + 3.1);
      if (i === 2) fill = Math.min(fill, 1 - progress(t, B.sample + 2.4, B.sample + 2.8)) + progress(t, B.sample + 3.3, B.sample + 3.5);
      if (t >= RESTART_AT()) fill = this.warmth(t) > (i + 1) / 6 ? 1 : 0;
      // Recency: never-read keys dim during write-through; in section 4 product:99 is least recently used.
      let glow = within(t, B.neverStale, B.s4) ? 0.25 : 1;
      if (within(t, B.lru, B.lru + 2.4) && i === 3) glow = 0.12 + 0.1 * pulse(t, 0.8);
      if (within(t, B.lru, B.lru + 2.4) && i !== 3) glow = 0.6 + 0.4 * (i === 1 ? 1 : 0.6);
      return { fill, glow, color: COLORS.storage };
    });
  }

  /** Requests waiting for the one coalesced read. */
  private updateWaiting(t: number) {
    const f = this.flows.coalesced;
    const n = f.sim.events.filter((e) => e.outcome === 'wait' && e.at <= t && t < e.doneAt).length;
    this.waiting.setLength(n, COLORS.network);
    this.waiting.group.visible = n > 0.01;
  }

  private updatePackets(t: number) {
    const p = this.pool;
    p.begin();
    const blue: EmitOptions = { color: COLORS.network };
    const green: EmitOptions = { color: COLORS.healthy, reverse: true };
    const red: EmitOptions = { color: COLORS.failure, reverse: true };
    const purple: EmitOptions = { color: COLORS.storage, size: 0.11 };
    const grey: EmitOptions = { color: COLORS.serverDark, reverse: true };

    const flow = this.activeFlow(t);
    if (flow) {
      for (const e of flow.sim.events) {
        if (t < e.at - 1.2 || t > e.doneAt + 1.0) continue;
        this.request(t, e, flow === this.flows.noCache);
      }
    }

    // Section 2: the scripted first miss (slow motion).
    const f = this.firstMiss();
    p.travel(this.userToLb[1].curve, t, B.checks - 1.4, 0.6, { ...blue, size: 0.12 });
    p.travel(this.lbToServer[1].curve, t, B.checks - 0.8, 0.6, { ...blue, size: 0.12 });
    p.travel(this.serverToCache[1].curve, t, f.check, 0.9, { ...blue, size: 0.13 });
    p.travel(this.serverToCache[1].curve, t, f.missBack, 0.9, { ...red, size: 0.13 });
    p.travel(this.serverToDb[1].curve, t, f.dbOut, 1.0, { ...blue, size: 0.13 });
    p.travel(this.serverToDb[1].curve, t, f.dbBack, 1.0, { ...green, size: 0.13 });
    p.travel(this.serverToCache[1].curve, t, f.store, 0.8, { ...purple, size: 0.14 });

    // Section 3: a few hits on the old price, the price update, the reload, delete-on-write, write-through.
    p.stream(this.serverToCache[0].curve, t, B.priceDrop, this.ttlOut() - 0.6, 1.3, 0.5, blue);
    p.stream(this.serverToCache[0].curve, t, B.priceDrop + 0.5, this.ttlOut() - 0.1, 1.3, 0.5, { ...green, color: COLORS.warning });
    p.travel(this.serverToDb[2].curve, t, B.priceDrop + 0.4, 0.8, purple);
    p.travel(this.serverToCache[1].curve, t, this.ttlOut() + 0.2, 0.4, blue);
    p.travel(this.serverToCache[1].curve, t, this.ttlOut() + 0.6, 0.4, red);
    p.travel(this.serverToDb[1].curve, t, this.ttlOut() + 0.9, 0.6, blue);
    p.travel(this.serverToDb[1].curve, t, this.ttlOut() + 1.5, 0.6, green);
    p.travel(this.serverToCache[1].curve, t, this.ttlOut() + 2.1, 0.5, purple);
    // Delete on write: update the database, then delete the key.
    p.travel(this.serverToDb[2].curve, t, B.deleteKey + 0.2, 0.7, purple);
    p.travel(this.serverToCache[2].curve, t, B.deleteKey + 0.8, 0.5, { color: COLORS.failure, size: 0.12 });
    // Write-through: both at once.
    p.travel(this.serverToDb[2].curve, t, B.writeThrough + 0.8, 0.8, purple);
    p.travel(this.serverToCache[2].curve, t, B.writeThrough + 0.8, 0.6, purple);
    for (let i = 1; i < 5; i++) p.travel(this.serverToCache[i % 3].curve, t, B.neverStale + 0.2 + i * 0.25, 0.5, purple);

    // Section 4: reads still work while writes are rejected.
    p.stream(this.serverToCache[0].curve, t, B.noEvict + 2, B.policy, 0.7, 0.45, blue);
    p.stream(this.serverToCache[0].curve, t, B.noEvict + 2.45, B.policy + 0.45, 0.7, 0.45, green);
    p.end();
  }

  /** One simulated request: user → LB → server → cache (→ database → cache). */
  private request(t: number, e: CacheEvent, noCache: boolean) {
    const p = this.pool;
    const s = e.server;
    const u = (s * 2 + 1) % 3;
    p.travel(this.userToLb[u].curve, t, e.at - 1.0, 0.45, { color: COLORS.network, size: 0.07 });
    p.travel(this.lbToServer[s].curve, t, e.at - 0.55, 0.45, { color: COLORS.network, size: 0.07 });
    const dbDown = t >= this.dbDownFrom();
    if (noCache) {
      p.travel(this.serverToDb[s].curve, t, e.at, 0.4, { color: COLORS.network });
      p.travel(this.serverToDb[s].curve, t, e.doneAt - 0.4, 0.4, { color: COLORS.healthy, reverse: true });
      return;
    }
    p.travel(this.serverToCache[s].curve, t, e.at - 0.1, 0.3, { color: COLORS.network });
    if (e.outcome === 'hit') {
      p.travel(this.serverToCache[s].curve, t, e.at + 0.2, 0.3, { color: COLORS.healthy, reverse: true });
      return;
    }
    if (e.outcome === 'wait') {
      p.travel(this.serverToCache[s].curve, t, e.doneAt, 0.3, { color: COLORS.healthy, reverse: true });
      return;
    }
    // Miss: back empty-handed, then the database, then store the answer.
    p.travel(this.serverToCache[s].curve, t, e.at + 0.2, 0.25, { color: COLORS.failure, reverse: true });
    if (dbDown) return;
    p.travel(this.serverToDb[s].curve, t, e.at + 0.2, 0.35, { color: COLORS.network });
    p.travel(this.serverToDb[s].curve, t, e.doneAt - 0.35, 0.35, e.notFound ? { color: COLORS.serverDark, reverse: true } : { color: COLORS.healthy, reverse: true });
    p.travel(this.serverToCache[s].curve, t, e.doneAt, 0.3, { color: e.notFound ? COLORS.serverDark : COLORS.storage, size: 0.1 });
  }

  /** The mascot is the cached copy of product 42: stored, stale, expired, reloaded. */
  private updateMascot(t: number) {
    const m = this.mascot;
    const f = this.firstMiss();
    this.slots.group.updateMatrixWorld(true);
    const home = this.slots.slotPosition(0).setY(0.28);

    let appear = Math.min(progress(t, f.stored - 0.2, f.stored + 0.3), 1 - progress(t, B.recap - 0.6, B.recap - 0.2));
    let opacity = 1;
    let pose = poseIdle(t);
    // Section 3: fades when the TTL runs out, back with the fresh price; gone after delete-on-write until the next read.
    if (within(t, this.ttlOut(), this.reloaded() + 0.4)) {
      opacity = 1 - progress(t, this.ttlOut(), this.ttlOut() + 0.4) + progress(t, this.reloaded() - 0.3, this.reloaded());
    }
    if (within(t, B.deleteKey + 1.2, B.deleteKey + 3.4)) opacity = 1 - progress(t, B.deleteKey + 1.2, B.deleteKey + 1.6) + progress(t, B.deleteKey + 3.0, B.deleteKey + 3.4);
    if (within(t, B.priceDrop + 0.8, this.ttlOut())) pose = poseSurprised(t);
    if (within(t, this.reloaded(), this.reloaded() + 2.4)) pose = poseCheer(t);
    // Stampede and coalescing gaps.
    for (const [flow, exp] of [[this.flows.stampede, STAMPEDE_EXPIRE()], [this.flows.coalesced, COALESCE_EXPIRE()]] as const) {
      const [a, b] = this.hotGap(flow, exp);
      if (within(t, a, b + 0.4)) opacity = Math.min(opacity, 1 - progress(t, a, a + 0.3) + progress(t, b, b + 0.4));
    }
    // Cold start: gone with the restart, back once product:42 is loaded again.
    if (t >= RESTART_AT() - 0.3) {
      const back = this.flows.cold.sim.events.find((e) => e.key === HOT && e.outcome === 'miss' && e.at >= RESTART_AT());
      const backAt = back ? back.doneAt : Infinity;
      opacity = Math.min(opacity, 1 - progress(t, RESTART_AT() - 0.3, RESTART_AT()) + progress(t, backAt, backAt + 0.4));
    }
    appear *= this.cache.group.visible ? 1 : 0;
    m.group.visible = appear > 0.001 && opacity > 0.02;
    if (!m.group.visible) return;
    m.group.position.copy(home);
    m.group.scale.setScalar(0.44 * Math.max(0.001, appear));
    m.group.rotation.set(0, 0.35, 0);
    m.setOpacity(clamp(opacity));
    m.apply(pose, t);
  }

  // ---- Overlay --------------------------------------------------------------

  drawOverlay(hud: Hud, t: number) {
    const L = this.labels;
    L.lb.draw(hud, fadeWindow(t, 0.8, B.s2, 0.4), { sub: within(t, B.lbAgo, B.share + 2) ? 'from episode 2' : undefined });
    L.servers.forEach((label, i) => label.draw(hud, fadeWindow(t, B.lbAgo + 0.4 + i * 0.15, B.s2, 0.3)));
    L.cache.draw(hud, life(t, B.cacheIs + 0.6, B.recap), { sub: within(t, B.vendors, B.aside) ? 'Redis · Memcached' : within(t, B.cacheIs, B.vendors) ? 'in memory' : undefined });
    L.db.draw(hud, life(t, 0.9, B.recap), {
      sub: within(t, B.share, B.asks + 2) ? 'one, shared by every server' : within(t, B.priceDrop + 0.6, B.untilTimer) ? `price ${NEW_PRICE} (example)` : t >= this.dbDownFrom() && t < B.recap ? 'down' : undefined,
      accent: t >= this.dbDownFrom() && t < B.recap ? CSS.failure : CSS.storage,
    });
    L.edge.draw(hud, life(t, B.cdn + 0.5, B.s3 - 0.3), { sub: 'a cache near users (episode 1)' });

    // Database load meter, whenever traffic flows.
    const meter = Math.max(fadeWindow(t, B.sale + 0.8, B.s2 + 1, 0.4), fadeWindow(t, B.ratio, B.cdn, 0.4), fadeWindow(t, B.hot, this.dbDownFrom(), 0.4));
    const load = this.dbLoad(t);
    drawMeter(hud, POS.db.clone().setY(2.4), load, meter, { label: load > 1 ? 'database: overloaded' : 'database load', offsetY: 80, width: 170 });

    this.drawHook(hud, t);
    this.drawSectionOne(hud, t);
    this.drawSectionTwo(hud, t);
    this.drawSectionThree(hud, t);
    this.drawSectionFour(hud, t);
    this.drawSectionFive(hud, t);
  }

  /** Browser-style product card. */
  private productCard(hud: Hud, [x, y]: [number, number], alpha: number, price: { text: string; color: string; spinner?: boolean }, t: number, note?: { text: string; color: string; alpha: number }) {
    if (alpha <= 0.001) return;
    const w = 400;
    hud.roundRect(x, y, w, note ? 230 : 160, 20, CSS.panel, CSS.panelBorder, alpha);
    hud.text('shop.example/product/42', x + 24, y + 30, { size: 18, mono: true, color: CSS.muted, alpha });
    hud.text('Sale item #42', x + 24, y + 72, { size: 28, weight: 700, alpha });
    hud.roundRect(x + 24, y + 98, w - 48, 42, 21, 'rgba(5,8,15,0.6)', price.color, alpha, 2);
    hud.text(price.text, x + (price.spinner ? 70 : w / 2), y + 120, { size: 22, weight: 700, color: price.color, align: price.spinner ? 'left' : 'center', alpha });
    if (price.spinner) {
      const { ctx } = hud;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = price.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const a0 = t * 7;
      ctx.arc(x + 50, y + 119, 11, a0, a0 + Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();
    }
    if (note && note.alpha > 0) {
      hud.roundRect(x + 24, y + 158, w - 48, 48, 12, 'rgba(5,8,15,0.6)', note.color, alpha * note.alpha, 2);
      hud.text(note.text, x + w / 2, y + 182, { size: 22, weight: 700, color: note.color, align: 'center', alpha: alpha * note.alpha });
    }
  }

  private drawHook(hud: Hud, t: number) {
    const a = fadeWindow(t, B.sale + 0.6, B.fix + 0.6, 0.4);
    const slow = t >= B.again + 0.6;
    this.productCard(hud, CARD, a, slow ? { text: 'Loading…', color: CSS.warning, spinner: true } : { text: `${OLD_PRICE} · SALE`, color: CSS.healthy }, t);
    hud.badge(POS.servers[1].clone().setY(1.4), 'SALE', CSS.warning, fadeWindow(t, B.sale + 0.8, B.same, 0.3), 0.8, 60);
  }

  private drawSectionOne(hud: Hud, t: number) {
    const db = POS.db.clone().setY(1.6);
    hud.label(POS.db.clone().setY(1.2).setX(POS.db.x - 1.6), 'SELECT … WHERE id = 42', {
      alpha: fadeWindow(t, B.asks + 0.6, B.thousands, 0.3),
      size: 20,
      mono: true,
      accent: CSS.network,
      offsetY: 50,
    });
    hud.badge(db.clone().setX(db.x + 1.9), `#42 · ${OLD_PRICE}`, CSS.muted, fadeWindow(t, B.sameAnswer + 0.6, B.fullWork + 0.5, 0.3), 0.55, 0);
    hud.badge(db.clone().setX(db.x + 1.9), 'SAME ANSWER', CSS.muted, fadeWindow(t, B.fullWork + 0.5, B.thousands, 0.3), 0.55, 0);
    const reads = this.flows.noCache.requests.filter((r) => r.at <= t && r.at >= B.sale).length;
    drawCounter(hud, POS.db.clone().add(V(2.5, 0.4, 0.4)), `queries: ${reads}`, fadeWindow(t, B.same + 0.4, B.cacheIs, 0.3) * (1 - fadeWindow(t, B.fix, B.s1 + 0.6, 0.3)), CSS.network, 0);
    hud.badge(POS.cache.clone().setY(1.0), '?', CSS.network, fadeWindow(t, B.remember + 0.4, B.cacheIs + 0.4, 0.3), 1.2, 40);
  }

  private drawSectionTwo(hud: Hud, t: number) {
    const f = this.firstMiss();
    const cacheTop = POS.cache.clone().setY(1.0);
    hud.badge(cacheTop, 'MISS', CSS.failure, fadeWindow(t, f.missBack, B.fill + 1.4, 0.2), 0.8, 60);
    hud.badge(cacheTop, 'HIT', CSS.healthy, fadeWindow(t, B.hit + 0.6, B.micro + 0.5, 0.2), 0.8, 60);
    // The three trips of a miss.
    const trips = fadeWindow(t, B.trips + 0.2, B.hit, 0.3);
    if (trips > 0) {
      const s = 1;
      const mid = (a: ArcPath) => a.curve.getPointAt(0.5);
      drawCounter(hud, mid(this.serverToCache[s]), '1 · cache', trips * ramp(t, B.trips + 0.3, B.trips + 0.7), CSS.failure, 30);
      drawCounter(hud, mid(this.serverToDb[s]), '2 · database', trips * ramp(t, B.trips + 1.3, B.trips + 1.7), CSS.network, 30);
      drawCounter(hud, mid(this.serverToCache[s]).add(V(0, -0.2, 0.6)), '3 · store', trips * ramp(t, B.trips + 2.3, B.trips + 2.7), CSS.storage, -40);
    }
    // Hit ratio, live from the simulation.
    const warm = this.flows.warm;
    const ratioAlpha = fadeWindow(t, B.ratio + 0.4, B.cdn + 0.6, 0.4);
    const ratio = warm.sim.hitRatioAt(t, B.hit);
    // The first miss counts too: 1 miss before the warm flow.
    const hits = warm.sim.events.filter((e) => e.at <= t).length;
    const shown = hits ? (hits * ratio) / (hits + 1) : 0;
    drawCounter(hud, this.slotsCenter().setY(1.9), `hit ratio: ${Math.round(shown * 100)}%`, ratioAlpha, CSS.healthy, 0);
  }

  private drawSectionThree(hud: Hud, t: number) {
    this.slots.group.updateMatrixWorld(true);
    const slot0 = this.slots.slotPosition(0);
    const stale = within(t, B.priceDrop + 0.8, this.ttlOut());
    const fresh = t >= this.reloaded() - 0.2;
    const keyAlpha = fadeWindow(t, this.firstMiss().stored, B.s4, 0.3) * (within(t, this.ttlOut() + 0.3, this.reloaded() - 0.2) ? 0 : 1);
    hud.label(slot0.clone().setY(1.05), `product:42 · ${fresh ? NEW_PRICE : OLD_PRICE}`, {
      alpha: keyAlpha * (t < B.s3 - 0.5 ? fadeWindow(t, this.firstMiss().stored, B.ratio, 0.3) : 1),
      size: 20,
      mono: true,
      accent: stale ? CSS.warning : fresh ? CSS.healthy : CSS.storage,
      sub: stale ? 'stale' : undefined,
      offsetY: 10,
    });

    // The shopper's view.
    const card = fadeWindow(t, B.wrong - 0.2, B.ttl + 0.4, 0.4);
    this.productCard(hud, CARD, card, { text: `${OLD_PRICE} · SALE`, color: CSS.warning }, t, { text: `database says ${NEW_PRICE}`, color: CSS.warning, alpha: ramp(t, B.wrong + 0.8, B.wrong + 1.3) });

    // TTL ring around the mascot.
    const ringAlpha = fadeWindow(t, B.ttl + 0.6, this.ttlOut() + 0.8, 0.3) + fadeWindow(t, B.untilTimer, B.deleteKey, 0.3);
    if (ringAlpha > 0) {
      const p = hud.project(slot0.clone().setY(0.55));
      const runStart = t < B.untilTimer ? B.ttl + 0.6 : B.untilTimer;
      const runEnd = t < B.untilTimer ? this.ttlOut() : B.deleteKey + 2;
      const left = 1 - progress(t, runStart, runEnd);
      const { ctx } = hud;
      ctx.save();
      ctx.globalAlpha = clamp(ringAlpha);
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = left > 0 ? CSS.warning : CSS.failure;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 66, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      ctx.stroke();
      ctx.restore();
      hud.text(left > 0 ? `TTL ${Math.ceil(left * 60)} s` : 'expired', p.x + 84, p.y - 8, { size: 24, weight: 800, mono: true, color: left > 0 ? CSS.warning : CSS.failure, alpha: clamp(ringAlpha) });
      hud.text('example TTL', p.x + 84, p.y + 20, { size: 16, color: CSS.muted, alpha: clamp(ringAlpha) });
    }
    const cacheTop = POS.cache.clone().setY(1.0);
    hud.badge(cacheTop, 'MISS → RELOAD', CSS.failure, fadeWindow(t, this.ttlOut() + 0.5, this.reloaded() + 0.3, 0.2), 0.6, 60);
    hud.badge(cacheTop, `✓ ${NEW_PRICE}`, CSS.healthy, fadeWindow(t, this.reloaded(), B.redisExpiry + 0.5, 0.3), 0.6, 60);

    // Delete on write / write-through.
    hud.label(this.serverToCache[2].curve.getPointAt(0.5), 'DEL product:42', { alpha: fadeWindow(t, B.deleteKey + 0.8, B.writeThrough, 0.3), size: 20, mono: true, accent: CSS.failure, offsetY: 30 });
    hud.label(this.serverToDb[2].curve.getPointAt(0.5), 'UPDATE price', { alpha: fadeWindow(t, B.deleteKey + 0.2, B.writeThrough, 0.3) + fadeWindow(t, B.priceDrop + 0.3, B.oldOne + 1, 0.3), size: 20, mono: true, accent: CSS.storage, offsetY: 30 });
    hud.label(this.serverToCache[2].curve.getPointAt(0.5), 'write cache + database', { alpha: fadeWindow(t, B.writeThrough + 0.8, B.neverStale, 0.3), size: 20, accent: CSS.storage, offsetY: 30 });
    hud.badge(this.slots.slotPosition(2).setY(0.6), 'NEVER READ', CSS.muted, fadeWindow(t, B.neverStale + 2.2, B.ttlEither, 0.3), 0.55, 40);
  }

  private drawSectionFour(hud: Hud, t: number) {
    this.slots.group.updateMatrixWorld(true);
    // Key names on the other slots.
    const names = fadeWindow(t, B.memory, B.s5, 0.3);
    for (let i = 1; i < SLOT_COUNT; i++) {
      const p = this.slots.slotPosition(i).setY(0.1);
      hud.text(this.slotKey(t, i).replace('product:', '#'), hud.project(p).x, hud.project(p).y + 40, { size: 18, mono: true, color: CSS.muted, align: 'center', alpha: names });
    }
    const mem = fadeWindow(t, B.memory + 0.2, B.s5, 0.4);
    const fullness = Math.min(1, 0.6 + 0.4 * ramp(t, B.memory + 0.4, B.memory + 2.2));
    drawMeter(hud, this.slotsCenter().setY(0), fullness, mem, { label: fullness >= 1 ? 'memory: 100% (maxmemory)' : 'memory', offsetY: -80, width: 170 });
    hud.label(POS.incoming.clone().setY(POS.incoming.y + 0.3), t < B.sample ? 'product:77' : 'product:88', { alpha: Math.max(fadeWindow(t, B.full + 0.5, B.lru + 2.6, 0.3), fadeWindow(t, B.sample + 0.6, B.sample + 2.9, 0.3)), size: 20, mono: true, accent: CSS.storage, offsetY: 30 });
    hud.badge(POS.incoming, '✗ OOM · write rejected', CSS.failure, fadeWindow(t, B.noEvict + 0.5, B.policy, 0.3), 0.55, 175);
    hud.badge(POS.cache.clone().setY(0.2).setZ(POS.cache.z + 1.2), 'reads still work ✓', CSS.healthy, fadeWindow(t, B.noEvict + 2.2, B.policy + 0.4, 0.3), 0.5, 0);
    hud.badge(this.slots.slotPosition(3).setY(0.6), 'LEAST RECENTLY USED', CSS.warning, fadeWindow(t, B.lru + 0.6, B.lru + 2.3, 0.3), 0.5, 10);
    // Sampling: three random slots get a ring; the oldest of them goes.
    const sampleAlpha = fadeWindow(t, B.sample + 0.6, B.sample + 2.6, 0.3);
    if (sampleAlpha > 0) {
      [1, 2, 4].forEach((i) => {
        const p = hud.project(this.slots.slotPosition(i).setY(0.2));
        hud.roundRect(p.x - 34, p.y - 30, 68, 60, 12, 'rgba(0,0,0,0)', i === 2 ? CSS.warning : CSS.network, sampleAlpha, 3);
      });
      hud.badge(this.slots.slotPosition(2).setY(0.6), 'oldest of the sample', CSS.warning, sampleAlpha * ramp(t, B.sample + 1.4, B.sample + 1.8), 0.45, 10);
    }
  }

  private drawSectionFive(hud: Hud, t: number) {
    this.slots.group.updateMatrixWorld(true);
    const slot0 = this.slots.slotPosition(0);
    // Trap 1: TTL ring running out on the hot key, the stampede, then coalescing.
    for (const [from, exp] of [[B.hot, STAMPEDE_EXPIRE()], [B.coalesce + 0.4, COALESCE_EXPIRE()]] as const) {
      const a = fadeWindow(t, from + 0.3, exp + 0.8, 0.3);
      if (a <= 0) continue;
      const p = hud.project(slot0.clone().setY(0.55));
      const left = 1 - progress(t, from + 0.3, exp);
      const { ctx } = hud;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineWidth = 7;
      ctx.strokeStyle = left > 0 ? CSS.warning : CSS.failure;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 66, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(left, 0.001));
      ctx.stroke();
      ctx.restore();
      hud.text(left > 0 ? 'TTL running out' : 'expired', p.x + 84, p.y, { size: 22, weight: 800, color: left > 0 ? CSS.warning : CSS.failure, alpha: a });
    }
    const reads = (f: Flow) => f.sim.dbReadsAt(t);
    drawCounter(hud, POS.db.clone().add(V(2.5, 0.4, 0.4)), `reads in flight: ${reads(this.flows.stampede)}`, fadeWindow(t, B.hot + 0.5, B.coalesce, 0.3), CSS.failure, 0);
    drawCounter(hud, POS.db.clone().add(V(2.5, 0.4, 0.4)), `reads in flight: ${reads(this.flows.coalesced)}`, fadeWindow(t, B.coalesce + 0.4, B.missing, 0.3), CSS.healthy, 0);
    hud.badge(POS.db.clone().setY(1.6), 'STAMPEDE', CSS.failure, fadeWindow(t, B.stampedeName + 0.2, B.coalesce, 0.3), 0.8, 60);
    hud.label(POS.cache.clone().add(V(-1.4, 0.6, -0.9)), 'waiting for one answer', { alpha: fadeWindow(t, COALESCE_EXPIRE() + 0.2, COALESCE_EXPIRE() + 2.6, 0.3), size: 20, accent: CSS.network, offsetY: 30 });

    // Trap 2: the ghost key.
    const slot4 = this.slots.slotPosition(4);
    const negOn = t >= B.negative + 1.2 + 0.9;
    hud.label(slot4.clone().setY(0.5), negOn ? 'product:404 → ∅ not found' : 'product:404 ?', {
      alpha: fadeWindow(t, B.p404 + 0.4, B.depend - 0.2, 0.3),
      size: 20,
      mono: true,
      accent: negOn ? CSS.muted : CSS.failure,
      sub: negOn ? 'negative cache · own short TTL' : 'never cached',
      offsetY: 30,
    });
    const ghostMisses = this.flows.ghost.sim.events.filter((e) => e.outcome === 'miss' && e.at <= t).length;
    drawCounter(hud, POS.db.clone().add(V(2.5, 0.4, 0.4)), `wasted reads: ${ghostMisses}`, fadeWindow(t, B.straight, B.depend - 0.2, 0.3), CSS.failure, 0);

    // Trap 3: cold start, then serving stale data while the database is down.
    hud.badge(POS.cache.clone().setY(1.0), 'RESTARTED · EMPTY', CSS.failure, fadeWindow(t, RESTART_AT() + 0.2, RESTART_AT() + 3.5, 0.3), 0.6, 110);
    const ttlPanel = fadeWindow(t, B.coldPlan + 2.2, B.recap - 0.2, 0.4);
    if (ttlPanel > 0) {
      const x = 360;
      const y = 130;
      const w = 800;
      hud.roundRect(x, y, w, 170, 20, CSS.panel, CSS.panelBorder, ttlPanel);
      hud.text('Database down: keep serving the cached copy', x + 30, y + 40, { size: 24, weight: 700, alpha: ttlPanel });
      const bx = x + 40;
      const bw = w - 80;
      const by = y + 100;
      hud.roundRect(bx, by - 6, bw, 12, 6, 'rgba(148,163,184,0.25)', undefined, ttlPanel);
      const mark = (k: number, text: string, color: string) => {
        hud.roundRect(bx + bw * k - 3, by - 18, 6, 36, 3, color, undefined, ttlPanel);
        hud.text(text, bx + bw * k, by + 40, { size: 18, weight: 700, color, align: 'center', alpha: ttlPanel });
      };
      mark(0.35, 'soft TTL: try to refresh', CSS.warning);
      mark(0.9, 'hard TTL: stop', CSS.failure);
      const cursor = 0.1 + 0.85 * progress(t, B.coldPlan + 2.6, B.recap - 0.6);
      hud.roundRect(bx, by - 6, bw * cursor, 12, 6, cursor < 0.9 ? CSS.healthy : CSS.failure, undefined, ttlPanel);
    }
  }

  dispose() {
    this.pool.dispose();
    this.mascot.dispose();
    for (const n of this.nodes) n.dispose();
    for (const a of this.arcs) a.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
