import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { KeyField, stackSlot } from '../../components/KeyField.ts';
import { Label3D } from '../../components/Label3D.ts';
import { Mascot, poseCheer, poseIdle, poseSurprised } from '../../components/Mascot.ts';
import { createDatabase, createLoadBalancer, createOriginServer, type NodeMesh } from '../../components/NodeMesh.ts';
import { drawCounter, drawMeter } from '../../components/Overlays.ts';
import { PacketPool, type EmitOptions } from '../../components/PacketPool.ts';
import { drawShardBars } from '../../components/ShardBars.ts';
import { customerShard, route } from '../../components/ShardSim.ts';
import { clamp, easeInOut, fadeWindow, lerp, progress, pulse, ramp, within } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { B } from './beats.ts';
import { BLOCKS, CUSTOMER_7, HOT_CUSTOMER, KEYS, KEYS_PER_BLOCK, REHASH, loadsAt, phases } from './traffic.ts';

const NODE_SCALE = 1.9;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const POS = {
  servers: [V(-10.5, 0, -2.6), V(-10.5, 0, 0), V(-10.5, 0, 2.6)],
  router: V(-6.0, 0, 0),
  /** Episode 5's cluster, in the hook. */
  primary: V(-0.6, 0, 0),
  replicas: [V(4.0, 0, -2.8), V(4.0, 0, 2.8), V(7.2, 0, 0)],
  /** Shards 1–4, and the fifth added in section 5. */
  shards: [V(-2.2, 0, 0), V(1.4, 0, 0), V(5.0, 0, 0), V(8.6, 0, 0), V(12.2, 0, 0)],
};

/** One colour per shard (shades of storage purple and blue, so green/yellow/red keep their meaning). */
export const SHARD_COLORS = [0xa78bfa, 0x60a5fa, 0xc084fc, 0x818cf8, 0xf0abfc];
const SHARD_CSS = ['#a78bfa', '#60a5fa', '#c084fc', '#818cf8', '#f0abfc'];
const DATE_RANGES = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];

const life = (t: number, inAt: number, outAt = Infinity, dur = 0.5) =>
  outAt === Infinity ? progress(t, inAt, inAt + dur) : Math.min(progress(t, inAt, inAt + dur), 1 - progress(t, outAt, outAt + dur));
const at = (p: THREE.Vector3, y = 0.7) => p.clone().setY(y);

/** When key k leaves for its new shard in section 5 (moved keys only), staggered over ~4.5 s. */
const moveStart = (k: number) => B.thousand + 1.2 + (((k * 7) % BLOCKS) / BLOCKS) * 4.5;
const MOVE_DUR = 1.3;
/** Key blocks over each shard: one neat column (5 blocks of 50 keys). */
const STACK = { perRing: 1, radius: 0, baseY: 2.05, layer: 0.42 };
/** How far shard labels rise to clear a key stack (in the shard's local units). */
const LABEL_LIFT = 1.3;

/** Every visual beat of the episode. */
export class ShardingStage {
  readonly group = new THREE.Group();
  private readonly pool = new PacketPool(320, 0.085);
  private readonly keys = new KeyField(BLOCKS, 0.62, true);
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly arcs: ArcPath[] = [];

  private readonly servers = POS.servers.map(() => createOriginServer(false));
  private readonly router = createLoadBalancer();
  private readonly primary = createDatabase();
  private readonly replicas = POS.replicas.map(() => createDatabase());
  private readonly shards = POS.shards.map((_, i) => createDatabase(SHARD_COLORS[i]));
  private readonly mascot = new Mascot();
  private readonly nodes: NodeMesh[];

  private readonly serverToPrimary: ArcPath[];
  private readonly serverToReplica: ArcPath[];
  private readonly repl: ArcPath[];
  private readonly serverToRouter: ArcPath[];
  private readonly routerToShard: ArcPath[];
  /** Section 5: the balancer moving a chunk from shard 1 to shard 5. */
  private readonly chunkMove: ArcPath;

  private readonly phases = phases();
  private readonly labels: { servers: Label3D[]; router: Label3D; primary: Label3D; replicas: Label3D[]; shards: Label3D[] };

