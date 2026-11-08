import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { Label3D } from '../../components/Label3D.ts';
import { Mascot, poseCheer, poseIdle, poseSurprised } from '../../components/Mascot.ts';
import { createCacheNode, createDatabase, createLoadBalancer, createOriginServer, createUser, type NodeMesh } from '../../components/NodeMesh.ts';
import { drawCounter, drawMeter } from '../../components/Overlays.ts';
import { PacketPool, type EmitOptions } from '../../components/PacketPool.ts';
import type { WriteEvent } from '../../components/ReplicationSim.ts';
import { clamp, fadeWindow, progress, pulse, ramp, within } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { B } from './beats.ts';
import { ASYNC_CRASH, LAG, SYNC_CRASH, SYNC_RT, allFlows, type WriteFlow } from './traffic.ts';

const NODE_SCALE = 1.9;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const POS = {
  users: [V(-12, 0, -2.4), V(-12, 0, 0), V(-12, 0, 2.4)],
  lb: V(-9.2, 0, 0),
  servers: [V(-6.2, 0, -2.4), V(-6.2, 0, 0), V(-6.2, 0, 2.4)],
  cache: V(-3.4, 0, 3.8),
  primary: V(0.6, 0, 0),
  /** Replica 1, replica 2, and the one added in section 2. */
  replicas: [V(5.6, 0, -2.6), V(5.6, 0, 2.6), V(7.0, 0, 0)],
  /** RDS Multi-AZ standby, "another availability zone". */
  standby: V(0.6, 0, -5.0),
  /** The failover tool (health check). */
  watcher: V(3.1, 0, 3.4),
};

/** Illustrative addresses, labelled "example" on screen. */
const OLD_ADDRESS = '12 Oak St';
const NEW_ADDRESS = '4 Elm Rd';
const OTHER_ADDRESS = '9 Pine Ave';
const CARD: [number, number] = [60, 140];

const life = (t: number, inAt: number, outAt = Infinity, dur = 0.5) =>
  outAt === Infinity ? progress(t, inAt, inAt + dur) : Math.min(progress(t, inAt, inAt + dur), 1 - progress(t, outAt, outAt + dur));
const at = (p: THREE.Vector3, y = 0.7) => p.clone().setY(y);

/** Every visual beat of the episode. */
export class ReplicationStage {
  readonly group = new THREE.Group();
  private readonly pool = new PacketPool(260, 0.09);
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly arcs: ArcPath[] = [];

  private readonly users = POS.users.map(() => createUser());
  private readonly lb = createLoadBalancer();
  private readonly servers = POS.servers.map(() => createOriginServer(false));
  private readonly cache = createCacheNode();
  private readonly primary = createDatabase();
  private readonly replicas = POS.replicas.map(() => createDatabase());
  private readonly standby = createDatabase();
  private readonly mascot = new Mascot();
  private readonly nodes: NodeMesh[];

  private readonly userToLb: ArcPath[];
  private readonly lbToServer: ArcPath[];
  private readonly serverToCache: ArcPath[];
  /** Writes: app server → primary. */
  private readonly serverToPrimary: ArcPath[];
  /** Reads: app server s → replica s % 2; plus server 1 → replica 3. */
  private readonly serverToReplica: ArcPath[];
  private readonly serverToReplica3: ArcPath;
  /** Replication streams: primary → replica r. */
  private readonly repl: ArcPath[];
  private readonly toStandby: ArcPath;
  /** After failover: app server → replica 1 (the new primary), and its stream to replica 2. */
  private readonly serverToNew: ArcPath[];
  private readonly newRepl: ArcPath;

  private readonly flows = allFlows();
  private readonly labels: { lb: Label3D; servers: Label3D[]; cache: Label3D; primary: Label3D; replicas: Label3D[]; standby: Label3D };

  constructor() {
    const floorGeo = new THREE.CircleGeometry(80, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    const grid = new THREE.GridHelper(160, 160, COLORS.oceanGrid, COLORS.oceanGrid);
    this.group.add(floor, grid, this.pool.group, this.mascot.group);
    this.disposables.push(floorGeo, floorMat, grid.geometry, grid.material as THREE.Material);

    const place = (node: NodeMesh, pos: THREE.Vector3, scale = NODE_SCALE) => {
      node.group.position.copy(pos);
      node.setBaseScale(scale);
      this.group.add(node.group);
      return node;
    };
    this.users.forEach((u, i) => place(u, POS.users[i]));
    place(this.lb, POS.lb, NODE_SCALE * 1.1);
    this.servers.forEach((s, i) => place(s, POS.servers[i]));
    place(this.cache, POS.cache, NODE_SCALE * 0.85);
    place(this.primary, POS.primary, NODE_SCALE * 1.4);
    this.replicas.forEach((r, i) => place(r, POS.replicas[i], NODE_SCALE * 1.2));
    place(this.standby, POS.standby, NODE_SCALE * 1.1);
    this.mascot.shadowVisible = false;
    this.nodes = [...this.users, this.lb, ...this.servers, this.cache, this.primary, ...this.replicas, this.standby];

    const arc = (from: THREE.Vector3, to: THREE.Vector3, height: number, radius = 0.03) => {
      const a = new ArcPath(from, to, { height, radius });
      this.group.add(a.mesh);
      this.arcs.push(a);
      return a;
    };
    this.userToLb = POS.users.map((u) => arc(at(u, 0.5), at(POS.lb, 0.5), 0.5));
    this.lbToServer = POS.servers.map((s) => arc(at(POS.lb, 0.5), at(s, 0.6), 0.6));
    this.serverToCache = POS.servers.map((s) => arc(at(s, 0.6), at(POS.cache, 0.5), 0.7));
    this.serverToPrimary = POS.servers.map((s) => arc(at(s, 0.6), at(POS.primary, 0.9), 1.2));
    this.serverToReplica = POS.servers.map((s, i) => arc(at(s, 0.6), at(POS.replicas[i % 2], 0.8), 2.2));
    this.serverToReplica3 = arc(at(POS.servers[1], 0.6), at(POS.replicas[2], 0.8), 2.6);
    this.repl = POS.replicas.map((r) => arc(at(POS.primary, 0.6), at(r, 0.6), 0.35, 0.045));
    this.toStandby = arc(at(POS.primary, 0.6), at(POS.standby, 0.6), 0.35, 0.045);
    this.serverToNew = POS.servers.map((s) => arc(at(s, 0.6), at(POS.replicas[0], 0.8), 1.6));
    this.newRepl = arc(at(POS.replicas[0], 0.6), at(POS.replicas[1], 0.6), 0.35, 0.045);

    this.labels = {
      lb: new Label3D(this.lb.top, 'Load balancer', { size: 22, accent: CSS.network }),
      servers: this.servers.map((s, i) => new Label3D(s.top, `App server ${i + 1}`, { size: 20 })),
      cache: new Label3D(this.cache.top, 'Cache', { size: 22, accent: CSS.storage }),
      primary: new Label3D(this.primary.top, 'Database', { size: 26, accent: CSS.storage }),
      replicas: this.replicas.map((r, i) => new Label3D(r.top, `Replica ${i + 1}`, { size: 22, accent: CSS.storage })),
      standby: new Label3D(this.standby.top, 'Standby', { size: 22, accent: CSS.muted }),
    };
  }

  // ---- Timing helpers -------------------------------------------------------

  /** Is the (first) primary down at t? */
  private primaryDown(t: number) {
    return (
      within(t, B.down + 0.6, B.lastEp) ||
      within(t, ASYNC_CRASH(), B.syncMode) ||
      within(t, SYNC_CRASH(), B.rds) ||
      within(t, B.dies + 0.6, B.oldPrimary + 0.6) ||
      within(t, B.stonith + 2.0, B.recap)
    );
  }

  /** Replica 1 has been promoted. */
  private promoted(t: number) {
    return t >= B.notice + 2.2 && t < B.recap;
  }

  /** Split brain: the old primary is back, accepting writes. */
  private splitBrain(t: number) {
    return within(t, B.oldPrimary + 0.6, B.stonith + 2.0);
  }

  /** The address change of section 3: committed, then on the wire until it lands. */
  private lagStory() {
    const commit = B.saves + 1.2;
    return { write: B.saves + 0.2, commit, leave: commit + 0.3, arrive: B.lands + 0.4, read: B.reload + 0.8, readBack: B.oldBack - 0.3 };
  }

  /** Where the async demo's last change is on the wire (it freezes at the crash). */
  private asyncGhostK(t = Infinity) {
    const leave = B.asyncMode + 1.4;
    return clamp((Math.min(t, ASYNC_CRASH()) - leave) / (ASYNC_CRASH() - leave + 5.5));
  }

  private writeFlows(): WriteFlow[] {
    return [this.flows.background, this.flows.asyncCrash, this.flows.syncCrash];
  }

  // ---- Update ---------------------------------------------------------------

  update(t: number) {
    this.users.forEach((u, i) => u.setAppear(life(t, 0.2 + i * 0.1)));
    this.lb.setAppear(life(t, 0.4));
    this.servers.forEach((s, i) => s.setAppear(life(t, 0.5 + i * 0.1)));
    this.servers.forEach((s) => s.setStatus(COLORS.healthy, 1.6));
    this.cache.setAppear(life(t, 0.6, B.s2 - 0.4));
    this.cache.setStatus(COLORS.storage, 2.2);

    // Primary: down in the hook, the crash demos and failover; fenced at the end of trap 2.
    this.primary.setAppear(life(t, 0.8));
    const down = this.primaryDown(t);
    const dim = down ? 1 - 0.25 * pulse(t, 0.4) * (within(t, B.down + 0.6, B.down + 2) ? 1 : 0) : 0;
    this.primary.setDim(dim);
    if (down) this.primary.setStatus(COLORS.failure, 0.4 + 1.6 * pulse(t, 0.8));
    else if (this.splitBrain(t)) this.primary.setStatus(COLORS.failure, 1.2 + 1.2 * pulse(t, 0.5));
    else this.primary.setStatus(COLORS.healthy, 2.2);

    // Replicas: slide out of the primary in section 1; replica 3 joins in section 2.
    this.replicas.forEach((r, i) => {
      const from = i < 2 ? B.copies + 0.4 + i * 0.3 : B.addReplica + 0.4;
      const to = i < 2 ? Infinity : B.s3;
      r.setAppear(life(t, from, to, 0.7));
      const k = ramp(t, from, from + 1.0);
      r.group.position.copy(POS.primary).lerp(POS.replicas[i], i < 2 ? k : 1);
      const isNewPrimary = i === 0 && this.promoted(t);
      r.setStatus(isNewPrimary && this.splitBrain(t) ? COLORS.failure : COLORS.healthy, 2.0);
      r.setDim(0);
    });
    this.standby.setAppear(life(t, B.rds + 0.3, B.summary + 1.5, 0.6));
    this.standby.setStatus(COLORS.healthy, 1.4);
    this.standby.setDim(0.35);

    // ---- Arcs ---------------------------------------------------------------
    const front = life(t, 0.5);
    this.userToLb.forEach((a) => a.show(0.4 * front));
    this.lbToServer.forEach((a) => a.show(0.4 * front));
    this.serverToCache.forEach((a) => a.show(0.35 * life(t, 0.7, B.s2 - 0.4)));

    const oldWrites = this.promoted(t) ? (this.splitBrain(t) ? 0.45 : 0) : 0.4;
    this.serverToPrimary.forEach((a) => {
      a.show(oldWrites * life(t, 0.8));
      a.setColor(down || this.splitBrain(t) ? COLORS.failure : COLORS.network);
    });
    const reads = life(t, B.spread + 0.2, B.s4, 0.6);
    this.serverToReplica.forEach((a) => a.show(0.35 * reads));
    this.serverToReplica3.show(0.35 * life(t, B.addReplica + 0.8, B.s3 - 0.4));

    const streams = life(t, B.replicas + 0.2, Infinity, 0.6);
    this.repl.forEach((a, i) => {
      const alive = i < 2 ? 1 : life(t, B.addReplica + 0.8, B.s3 - 0.4);
      const cut = this.promoted(t) || within(t, ASYNC_CRASH(), B.syncMode) || within(t, SYNC_CRASH(), B.rds);
      a.show((cut ? 0.12 : 0.65) * streams * alive);
      a.setColor(COLORS.storage);
    });
    this.toStandby.show(0.65 * life(t, B.rds + 0.6, B.summary + 1.2));
    this.toStandby.setColor(COLORS.storage);

    const newWrites = this.promoted(t) ? 0.45 * life(t, B.back, B.recap) : 0;
    this.serverToNew.forEach((a) => {
      a.show(newWrites);
      a.setColor(this.splitBrain(t) ? COLORS.failure : COLORS.network);
    });
    this.newRepl.show(0.65 * life(t, B.back + 0.4, B.recap));
    this.newRepl.setColor(COLORS.storage);

    this.updatePackets(t);
    this.updateMascot(t);
  }

  private updatePackets(t: number) {
    const p = this.pool;
    p.begin();
    const blue: EmitOptions = { color: COLORS.network };
    const green: EmitOptions = { color: COLORS.healthy, reverse: true };
    const red: EmitOptions = { color: COLORS.failure, reverse: true };
    const change: EmitOptions = { color: COLORS.storage, size: 0.11 };

    // Hook: visitors keep coming; the cache answers some reads, everything that needs the database fails.
    const hookEnd = B.s1 + 1;
    for (let s = 0; s < 3; s++) {
      p.stream(this.userToLb[s].curve, t, 0.6 + s * 0.2, hookEnd, 0.6, 0.45, { ...blue, size: 0.07 });
      p.stream(this.lbToServer[s].curve, t, 1.0 + s * 0.2, hookEnd, 0.6, 0.45, { ...blue, size: 0.07 });
      p.stream(this.serverToCache[s].curve, t, 1.4 + s * 0.3, B.lastEp + 8, 1.2, 0.4, blue);
      p.stream(this.serverToCache[s].curve, t, 1.8 + s * 0.3, B.lastEp + 8, 1.2, 0.4, green);
      p.stream(this.serverToPrimary[s].curve, t, 1.1 + s * 0.4, B.down + 0.6, 0.9, 0.5, blue);
      p.stream(this.serverToPrimary[s].curve, t, B.down + 0.8 + s * 0.4, B.fix, 1.1, 0.5, blue);
      p.stream(this.serverToPrimary[s].curve, t, B.down + 1.3 + s * 0.4, B.fix, 1.1, 0.5, red);
    }

    // Sections 1–4: replicated writes (purple changes on the streams) and their trips from the app servers.
    for (const flow of this.writeFlows()) {
      if (t < flow.start - 1 || t > flow.end + 4) continue;
      for (const e of flow.sim.events) this.write(t, e, flow === this.flows.syncCrash);
    }

    // Section 2: a write aimed at a replica bounces; then reads spread over the replicas.
    p.travel(this.serverToReplica[1].curve, t, B.pgReadOnly + 1.2, 0.8, { ...change, color: COLORS.storage });
    p.travel(this.serverToReplica[1].curve, t, B.pgReadOnly + 2.0, 0.6, red);
    for (let s = 0; s < 3; s++) {
      p.stream(this.serverToReplica[s].curve, t, B.spread + 0.6 + s * 0.3, B.s3 - 0.4, 0.9, 0.55, blue);
      p.stream(this.serverToReplica[s].curve, t, B.spread + 1.15 + s * 0.3, B.s3 - 0.4, 0.9, 0.55, green);
    }
    p.stream(this.serverToReplica3.curve, t, B.addReplica + 1.2, B.s3 - 0.4, 0.9, 0.6, blue);
    p.stream(this.serverToReplica3.curve, t, B.addReplica + 1.8, B.s3 - 0.4, 0.9, 0.6, green);

    // Section 3: the address change and the read that comes back stale.
    const s3 = this.lagStory();
    p.travel(this.serverToPrimary[0].curve, t, s3.write, 0.9, change);
    p.travel(this.serverToPrimary[0].curve, t, s3.commit, 0.6, green);
    p.travel(this.serverToReplica[0].curve, t, s3.read, 1.0, blue);
    p.travel(this.serverToReplica[0].curve, t, s3.readBack, 1.0, { ...green, color: COLORS.warning });
    // Fix: that user's reads go to the primary.
    p.stream(this.serverToPrimary[0].curve, t, B.ownReads + 0.8, B.s4 - 0.4, 1.2, 0.6, blue);
    p.stream(this.serverToPrimary[0].curve, t, B.ownReads + 1.4, B.s4 - 0.4, 1.2, 0.6, green);
    // Other changes on the wire in section 3 (the stream never stops).
    for (let r = 0; r < 2; r++) p.stream(this.repl[r].curve, t, B.takeTime + 0.4 + r * 0.5, B.saves, 1.4, LAG, change);
    // RDS standby: synchronous copies.
    p.stream(this.toStandby.curve, t, B.rds + 1.0, B.summary + 1.0, 1.0, 0.8, change);

    // Section 5: writes move to the new primary; split brain writes to both.
    for (let s = 0; s < 3; s++) {
      p.stream(this.serverToPrimary[s].curve, t, B.dies + 0.4 + s * 0.3, B.dies + 3, 1.0, 0.5, { ...change });
      p.stream(this.serverToPrimary[s].curve, t, B.dies + 0.9 + s * 0.3, B.notice + 2.2, 1.0, 0.5, red);
      p.stream(this.serverToNew[s].curve, t, B.back + 0.4 + s * 0.35, B.recap - 0.4, 1.1, 0.6, change);
      p.stream(this.serverToPrimary[s].curve, t, B.oldPrimary + 1.2 + s * 0.35, B.stonith + 2.0, 1.1, 0.6, change);
    }
    p.stream(this.newRepl.curve, t, B.back + 1.0, B.recap - 0.4, 1.1, LAG, change);
    p.end();
  }

  /** One simulated write: server → primary, then the change down each stream (and the sync confirmation back). */
  private write(t: number, e: WriteEvent, sync: boolean) {
    const p = this.pool;
    p.travel(this.serverToPrimary[e.server].curve, t, e.at - 0.6, 0.6, { color: COLORS.storage, size: 0.08 });
    e.arrivals.forEach((arrive, r) => {
      const dur = arrive === Infinity ? (sync && r === 0 ? SYNC_RT : LAG + 0.6 * r) : arrive - e.committedAt;
      // Cut off at the crash: the change freezes and fades where it was.
      const crash = e.arrivals.some((x) => x === Infinity) ? Math.min(ASYNC_CRASH(), SYNC_CRASH()) : Infinity;
      if (arrive === Infinity && t > crash) {
        const k = (crash - e.committedAt) / dur;
        const fade = 1 - progress(t, crash + 0.8, crash + 2.6);
        if (k > 0 && k < 1 && fade > 0) p.emit(this.repl[r].curve, k, { color: COLORS.failure, size: 0.11 * fade });
        return;
      }
      p.travel(this.repl[r].curve, t, e.committedAt, dur, { color: COLORS.storage, size: 0.11 });
      if (sync && r === 0 && arrive !== Infinity) p.travel(this.repl[0].curve, t, arrive, SYNC_RT, { color: COLORS.healthy, size: 0.08, reverse: true });
    });
  }

  /** The mascot is order 1042's address change: written, copied, late, lost. */
  private updateMascot(t: number) {
    const m = this.mascot;
    let pos: THREE.Vector3 | null = null;
    let opacity = 1;
    let pose = poseIdle(t);
    const scale = 0.6;
    const top = (p: THREE.Vector3, y = 1.55) => p.clone().setY(y);

    // Section 1: appears over app server 1, travels to the primary, then down the stream to replica 1.
    const s1a = B.order + 0.4;
    const s1b = B.travels + 0.3;
    if (within(t, s1a, B.s2 + 0.2)) {
      pos = top(POS.servers[1], 1.4);
      if (t >= s1b) pos = this.serverToPrimary[1].curve.getPointAt(ramp(t, s1b, s1b + 1.4)).add(V(0, 0.25, 0));
      if (t >= s1b + 1.4) pos = top(POS.primary, 1.65);
      if (t >= s1b + 2.4) pos = this.repl[0].curve.getPointAt(ramp(t, s1b + 2.4, s1b + 5.0)).add(V(0, 0.25, 0));
      if (t >= s1b + 5.0) pos = top(POS.replicas[0], 1.45);
      opacity = 1 - progress(t, B.s2 - 0.4, B.s2 + 0.2);
      if (within(t, s1b + 5.0, s1b + 7.0)) pose = poseCheer(t);
    }

    // Section 3: the saved change, slow on the wire while the page reads the replica.
    const s3 = this.lagStory();
    if (within(t, s3.write + 0.8, B.ryw + 2)) {
      pos = top(POS.primary, 1.65);
      if (t >= s3.leave) pos = this.repl[0].curve.getPointAt(clamp((t - s3.leave) / (s3.arrive - s3.leave))).add(V(0, 0.25, 0));
      if (t >= s3.arrive) pos = top(POS.replicas[0], 1.45);
      opacity = life(t, s3.write + 0.8, B.ryw + 1.4, 0.4);
      if (within(t, B.oldBack, B.lands)) pose = poseSurprised(t);
      if (within(t, s3.arrive, s3.arrive + 2.4)) pose = poseCheer(t);
    }

    // Section 4, async: the latest change is on the wire when the primary crashes; it becomes a ghost.
    const leave = B.asyncMode + 1.4;
    if (within(t, B.asyncMode + 0.6, B.syncMode - 0.2)) {
      const k = this.asyncGhostK(t);
      pos = t < leave ? top(POS.primary, 1.65) : this.repl[0].curve.getPointAt(k).add(V(0, 0.25, 0));
      if (t >= ASYNC_CRASH()) {
        opacity = 1 - 0.85 * progress(t, ASYNC_CRASH(), ASYNC_CRASH() + 0.8);
        pose = poseSurprised(t);
      }
      opacity *= life(t, B.asyncMode + 0.6, B.syncMode - 0.8, 0.4);
    }

    // Section 4, sync: the change reaches replica 1 before "saved"; it survives the crash.
    const syncLeave = B.syncMode + 1.0;
    if (within(t, B.syncMode + 0.6, B.vendors + 1.5)) {
      pos = t < syncLeave ? top(POS.primary, 1.65) : this.repl[0].curve.getPointAt(ramp(t, syncLeave, syncLeave + 2.2)).add(V(0, 0.25, 0));
      if (t >= syncLeave + 2.2) pos = top(POS.replicas[0], 1.45);
      opacity = life(t, B.syncMode + 0.6, B.vendors + 0.9, 0.4);
      if (t >= SYNC_CRASH()) pose = poseCheer(t);
    }

    // Trap 1 callback: the ghost of the lost change.
    if (within(t, B.lostWrites + 0.6, B.splitBrain)) {
      pos = this.repl[0].curve.getPointAt(0.55).add(V(0, 0.25, 0));
      opacity = 0.3 * life(t, B.lostWrites + 0.6, B.splitBrain - 0.6, 0.4);
      pose = poseSurprised(t);
    }

    m.group.visible = pos !== null && opacity > 0.02;
    if (!m.group.visible || !pos) return;
    m.group.position.copy(pos);
    m.group.scale.setScalar(scale);
    m.group.rotation.set(0, 0.3, 0);
    m.setOpacity(clamp(opacity));
    m.apply(pose, t);
  }

  // ---- Overlay --------------------------------------------------------------

  drawOverlay(hud: Hud, t: number) {
    const L = this.labels;
    L.lb.draw(hud, fadeWindow(t, 0.8, B.s2, 0.4));
    L.servers.forEach((label, i) => label.draw(hud, fadeWindow(t, 1.0 + i * 0.15, B.s2, 0.3)));
    L.cache.draw(hud, fadeWindow(t, 1.0, B.s2 - 0.4, 0.3), { sub: within(t, B.lastEp, B.onlyOne + 2) ? 'from episode 4' : undefined });

    // Primary label: the database → primary → old primary → fenced.
    const promoted = this.promoted(t);
    const split = this.splitBrain(t);
    let pText = t < B.primary + 0.3 ? 'Database' : '★ Primary';
    let pSub: string | undefined;
    let pAccent: string = t < B.primary + 0.3 ? CSS.storage : CSS.warning;
    if (within(t, B.down + 0.6, B.lastEp)) [pSub, pAccent] = ['down', CSS.failure];
    if (within(t, B.onlyOne, B.copies)) pSub = 'one machine';
    if (within(t, B.primary + 0.3, B.replicas + 3)) pSub = 'takes all the writes';
    if (within(t, B.saves + 1.2, B.reload)) pSub = 'saved ✓';
    if (this.primaryDown(t) && t >= B.s4) [pSub, pAccent] = ['crashed', CSS.failure];
    if (promoted) [pText, pSub, pAccent] = ['Old primary', 'down', CSS.failure];
    if (split) [pText, pSub, pAccent] = ['★ Primary?', 'back online, taking writes', CSS.failure];
    if (within(t, B.stonith + 2.0, B.recap)) [pText, pSub, pAccent] = ['Old primary', 'fenced off', CSS.muted];
    L.primary.draw(hud, life(t, 0.9, B.next), { text: pText, sub: pSub, accent: pAccent });

    L.replicas.forEach((label, i) => {
      const from = i < 2 ? B.copies + 1.2 + i * 0.3 : B.addReplica + 1.0;
      const to = i < 2 ? B.next : B.s3 - 0.4;
      let text = `Replica ${i + 1}`;
      let sub: string | undefined = within(t, B.readOnly, B.s3) ? 'read-only' : undefined;
      let accent: string = CSS.storage;
      if (i === 0 && within(t, this.lagStory().commit, this.lagStory().arrive)) [sub, accent] = ['old address', CSS.warning];
      if (i === 0 && promoted) [text, sub, accent] = ['★ Primary', 'promoted', split ? CSS.failure : CSS.healthy];
      if (i === 0 && within(t, SYNC_CRASH(), B.rds)) [sub, accent] = ['has every confirmed save', CSS.healthy];
      label.draw(hud, life(t, from, to), { text, sub, accent });
    });
    L.standby.draw(hud, life(t, B.rds + 0.8, B.summary + 1.2), { text: 'Standby · zone B', sub: 'synchronous · no reads' });

    this.drawHook(hud, t);
    this.drawSectionTwo(hud, t);
    this.drawSectionThree(hud, t);
    this.drawSectionFour(hud, t);
    this.drawSectionFive(hud, t);
  }

  /** Browser-style card: a page of the shop. */
  private card(hud: Hud, alpha: number, url: string, title: string, field: { text: string; color: string }, note?: { text: string; color: string; alpha: number }) {
    if (alpha <= 0.001) return;
    const [x, y] = CARD;
    const w = 420;
    hud.roundRect(x, y, w, note ? 230 : 160, 20, CSS.panel, CSS.panelBorder, alpha);
    hud.text(url, x + 24, y + 30, { size: 18, mono: true, color: CSS.muted, alpha });
    hud.text(title, x + 24, y + 72, { size: 26, weight: 700, alpha });
    hud.roundRect(x + 24, y + 98, w - 48, 42, 21, 'rgba(5,8,15,0.6)', field.color, alpha, 2);
    hud.text(field.text, x + w / 2, y + 120, { size: 22, weight: 700, color: field.color, align: 'center', alpha });
    if (note && note.alpha > 0) {
      hud.roundRect(x + 24, y + 158, w - 48, 48, 12, 'rgba(5,8,15,0.6)', note.color, alpha * note.alpha, 2);
      hud.text(note.text, x + w / 2, y + 182, { size: 22, weight: 700, color: note.color, align: 'center', alpha: alpha * note.alpha });
    }
  }

  private drawHook(hud: Hud, t: number) {
    const a = fadeWindow(t, B.down + 0.4, B.fix + 0.4, 0.4);
    const failed = t >= B.down + 1.2;
    this.card(hud, a, 'shop.example/checkout', 'Place order', failed ? { text: '✗ Error: try again later', color: CSS.failure } : { text: 'Placing order…', color: CSS.network });
    hud.badge(POS.primary.clone().setY(1.6), 'DOWN', CSS.failure, fadeWindow(t, B.down + 0.8, B.fix, 0.3), 0.9, 60);
    const errors = Math.floor(Math.max(0, t - (B.down + 1.3)) * 2.6);
    drawCounter(hud, POS.servers[2].clone().add(V(0, 1.2, 1.2)), `failed requests: ${errors}`, fadeWindow(t, B.stillReads, B.fix, 0.3), CSS.failure, 0);
    hud.badge(POS.cache.clone().setY(0.9), 'HITS ✓', CSS.healthy, fadeWindow(t, B.stillReads + 0.6, B.oneMachine, 0.3), 0.55, 105);
  }

  private drawSectionTwo(hud: Hud, t: number) {
    hud.badge(POS.replicas[1].clone().setY(1.2), '✗ read-only', CSS.failure, fadeWindow(t, B.pgReadOnly + 2.6, B.spread, 0.3), 0.6, 120);
    // Primary load: everything → writes only.
    const meter = fadeWindow(t, B.spread + 0.2, B.s3 - 0.4, 0.4);
    const load = 0.9 - 0.55 * ramp(t, B.aws + 0.4, B.aws + 2.4);
    drawMeter(hud, POS.primary.clone().setY(2.3), load, meter, { label: 'primary load', offsetY: 120, width: 170 });
  }

  private drawSectionThree(hud: Hud, t: number) {
    const s3 = this.lagStory();
    hud.badge(POS.primary.clone().setY(1.6), 'saved ✓', CSS.healthy, fadeWindow(t, B.savedEarly + 0.8, B.behind, 0.3), 0.6, 120);
    // "Behind" counter: slow motion here; the real figure is PostgreSQL's "typically under one second".
    const behindAlpha = fadeWindow(t, B.behind + 0.6, B.watch + 1.0, 0.3) + fadeWindow(t, s3.leave, s3.arrive + 0.8, 0.3);
    const left = t < B.watch + 1.2 ? 0.8 * (1 - (((t - B.behind) / 2.2) % 1)) : 0.8 * (1 - progress(t, s3.leave, s3.arrive));
    const mid = this.repl[0].curve.getPointAt(0.5);
    drawCounter(hud, mid, `replica behind: ${left.toFixed(1)} s`, clamp(behindAlpha), left > 0.05 ? CSS.warning : CSS.healthy, -70);
    hud.text('example · slow motion', hud.project(mid).x, hud.project(mid).y + 106, { size: 16, color: CSS.muted, align: 'center', alpha: clamp(behindAlpha) });

    // The customer's page.
    const card = fadeWindow(t, B.watch + 0.8, B.ryw + 1.0, 0.4);
    let field: { text: string; color: string } = { text: `Delivery: ${OLD_ADDRESS}`, color: CSS.muted };
    let note: { text: string; color: string; alpha: number } | undefined;
    if (t >= B.saves + 0.2) field = { text: `Delivery: ${NEW_ADDRESS}`, color: CSS.network };
    if (t >= s3.commit) note = { text: 'Saved ✓', color: CSS.healthy, alpha: 1 };
    if (t >= B.reload + 0.3) [field, note] = [{ text: 'Reloading…', color: CSS.muted }, undefined];
    if (t >= B.oldBack) [field, note] = [{ text: `Delivery: ${OLD_ADDRESS}`, color: CSS.warning }, { text: 'old address?!', color: CSS.warning, alpha: 1 }];
    if (t >= s3.arrive + 0.4) [field, note] = [{ text: `Delivery: ${NEW_ADDRESS}`, color: CSS.healthy }, { text: 'replica caught up ✓', color: CSS.healthy, alpha: 1 }];
    this.card(hud, card, 'shop.example/orders/1042', 'Order #1042 (example)', field, note);
    hud.label(this.serverToPrimary[0].curve.getPointAt(0.5), 'your own reads → primary', {
      alpha: fadeWindow(t, B.ownReads + 0.8, B.s4 - 0.3, 0.3),
      size: 20,
      accent: CSS.network,
      offsetY: 30,
    });
  }

  private drawSectionFour(hud: Hud, t: number) {
    const anchor = POS.primary.clone().add(V(-2.6, 1.6, 0));
    // Async: confirmed saves, then the ones lost in the crash.
    const a = this.flows.asyncCrash.sim;
    const acked = a.events.filter((e) => e.ackAt <= t).length;
    drawCounter(hud, anchor, `saved ✓: ${acked}`, fadeWindow(t, B.asyncMode + 0.6, B.syncMode - 0.2, 0.3), CSS.healthy, 0);
    drawCounter(hud, anchor, `saved, then lost: ${a.lostAt(t)}`, fadeWindow(t, ASYNC_CRASH() + 0.4, B.syncMode - 0.2, 0.3), CSS.failure, -50);
    hud.badge(POS.primary.clone().setY(1.6), 'CRASH', CSS.failure, fadeWindow(t, ASYNC_CRASH(), ASYNC_CRASH() + 2.6, 0.2), 0.8, 60);
    hud.label(this.repl[0].curve.getPointAt(this.asyncGhostK()), 'saved ✓ … never arrived', {
      alpha: fadeWindow(t, ASYNC_CRASH() + 0.6, B.syncMode - 0.8, 0.3),
      size: 20,
      accent: CSS.failure,
      below: true,
      offsetY: 50,
    });

    // Sync: every save waits a round trip; nothing confirmed is lost.
    const s = this.flows.syncCrash.sim;
    const sAcked = s.events.filter((e) => e.ackAt <= t).length;
    const syncAlpha = fadeWindow(t, B.syncMode + 0.6, B.vendors, 0.3);
    drawCounter(hud, anchor, `saved ✓: ${sAcked}`, syncAlpha, CSS.healthy, 0);
    drawCounter(hud, anchor, `saved, then lost: ${s.lostAt(t)}`, fadeWindow(t, SYNC_CRASH() + 0.4, B.vendors, 0.3), CSS.healthy, -50);
    hud.badge(POS.primary.clone().setY(1.6), 'CRASH', CSS.failure, fadeWindow(t, SYNC_CRASH(), SYNC_CRASH() + 2.0, 0.2), 0.8, 60);
    hud.label(this.repl[0].curve.getPointAt(0.5), 'wait for replica 1: +1 round trip', {
      alpha: fadeWindow(t, B.syncMode + 1.4, B.vendors - 0.2, 0.3),
      size: 20,
      accent: CSS.warning,
      offsetY: 40,
    });
    hud.badge(POS.primary.clone().setY(1.6), 'saving… waiting', CSS.warning, fadeWindow(t, B.syncMode + 1.2, B.syncMode + 3.4, 0.3), 0.5, 120);
  }

  private drawSectionFive(hud: Hud, t: number) {
    // The failover tool watching the primary.
    const watchAlpha = fadeWindow(t, B.notice + 0.2, B.twoTraps, 0.3);
    if (watchAlpha > 0) {
      const w = hud.project(POS.watcher.clone().setY(0.6));
      const targets = [POS.primary.clone().setY(1.0), POS.replicas[0].clone().setY(1.0)];
      const { ctx } = hud;
      ctx.save();
      ctx.globalAlpha = watchAlpha;
      ctx.setLineDash([10, 10]);
      ctx.lineDashOffset = -t * 40;
      ctx.lineWidth = 3;
      targets.forEach((target, i) => {
        const p = hud.project(target);
        ctx.strokeStyle = i === 0 ? CSS.failure : CSS.healthy;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });
      ctx.restore();
      hud.label(POS.watcher.clone().setY(0.6), '◉ failover tool', { alpha: watchAlpha, size: 22, accent: CSS.edge, sub: 'health check → promote', offsetY: 10, below: true });
    }
    hud.badge(POS.replicas[0].clone().setY(1.4), 'PROMOTED', CSS.healthy, fadeWindow(t, B.notice + 2.2, B.tool + 1.5, 0.3), 0.6, 120);
    hud.label(POS.replicas[0].clone().setY(0.2).setZ(POS.replicas[0].z + 1.6), 'pg_ctl promote', {
      alpha: fadeWindow(t, B.tool + 0.6, B.back + 0.6, 0.3),
      size: 20,
      mono: true,
      accent: CSS.edge,
      offsetY: 10,
      below: true,
    });

    // Split brain: two primaries, two versions of order 1042.
    const two = fadeWindow(t, B.twoWrites + 1.0, B.stonith + 2.0, 0.3);
    hud.label(POS.primary.clone().setY(0), `#1042 → ${OTHER_ADDRESS}`, { alpha: two, size: 22, mono: true, accent: CSS.failure, below: true, offsetY: 40 });
    hud.label(POS.replicas[0].clone().setY(0), `#1042 → ${NEW_ADDRESS}`, { alpha: two, size: 22, mono: true, accent: CSS.failure, below: true, offsetY: 40 });
    hud.badge(POS.primary.clone().lerp(POS.replicas[1], 0.5).setY(0), 'TWO PRIMARIES', CSS.failure, fadeWindow(t, B.oldPrimary + 1.2, B.stonith, 0.3), 0.7, -20);
    // STONITH: the old primary is shut out.
    hud.badge(POS.primary.clone().setY(0.5), '✗ FENCED', CSS.muted, fadeWindow(t, B.stonith + 2.0, B.recap - 0.4, 0.3), 0.8, 0);
  }

  dispose() {
    this.pool.dispose();
    this.mascot.dispose();
    for (const n of this.nodes) n.dispose();
    for (const a of this.arcs) a.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