  constructor() {
    const floorGeo = new THREE.CircleGeometry(90, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    const grid = new THREE.GridHelper(180, 180, COLORS.oceanGrid, COLORS.oceanGrid);
    this.group.add(floor, grid, this.pool.group, this.keys.mesh, this.mascot.group);
    this.disposables.push(floorGeo, floorMat, grid.geometry, grid.material as THREE.Material);

    const place = (node: NodeMesh, pos: THREE.Vector3, scale = NODE_SCALE) => {
      node.group.position.copy(pos);
      node.setBaseScale(scale);
      this.group.add(node.group);
      return node;
    };
    this.servers.forEach((s, i) => place(s, POS.servers[i]));
    place(this.router, POS.router, NODE_SCALE * 1.1);
    place(this.primary, POS.primary, NODE_SCALE * 1.4);
    this.replicas.forEach((r, i) => place(r, POS.replicas[i], NODE_SCALE * 1.2));
    this.shards.forEach((s, i) => place(s, POS.shards[i], NODE_SCALE * 1.2));
    this.mascot.shadowVisible = false;
    this.nodes = [...this.servers, this.router, this.primary, ...this.replicas, ...this.shards];

    const arc = (from: THREE.Vector3, to: THREE.Vector3, height: number, radius = 0.03) => {
      const a = new ArcPath(from, to, { height, radius });
      this.group.add(a.mesh);
      this.arcs.push(a);
      return a;
    };
    this.serverToPrimary = POS.servers.map((s) => arc(at(s, 0.6), at(POS.primary, 0.9), 1.2));
    this.serverToReplica = POS.servers.map((s, i) => arc(at(s, 0.6), at(POS.replicas[i % 2], 0.8), 2.4));
    this.repl = POS.replicas.map((r) => arc(at(POS.primary, 0.6), at(r, 0.6), 0.35, 0.045));
    this.serverToRouter = POS.servers.map((s) => arc(at(s, 0.6), at(POS.router, 0.6), 0.6));
    this.routerToShard = POS.shards.map((s) => arc(at(POS.router, 0.7), at(s, 0.9), 1.0 + Math.abs(s.x - POS.router.x) * 0.12));
    this.chunkMove = arc(at(POS.shards[0], 1.2), at(POS.shards[4], 1.2), 3.2, 0.04);

    this.labels = {
      servers: this.servers.map((s, i) => new Label3D(s.top, `App server ${i + 1}`, { size: 20 })),
      router: new Label3D(this.router.top, 'Router', { size: 24, accent: CSS.network }),
      primary: new Label3D(this.primary.top, '★ Primary', { size: 24, accent: CSS.warning }),
      replicas: this.replicas.map((r, i) => new Label3D(r.top, `Replica ${i + 1}`, { size: 22, accent: CSS.storage })),
      shards: this.shards.map((s, i) => new Label3D(s.top, `Shard ${i + 1}`, { size: 26, accent: SHARD_CSS[i] })),
    };
  }

  // ---- Timing helpers -------------------------------------------------------

  /** Hook cluster visible (episode 5's primary and replicas). */
  private hookAlpha(t: number) {
    return life(t, 0.4, B.splits + 0.6, 0.6);
  }

  /** Shards 1–4 slide out of the old database; shard 5 joins in section 5. */
  private shardAppear(i: number, t: number) {
    if (i < 4) return life(t, B.splits + 0.4 + i * 0.15, Infinity, 0.6);
    return life(t, B.fifth + 0.8, Infinity, 0.7);
  }

  private shardPos(i: number, t: number) {
    if (i === 4) return POS.shards[4].clone().setX(lerp(POS.shards[4].x + 3, POS.shards[4].x, ramp(t, B.fifth + 0.8, B.fifth + 2.0)));
    const k = ramp(t, B.splits + 0.4 + i * 0.15, B.splits + 1.8 + i * 0.15);
    return POS.primary.clone().lerp(POS.shards[i], k);
  }

  private load(t: number) {
    return loadsAt(this.phases, t);
  }

  /** Which shard is overloaded right now (load ≥ 1), if any. */
  private hotShard(t: number) {
    const { loads } = this.load(t);
    const i = loads.findIndex((l) => l >= 1);
    return t >= B.s2 && t < B.s5 ? i : -1;
  }

  // ---- Update ---------------------------------------------------------------

  update(t: number) {
    this.servers.forEach((s, i) => {
      s.setAppear(life(t, 0.3 + i * 0.1));
      s.setStatus(COLORS.healthy, 1.6);
    });
    this.router.setAppear(life(t, B.writesSplit + 0.2));
    this.router.setStatus(COLORS.network, 2.0);

    // Hook: the episode 5 cluster, its primary straining under every write.
    const hook = this.hookAlpha(t);
    const strain = ramp(t, B.friday + 1, B.onePrimary + 5);
    this.primary.setAppear(hook);
    this.primary.setStatus(strain > 0.75 ? COLORS.failure : strain > 0.45 ? COLORS.warning : COLORS.healthy, 1.4 + 1.2 * strain * pulse(t, 0.7));
    this.replicas.forEach((r, i) => {
      const a = i < 2 ? hook : life(t, B.fix + 0.4, B.splits + 0.6, 0.6);
      r.setAppear(a);
      r.group.position.copy(i < 2 ? POS.replicas[i] : POS.replicas[2].clone().setX(lerp(POS.replicas[2].x + 2.5, POS.replicas[2].x, ramp(t, B.fix + 0.4, B.fix + 1.6))));
      const full = ramp(t, B.disks + 0.8, B.disks + 4.5);
      r.setStatus(full > 0.7 ? COLORS.failure : COLORS.healthy, 1.8);
    });

    // Shards: colour by shard; red when overloaded; scale pulse when hot.
    const hot = this.hotShard(t);
    this.shards.forEach((s, i) => {
      s.setAppear(this.shardAppear(i, t));
      s.group.position.copy(this.shardPos(i, t));
      s.setStatus(i === hot ? COLORS.failure : SHARD_COLORS[i], i === hot ? 1.6 + 1.4 * pulse(t, 0.5) : 1.8);
    });

    // ---- Arcs ---------------------------------------------------------------
    this.serverToPrimary.forEach((a) => {
      a.show(0.45 * hook);
      a.setColor(strain > 0.75 ? COLORS.failure : COLORS.network);
    });
    this.serverToReplica.forEach((a) => a.show(0.3 * life(t, B.onePrimary + 0.4, B.splits + 0.4)));
    this.repl.forEach((a, i) => {
      a.show(0.6 * (i < 2 ? hook : life(t, B.fix + 1.2, B.splits + 0.4)));
      a.setColor(COLORS.storage);
    });
    const front = life(t, B.writesSplit + 0.2);
    this.serverToRouter.forEach((a) => a.show(0.4 * front));
    this.routerToShard.forEach((a, i) => {
      a.show((i < 4 ? 0.35 * front : 0.35 * life(t, B.fifth + 1.6)) * (i < 4 ? 1 : 1));
      a.setColor(i === hot ? COLORS.failure : COLORS.network);
    });
    this.chunkMove.show(0.5 * fadeWindow(t, B.balancer + 0.6, B.recap - 0.2, 0.4));
    this.chunkMove.setColor(COLORS.storage);

    this.updatePackets(t);
    this.updateKeys(t);
    this.updateMascot(t);
  }

  private updatePackets(t: number) {
    const p = this.pool;
    p.begin();
    const blue: EmitOptions = { color: COLORS.network };
    const write: EmitOptions = { color: COLORS.storage, size: 0.09 };
    const query: EmitOptions = { color: COLORS.warning, size: 0.1 };
    const answer: EmitOptions = { color: COLORS.healthy, size: 0.09, reverse: true };

    // Hook: every write piles into one primary; reads go to replicas.
    for (let s = 0; s < 3; s++) {
      const period = lerp(0.9, 0.32, ramp(t, B.friday, B.onePrimary + 4));
      p.stream(this.serverToPrimary[s].curve, t, 0.8 + s * 0.2, B.splits, period, 0.55, write);
      p.stream(this.serverToReplica[s].curve, t, B.onePrimary + 0.8 + s * 0.3, B.splits, 1.1, 0.7, blue);
    }
    for (let r = 0; r < 3; r++) p.stream(this.repl[r].curve, t, (r < 2 ? 1.2 : B.fix + 1.6) + r * 0.3, B.splits, 0.7, 1.4, write);

    // Sections 1, 2, 4: every simulated write, server → router → its shard.
    for (const phase of this.phases) {
      if (t < phase.start - 1 || t > phase.end + 2) continue;
      for (const w of phase.writes) {
        if (w.at > t || w.at < t - 2) continue;
        const shard = route(w, phase.key);
        p.travel(this.serverToRouter[w.orderId % 3].curve, t, w.at - 0.5, 0.5, write);
        const color = phase.key === 'customer' && w.customer === HOT_CUSTOMER ? COLORS.failure : COLORS.storage;
        p.travel(this.routerToShard[shard].curve, t, w.at, 0.7, { ...write, color });
      }
    }

    // Section 2: "all of customer 7's orders" under the hash key asks every shard; under the customer key, one.
    const fan = (start: number, shards: number[], dur = 0.8, back = (i: number) => dur) => {
      for (const i of shards) {
        p.travel(this.routerToShard[i].curve, t, start, dur, query);
        p.travel(this.routerToShard[i].curve, t, start + dur + 0.15, back(i), answer);
      }
    };
    for (let n = 0; n < 2; n++) fan(B.balanced + 2.6 + n * 2.6, [0, 1, 2, 3]);
    for (let n = 0; n < 2; n++) fan(B.customer + 4.0 + n * 2.6, [customerShard(CUSTOMER_7, 4)]);

    // Section 3: scatter-gather; answers come back at different speeds, the last one sets the total.
    const slow = [0.8, 1.0, 2.2, 0.9];
    for (let n = 0; n < 2; n++) fan(B.topProducts + 1.2 + n * 3.6, [0, 1, 2, 3], 0.8, (i) => slow[i]);
    // A change that touches two customers on shards 1 and 4.
    p.travel(this.routerToShard[0].curve, t, B.figma + 0.4, 0.8, write);
    p.travel(this.routerToShard[3].curve, t, B.figma + 0.4, 0.8, write);

    // Section 4: after the split, reading the seller's orders asks all four pieces.
    for (let n = 0; n < 2; n++) fan(B.suffixCost + 0.8 + n * 2.6, [0, 1, 2, 3]);

    // Section 5: the balancer moves a chunk in the background.
    for (let n = 0; n < 3; n++) p.travel(this.chunkMove.curve, t, B.balancer + 1.2 + n * 2.4, 2.0, { color: COLORS.storage, size: 0.2 });
    p.end();
  }

  /** Keys: one big stack in the old database, split across shards in section 1; re-hashed in section 5. */
  private keysShown(t: number) {
    return clamp(life(t, B.splits + 0.2, B.three + 0.6, 0.6) + life(t, B.fifth + 1.4, Infinity, 0.6));
  }

  private updateKeys(t: number) {
    const shown = this.keysShown(t);
    this.keys.setOpacity(clamp(shown));
    if (shown <= 0.01) return;
    const before = REHASH.before;
    const after = REHASH.after;
    // Index of each key within its shard's stack (stable).
    const slotBefore = new Array<number>(BLOCKS);
    const slotAfter = new Array<number>(BLOCKS);
    const nB = [0, 0, 0, 0, 0];
    const nA = [0, 0, 0, 0, 0];
    for (let k = 0; k < BLOCKS; k++) {
      slotBefore[k] = nB[before[k]]++;
      slotAfter[k] = nA[after[k]]++;
    }
    const inSection5 = t >= B.fifth;
    const tmp = new THREE.Vector3();
    for (let k = 0; k < BLOCKS; k++) {
      const home = stackSlot(this.shardPos(before[k], t), slotBefore[k], STACK);
      let pos = home;
      let color: number = SHARD_COLORS[before[k]];
      if (!inSection5) {
        // Fly from one big stack over the old database to the key's shard.
        const big = stackSlot(POS.primary, k, { perRing: 4, radius: 0.55, baseY: 2.2, layer: 0.42 });
        const go = ramp(t, B.slice - 0.2 + k * 0.06, B.slice + 1.4 + k * 0.06);
        pos = tmp.copy(big).lerp(home, go).clone();
        pos.y += Math.sin(go * Math.PI) * 1.6;
        if (go < 0.01) color = 0xcbd5e1;
      } else if (REHASH.moved[k]) {
        const s = moveStart(k);
        const go = easeInOut(progress(t, s, s + MOVE_DUR));
        const dest = stackSlot(POS.shards[after[k]], slotAfter[k], STACK);
        pos = home.clone().lerp(dest, go);
        pos.y += Math.sin(go * Math.PI) * 2.2;
        color = go <= 0 ? SHARD_COLORS[before[k]] : go < 1 ? COLORS.warning : SHARD_COLORS[after[k]];
      }
      this.keys.place(k, pos, color, 1);
    }
    this.keys.commit();
  }

  /** The mascot is order 1042 (customer 7): routed to shard 3, then moved when shard 5 is added. */
  private updateMascot(t: number) {
    const m = this.mascot;
    let pos: THREE.Vector3 | null = null;
    let opacity = 1;
    let pose = poseIdle(t);
    const top = (p: THREE.Vector3, y = 1.55) => p.clone().setY(y);
    const shard3 = customerShard(CUSTOMER_7, 4);

    if (within(t, B.order + 0.2, B.three)) {
      const a = B.order + 1.4;
      pos = top(POS.servers[1], 1.4);
      if (t >= a) pos = this.serverToRouter[1].curve.getPointAt(ramp(t, a, a + 1.2)).add(V(0, 0.25, 0));
      if (t >= a + 1.2) pos = top(POS.router, 1.5);
      if (t >= a + 2.4) pos = this.routerToShard[shard3].curve.getPointAt(ramp(t, a + 2.4, a + 4.0)).add(V(0, 0.25, 0));
      if (t >= a + 4.0) pos = top(POS.shards[shard3], 1.5);
      if (within(t, a + 4.0, a + 6.0)) pose = poseCheer(t);
      opacity = life(t, B.order + 0.2, B.three - 0.5, 0.4);
    }
    // Section 5: order 1042's key moves to the new shard.
    if (within(t, B.fifth + 1.4, B.logical)) {
      const s = B.thousand + 3.2;
      // In front of the shards, so the key columns don't hide it.
      const front = (i: number) => top(POS.shards[i], 1.1).add(V(0, 0, 1.4));
      pos = front(shard3).lerp(front(4), easeInOut(progress(t, s, s + MOVE_DUR + 0.4)));
      pos.y += Math.sin(easeInOut(progress(t, s, s + MOVE_DUR + 0.4)) * Math.PI) * 2.0;
      if (within(t, s, s + MOVE_DUR + 0.6)) pose = poseSurprised(t);
      opacity = life(t, B.fifth + 1.4, B.logical - 0.5, 0.4);
    }

    m.group.visible = pos !== null && opacity > 0.02;
    if (!m.group.visible || !pos) return;
    m.group.position.copy(pos);
    m.group.scale.setScalar(0.6);
    m.group.rotation.set(0, 0.3, 0);
    m.setOpacity(clamp(opacity));
    m.apply(pose, t);
  }

  // ---- Overlay --------------------------------------------------------------

  drawOverlay(hud: Hud, t: number) {
    const L = this.labels;
    L.servers.forEach((label, i) => label.draw(hud, fadeWindow(t, 0.8 + i * 0.15, B.s2, 0.3)));
    L.router.draw(hud, life(t, B.router - 0.2, B.recap), {
      sub: within(t, B.router, B.order) ? 'reads the shard key' : within(t, B.hash, B.customer) ? 'hash(order ID) % 4' : undefined,
    });

    const hook = this.hookAlpha(t);
    L.primary.draw(hud, hook, { sub: within(t, B.onePrimary, B.splits) ? 'every write' : undefined, accent: t > B.onePrimary + 4 ? CSS.failure : CSS.warning });
    L.replicas.forEach((label, i) => label.draw(hud, i < 2 ? hook : life(t, B.fix + 1.0, B.splits + 0.4), { sub: i === 2 ? 'full copy' : undefined }));

    L.shards.forEach((label, i) => {
      let sub: string | undefined;
      if (within(t, B.date, B.hash)) sub = i < 4 ? DATE_RANGES[i] : undefined;
      if (within(t, B.suffix + 1.4, B.s5)) sub = i < 4 ? `seller ${HOT_CUSTOMER}#${((i - customerShard(HOT_CUSTOMER, 4) + 4) % 4) + 1}` : undefined;
      if (i === 4 && within(t, B.fifth, B.thousand)) sub = 'new';
      const a = i < 4 ? life(t, B.splits + 1.4 + i * 0.15, B.next) : life(t, B.fifth + 1.6, B.next);
      label.draw(hud, a, { sub, accent: i === this.hotShard(t) ? CSS.failure : SHARD_CSS[i], offset: [0, LABEL_LIFT * this.keysShown(t), 0] });
    });

    this.drawHook(hud, t);
    this.drawSectionOne(hud, t);
    this.drawSectionTwo(hud, t);
    this.drawSectionThree(hud, t);
    this.drawSectionFour(hud, t);
    this.drawSectionFive(hud, t);
  }

  private drawHook(hud: Hud, t: number) {
    const a = fadeWindow(t, B.friday + 1.0, B.splits, 0.4);
    const writes = ramp(t, B.friday + 1, B.onePrimary + 5);
    drawMeter(hud, POS.primary.clone().setY(2.4), 0.2 + 0.8 * writes, a, { label: 'writes', offsetY: 110, width: 160 });
    const disk = 0.35 + 0.62 * ramp(t, B.disks + 0.8, B.disks + 4.5);
    const diskA = fadeWindow(t, B.disks + 0.4, B.splits, 0.4);
    drawMeter(hud, POS.primary.clone().setY(0), disk, diskA, { label: 'disk', offsetY: -70, width: 140 });
    for (let i = 0; i < 2; i++) drawMeter(hud, POS.replicas[i].clone().setY(0), disk, diskA, { label: 'disk', offsetY: -70, width: 120 });
    drawMeter(hud, POS.replicas[2].clone().setY(0), disk, fadeWindow(t, B.fix + 1.2, B.splits, 0.4), { label: 'disk', offsetY: -70, width: 120 });
    hud.badge(POS.replicas[2].clone().setY(1.2), '✗ still full', CSS.failure, fadeWindow(t, B.fix + 2.0, B.fix + 4.6, 0.3), 0.55, 120);
    hud.label(POS.primary.clone().setY(0), 'Black Friday · shop.example', { alpha: fadeWindow(t, B.friday + 0.4, B.onePrimary + 1, 0.4), size: 22, accent: CSS.warning, below: true, offsetY: 120 });
  }

  /** Section 1: replicas vs shards, side by side. */
  private drawSectionOne(hud: Hud, t: number) {
    const a = fadeWindow(t, B.compare + 0.3, B.writesSplit, 0.4);
    if (a <= 0.001) return;
    // Bottom, right of the presenter: the shards' key stacks fill the top half here.
    const x0 = 300;
    const y0 = 720;
    const w = 520;
    hud.roundRect(x0, y0, w, 300, 20, CSS.panel, CSS.panelBorder, a);
    const col = (x: number, title: string, sub: string, stacks: string[][]) => {
      hud.text(title, x + 115, y0 + 40, { size: 26, weight: 800, align: 'center', alpha: a });
      hud.text(sub, x + 115, y0 + 72, { size: 18, color: CSS.muted, align: 'center', alpha: a });
      stacks.forEach((rows, s) => {
        const sx = x + 20 + s * (200 / stacks.length);
        rows.forEach((c, r) => hud.roundRect(sx, y0 + 250 - r * 26, 200 / stacks.length - 12, 20, 5, c, undefined, a));
      });
    };
    const all = ['#a78bfa', '#60a5fa', '#c084fc', '#818cf8', '#a78bfa', '#60a5fa'];
    col(x0 + 20, 'Replicas', 'same data on each', [all, all, all]);
    col(x0 + 270, 'Shards', 'a different slice each', SHARD_CSS.slice(0, 4).map((c) => [c, c, c]));
  }

  private drawSectionTwo(hud: Hud, t: number) {
    // Per-shard write bars (sections 1–4).
    const { loads, rates } = this.load(t);
    // Hidden while the router and order 1042 are introduced.
    const barsA = fadeWindow(t, B.writesSplit + 1.2, B.router, 0.5) + fadeWindow(t, B.three, B.s5, 0.5);
    const anchors = POS.shards.slice(0, 4).map((p) => p.clone().setY(0));
    drawShardBars(hud, anchors, loads, rates, barsA, { offsetY: -185, height: 100 });
    hud.text('writes per shard (example)', hud.project(POS.shards[1].clone().lerp(POS.shards[2], 0.5)).x, hud.project(POS.shards[1].clone().setY(0)).y + 235, {
      size: 18,
      color: CSS.muted,
      align: 'center',
      alpha: barsA,
    });

    // The three tries.
    const tries = fadeWindow(t, B.three + 0.2, B.goodKey + 0.4, 0.4);
    if (tries > 0.001) {
      const items = [
        { label: '1 · order date', at: B.date, ok: false },
        { label: '2 · hash(order ID)', at: B.hash, ok: null },
        { label: '3 · customer ID', at: B.customer, ok: true },
      ];
      hud.roundRect(60, 150, 400, 210, 20, CSS.panel, CSS.panelBorder, tries);
      hud.text('Shard key: three tries', 84, 188, { size: 24, weight: 800, alpha: tries });
      items.forEach((it, i) => {
        const active = t >= it.at;
        const verdict = t >= it.at + 4 ? (it.ok === true ? '✓' : it.ok === false ? '✗ hot shard' : '~ fan-out reads') : '';
        const color = !active ? CSS.muted : it.ok === true ? CSS.healthy : it.ok === false ? CSS.failure : CSS.warning;
        hud.text(it.label, 84, 238 + i * 44, { size: 22, weight: active ? 700 : 500, color: active ? CSS.text : CSS.muted, alpha: tries });
        hud.text(verdict, 436, 238 + i * 44, { size: 20, weight: 800, color, align: 'right', alpha: tries });
      });
    }
    hud.badge(POS.shards[3].clone().setY(1.4), 'ALL WRITES', CSS.failure, fadeWindow(t, B.today + 2.5, B.hash, 0.3), 0.6, 140);
    hud.label(POS.router.clone().setY(0), "customer 7's orders?", {
      alpha: fadeWindow(t, B.balanced + 2.2, B.customer + 9.0, 0.3),
      size: 20,
      accent: CSS.warning,
      sub: t < B.customer ? 'asks all 4 shards' : 'asks shard 3 only',
      below: true,
      offsetY: 60,
    });

    // A good shard key: three properties.
    const good = fadeWindow(t, B.goodKey + 0.2, B.s3, 0.4);
    if (good > 0.001) {
      const props = ['many different values', 'used about evenly', 'not always increasing'];
      hud.roundRect(60, 150, 400, 200, 20, CSS.panel, CSS.healthy, good);
      hud.text('A good shard key', 84, 188, { size: 24, weight: 800, alpha: good });
      props.forEach((s, i) => {
        const tick = fadeWindow(t, B.goodKey + 1.0 + i * 1.6, B.s3, 0.3);
        hud.text(`✓ ${s}`, 84, 236 + i * 40, { size: 22, weight: 600, color: CSS.healthy, alpha: good * tick });
      });
    }
  }

  private drawSectionThree(hud: Hud, t: number) {
    const a = fadeWindow(t, B.topProducts + 0.8, B.txHarder, 0.3);
    hud.label(POS.router.clone().setY(0), 'top products today', { alpha: a, size: 20, accent: CSS.warning, sub: 'asks every shard, merges', below: true, offsetY: 60 });
    hud.label(POS.shards[2].clone().setY(0), 'slowest shard sets the total', { alpha: fadeWindow(t, B.scatter + 0.6, B.txHarder, 0.3), size: 20, accent: CSS.warning, below: true, offsetY: 260 });
    // Two customers on two shards, one change: one side commits, the other fails.
    const tx = fadeWindow(t, B.figma + 1.2, B.s4 - 0.3, 0.3);
    hud.badge(POS.shards[0].clone().setY(1.4), '✓ saved', CSS.healthy, tx, 0.55, 140);
    hud.badge(POS.shards[3].clone().setY(1.4), '✗ failed', CSS.failure, tx, 0.55, 140);
    hud.label(POS.shards[1].clone().lerp(POS.shards[2], 0.5).setY(0), 'one change, two shards', { alpha: fadeWindow(t, B.txHarder + 0.4, B.s4 - 0.3, 0.3), size: 22, accent: CSS.failure, below: true, offsetY: 260 });
  }

  private drawSectionFour(hud: Hud, t: number) {
    const hotIdx = customerShard(HOT_CUSTOMER, 4);
    const seller = POS.shards[hotIdx].clone().setY(0);
    hud.label(seller, `big seller · customer ${HOT_CUSTOMER}`, { alpha: fadeWindow(t, B.huge + 2.0, B.suffix + 1.6, 0.3), size: 20, accent: CSS.failure, sub: 'flash sale', below: true, offsetY: 290 });
    const errors = Math.floor(Math.max(0, t - (B.red + 0.6)) * 3.1);
    drawCounter(hud, POS.shards[hotIdx].clone().setY(2.6), `failed writes: ${errors}`, fadeWindow(t, B.red + 0.6, B.suffix + 1.6, 0.3), CSS.failure, 40);
  }

  private drawSectionFive(hud: Hud, t: number) {
    // Formula card.
    const f = fadeWindow(t, B.modulo + 0.2, B.logical, 0.4);
    if (f > 0.001) {
      const n = t >= B.fourToFive + 1.0 ? '5' : '4';
      // Bottom left, right of the presenter: shard 1's key column fills the top left here.
      hud.roundRect(300, 690, 440, 96, 20, CSS.panel, CSS.panelBorder, f);
      hud.text(`shard = hash(key) % ${n}`, 520, 738, { size: 30, weight: 800, mono: true, align: 'center', color: n === '5' ? CSS.warning : CSS.text, alpha: f });
    }
    // Moved-keys counter, computed from ShardSim.
    let moved = 0;
    for (let k = 0; k < BLOCKS; k++) if (REHASH.moved[k] && t >= moveStart(k)) moved += KEYS_PER_BLOCK;
    const cA = fadeWindow(t, B.thousand + 0.8, B.logical, 0.3);
    if (cA > 0.001) {
      hud.roundRect(300, 802, 440, 70, 20, CSS.panel, moved > 0 ? CSS.warning : CSS.panelBorder, cA);
      hud.text(`moved: ${moved} / ${KEYS.toLocaleString('en-US')} keys`, 520, 838, { size: 26, weight: 800, mono: true, align: 'center', color: moved > 0 ? CSS.warning : CSS.text, alpha: cA });
      hud.text(`1 block = ${KEYS_PER_BLOCK} keys`, 520, 896, { size: 20, weight: 600, color: CSS.muted, align: 'center', alpha: cA });
    }
    hud.badge(POS.shards[2].clone().setY(1.4), `${Math.round((REHASH.count / BLOCKS) * 100)}% MOVED`, CSS.warning, fadeWindow(t, B.onTheMove + 0.2, B.logical, 0.3), 0.7, 220);

    this.drawLogical(hud, t);
  }

  /**
   * Logical shards, shown small enough to read: 12 shards on 4 machines; two
   * machines join and one whole shard from each old machine moves over.
   * Notion's real numbers (480 on 32) are in the text.
   */
  private drawLogical(hud: Hud, t: number) {
    const a = fadeWindow(t, B.logical + 0.4, B.balancer + 0.4, 0.5);
    if (a <= 0.001) return;
    hud.fade(0.82 * a);
    const grow = ramp(t, B.notion480 + 5.5, B.notion480 + 8.5);
    const newHosts = clamp((t - (B.notion480 + 4.8)) / 0.6);
    const W = 240;
    const H = 170;
    const gap = 40;
    const x0 = 960 - (6 * W + 5 * gap) / 2;
    const y0 = 270;
    const hostX = (h: number) => x0 + h * (W + gap);
    const title = t < B.notion480 ? 'Many small shards, several per machine' : 'Notion: 480 logical shards on 32 databases';
    hud.text(title, 960, y0 - 60, { size: 34, weight: 800, align: 'center', alpha: a });
    for (let h = 0; h < 6; h++) {
      const isNew = h >= 4;
      const alpha = a * (isNew ? newHosts : 1);
      hud.roundRect(hostX(h), y0, W, H, 18, 'rgba(10,18,32,0.95)', isNew ? CSS.healthy : CSS.panelBorder, alpha, 2.5);
      hud.text(isNew ? 'new machine' : `machine ${h + 1}`, hostX(h) + W / 2, y0 + H + 30, { size: 20, weight: 600, color: isNew ? CSS.healthy : CSS.muted, align: 'center', alpha });
    }
    // Tile i lives on machine floor(i / 3); the last tile of each old machine moves to a new one.
    const tile = 60;
    const slot = (h: number, j: number) => [hostX(h) + 22 + j * (tile + 14), y0 + (H - tile) / 2] as const;
    for (let i = 0; i < 12; i++) {
      const h = Math.floor(i / 3);
      const j = i % 3;
      const moves = j === 2;
      const [bx, by] = slot(h, j);
      const [ax, ay] = moves ? slot(4 + Math.floor(h / 2), h % 2) : [bx, by];
      const k = moves ? easeInOut(clamp(grow * 1.6 - (h / 4) * 0.6)) : 0;
      const x = lerp(bx, ax, k);
      const y = lerp(by, ay, k) - Math.sin(k * Math.PI) * 70;
      const flying = k > 0 && k < 1;
      hud.roundRect(x, y, tile, tile, 10, flying ? CSS.warning : SHARD_CSS[i % 4], undefined, a);
      hud.text(`S${i + 1}`, x + tile / 2, y + tile / 2 + 1, { size: 22, weight: 800, color: '#0b1026', align: 'center', alpha: a });
    }
    const sub = fadeWindow(t, B.divides + 0.2, B.balancer + 0.4, 0.3);
    const note = fadeWindow(t, B.notion480 + 5.5, B.balancer + 0.4, 0.3);
    hud.text('whole shards move · no key changes its shard', 960, y0 + H + 100, { size: 28, weight: 700, align: 'center', color: CSS.text, alpha: a * note * (1 - sub) });
    hud.text('480 = 32 × 15 = 40 × 12 = 48 × 10', 960, y0 + H + 100, { size: 34, weight: 800, mono: true, align: 'center', color: CSS.healthy, alpha: a * sub });
  }

  dispose() {
    this.pool.dispose();
    this.keys.dispose();
    this.mascot.dispose();
    for (const n of this.nodes) n.dispose();
    for (const a of this.arcs) a.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
