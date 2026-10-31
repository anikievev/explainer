import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import { distribute, steadyRequests, activeAt, countsAt, type Algorithm, type Assignment, type Request } from '../../components/Distributor.ts';
import type { Hud } from '../../components/Hud.ts';
import { Label3D } from '../../components/Label3D.ts';
import { Mascot, poseRun } from '../../components/Mascot.ts';
import {
  createDatabase,
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

const NODE_SCALE = 1.9;
const SERVER_COUNT = 4;

export const POS = {
  users: [new THREE.Vector3(-7.2, 0, -2.2), new THREE.Vector3(-7.2, 0, 0), new THREE.Vector3(-7.2, 0, 2.2)],
  lb: new THREE.Vector3(-3, 0, 0),
  lbStandby: new THREE.Vector3(-3, 0, -2.9),
  servers: [new THREE.Vector3(2, 0, -2.6), new THREE.Vector3(2, 0, 0), new THREE.Vector3(2, 0, 2.6), new THREE.Vector3(2, 0, 5.2)],
  database: new THREE.Vector3(6.6, 0, 0),
  store: new THREE.Vector3(6.6, 0, -3.2),
};

/** Client ids whose (stable) hash lands on servers 2, 0 and 1: a visibly non-sequential mapping. */
const HASH_CLIENTS = [12, 3, 2];
const USER_IPS = ['198.51.100.7', '203.0.113.7', '192.0.2.44'];

// Request leg timings (s).
const TO_LB = 0.55;
const TO_SERVER = 0.55;
const BACK = 0.4;
/** Time from leaving the user until the request reaches its server. */
const ARRIVE = TO_LB + TO_SERVER;

const life = (t: number, inAt: number, outAt = Infinity, dur = 0.5) =>
  outAt === Infinity ? progress(t, inAt, inAt + dur) : Math.min(progress(t, inAt, inAt + dur), 1 - progress(t, outAt, outAt + dur));
const at = (p: THREE.Vector3, y = 0.7) => p.clone().setY(y);

interface Segment {
  start: number;
  end: number;
  assignments: Assignment[];
  /** Which user sends each request (defaults to client % 3). */
  user?: (a: Assignment, i: number) => number;
  /** Requests to these servers fail (red response). */
  failing?: (a: Assignment) => boolean;
  color?: (a: Assignment) => number;
  via?: 'lb' | 'standby' | ((a: Assignment) => 'lb' | 'standby');
}

/** Every visual beat of the episode after the map intro. */
export class ShopStage {
  readonly group = new THREE.Group();
  private readonly pool = new PacketPool(140, 0.11);
  private readonly disposables: Array<{ dispose(): void }> = [];

  private readonly users = POS.users.map(() => createUser());
  private readonly lb = createLoadBalancer();
  private readonly lbStandby = createLoadBalancer();
  private readonly servers = POS.servers.map(() => createOriginServer(false));
  private readonly database = createDatabase();
  private readonly store = createDatabase();
  private readonly carts = [0, 1, 2].map(() => createFileCube(COLORS.warning));
  private readonly mascot = new Mascot();
  private readonly queue = new RequestQueue(14, new THREE.Vector3(-1, 0, 0), 0.26);
  private readonly nodes: NodeMesh[];

  private readonly userDirect: ArcPath[];
  private readonly userToLb: ArcPath[];
  private readonly userToStandby: ArcPath[];
  private readonly lbToServer: ArcPath[];
  private readonly standbyToServer: ArcPath[];
  private readonly serverToDb: ArcPath[];
  private readonly serverToStore: ArcPath[];
  private readonly arcs: ArcPath[] = [];

  private readonly ceiling: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private readonly poolFrame: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  private readonly zones: Array<THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>> = [];

  private readonly segments: Segment[];
  private readonly labels: {
    users: Label3D[];
    lb: Label3D;
    standby: Label3D;
    servers: Label3D[];
    database: Label3D;
    store: Label3D;
  };

  constructor() {
    const floorGeo = new THREE.CircleGeometry(80, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    const grid = new THREE.GridHelper(160, 160, COLORS.oceanGrid, COLORS.oceanGrid);
    this.group.add(floor, grid, this.pool.group, this.queue.group, this.mascot.group);
    this.disposables.push(floorGeo, floorMat, grid.geometry, grid.material as THREE.Material, this.queue);

    const place = (node: NodeMesh, pos: THREE.Vector3, scale = NODE_SCALE) => {
      node.group.position.copy(pos);
      node.setBaseScale(scale);
      this.group.add(node.group);
      return node;
    };
    this.users.forEach((u, i) => place(u, POS.users[i]));
    place(this.lb, POS.lb, NODE_SCALE * 1.15);
    place(this.lbStandby, POS.lbStandby, NODE_SCALE * 1.15);
    this.servers.forEach((s, i) => place(s, POS.servers[i]));
    place(this.database, POS.database, NODE_SCALE * 1.1);
    place(this.store, POS.store, NODE_SCALE * 0.9);
    this.carts.forEach((c) => place(c, new THREE.Vector3(), 1.4));
    this.queue.group.position.set(POS.servers[1].x - 0.9, 0.35, 0);
    this.mascot.shadowVisible = false;
    this.nodes = [...this.users, this.lb, this.lbStandby, ...this.servers, this.database, this.store, ...this.carts];

    // Scale-up ceiling: the biggest server you can buy.
    const ceilingGeo = new THREE.BoxGeometry(2.0, 0.035, 0.035);
    this.ceiling = new THREE.Mesh(ceilingGeo, new THREE.MeshBasicMaterial({ color: COLORS.warning, transparent: true }));
    this.ceiling.position.set(POS.servers[1].x, 2.75, 0);
    // Pool frame around the servers ("target group").
    const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.4, 0.02, 7.4));
    this.poolFrame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true }));
    this.poolFrame.position.set(POS.servers[0].x, 0.02, 0);
    // Availability zones around the two load balancers.
    const zoneGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.6, 0.02, 2.4));
    for (const z of [POS.lb.z, POS.lbStandby.z]) {
      const zone = new THREE.LineSegments(zoneGeo, new THREE.LineBasicMaterial({ color: COLORS.network, transparent: true }));
      zone.position.set(POS.lb.x, 0.02, z);
      this.zones.push(zone);
      this.disposables.push(zone.material);
    }
    this.group.add(this.ceiling, this.poolFrame, ...this.zones);
    this.disposables.push(ceilingGeo, this.ceiling.material, frameGeo, this.poolFrame.material, zoneGeo);

    const arc = (from: THREE.Vector3, to: THREE.Vector3, height: number, radius = 0.03) => {
      const a = new ArcPath(at(from), at(to), { height, radius });
      this.group.add(a.mesh);
      this.arcs.push(a);
      return a;
    };
    this.userDirect = POS.users.map((u) => arc(u, POS.servers[1], 1.0));
    this.userToLb = POS.users.map((u) => arc(u, POS.lb, 0.7));
    this.userToStandby = POS.users.map((u) => arc(u, POS.lbStandby, 0.7));
    this.lbToServer = POS.servers.map((s) => arc(POS.lb, s, 0.9));
    this.standbyToServer = POS.servers.map((s) => arc(POS.lbStandby, s, 0.9));
    this.serverToDb = POS.servers.slice(0, 3).map((s) => arc(s, POS.database, 0.8, 0.025));
    this.serverToStore = POS.servers.slice(0, 3).map((s) => arc(s, POS.store, 0.8, 0.025));

    this.segments = this.buildTraffic();

    this.labels = {
      users: this.users.map((u, i) => new Label3D(u.top, i === 1 ? 'You' : 'User', { size: 22 })),
      lb: new Label3D(this.lb.top, 'Load balancer', { size: 26, accent: CSS.network }),
      standby: new Label3D(this.lbStandby.top, 'Standby', { size: 22, accent: CSS.network }),
      servers: this.servers.map((s, i) => new Label3D(s.top, `Server ${i + 1}`, { size: 22, below: true, offset: [0, -0.8, 0], offsetY: 20 })),
      database: new Label3D(this.database.top, 'Database', { size: 24, accent: CSS.storage }),
      store: new Label3D(this.store.top, 'Session store', { size: 22, accent: CSS.storage }),
    };
  }

  /** All request flows through the load balancer, as precomputed segments. */
  private buildTraffic(): Segment[] {
    const seg = (start: number, end: number, requests: Request[], algorithm: Algorithm, down: number[] = [], extra: Partial<Segment> = {}): Segment => ({
      start,
      end,
      assignments: distribute(requests.filter((r) => r.at < end), SERVER_COUNT, algorithm, [3, ...down].filter((v, i, a) => a.indexOf(v) === i)),
      ...extra,
    });
    const steady = (start: number, end: number, period = 0.7, work = 0.5) => steadyRequests(start, Math.max(0, Math.ceil((end - start) / period)), period, work);
    const rr: Algorithm = { kind: 'round-robin' };

    // Health-check timeline (section 3).
    const crashAt = B.breaks + 0.8;
    const unhealthyAt = this.unhealthyAt();
    const recoveredAt = this.recoveredAt();
    const drainAt = B.draining + 0.4;
    const replacedAt = B.draining + 7.5;
    const joinAt = B.autoscale + 5.5;

    const leastConn: Request[] = [{ at: B.leastConn + 0.5, work: 10, client: 0 }, ...steadyRequests(B.leastConn + 1.4, 12, 0.7, 1.1)];
    const hashed = steadyRequests(B.hash + 0.6, 12, 0.62, 0.5).map((r, i) => ({ ...r, client: HASH_CLIENTS[i % 3] }));

    return [
      // 2 · first single request, then the algorithm demos.
      seg(B.picks + 1.2, B.picks + 1.3, [{ at: B.picks + 1.2, work: 0.6, client: 1 }], { kind: 'weighted', weights: [0, 1, 0] }),
      seg(B.roundRobin + 0.6, B.weighted - 0.2, steadyRequests(B.roundRobin + 0.6, 13, 0.62, 0.5), rr),
      seg(B.weighted + 0.6, B.leastConn - 0.2, steadyRequests(B.weighted + 0.6, 14, 0.42, 0.5), { kind: 'weighted', weights: [1, 1, 2] }),
      seg(B.leastConn + 0.5, B.hash - 0.2, leastConn, { kind: 'least-connections' }, [], {
        color: (a) => (a.work > 5 ? COLORS.warning : COLORS.network),
      }),
      seg(B.hash + 0.6, B.defaults, hashed, { kind: 'hash' }, [], { user: (_, i) => i % 3 }),
      seg(B.defaults + 0.4, B.s3 + 0.5, steady(B.defaults + 0.4, B.s3 + 0.5), rr),

      // 3 · health checks.
      seg(B.checking, unhealthyAt, steady(B.checking, unhealthyAt), rr, [], { failing: (a) => a.server === 1 && a.at + ARRIVE >= crashAt }),
      seg(unhealthyAt, recoveredAt, steady(unhealthyAt, recoveredAt), rr, [1]),
      seg(recoveredAt, B.deploys, steady(recoveredAt, B.deploys), rr),
      seg(B.deploys, drainAt, steady(B.deploys, drainAt), rr),
      seg(drainAt, replacedAt, steady(drainAt, replacedAt), rr, [0]),
      seg(replacedAt, joinAt, steady(replacedAt, joinAt), rr),
      { start: joinAt, end: B.s4, assignments: distribute(steady(joinAt, B.s4, 0.55), SERVER_COUNT, rr) },

      // 4 · Layer 4: two connections, each pinned to one server.
      {
        start: B.l4 + 0.5,
        end: B.l7,
        assignments: [
          ...steadyRequests(B.l4 + 0.5, Math.ceil((B.l7 - B.l4 - 0.5) / 0.55), 0.55, 0.3).map((r) => ({ ...r, client: 0, server: 0 })),
          ...steadyRequests(B.l4 + 0.8, Math.ceil((B.l7 - B.l4 - 0.8) / 0.55), 0.55, 0.3).map((r) => ({ ...r, client: 2, server: 2 })),
        ],
        user: (a) => a.client,
        color: (a) => (a.client === 0 ? COLORS.network : COLORS.edge),
      },
      // Layer 7: route by path; user 0 → shop, user 1 → API, user 2 → images.
      {
        start: B.l7 + 0.5,
        end: B.s5,
        assignments: steadyRequests(B.l7 + 0.5, Math.ceil((B.s5 - B.l7 - 0.5) / 0.5), 0.5, 0.35).map((r, i) => ({ ...r, client: i % 3, server: i % 3 })),
        user: (a) => a.client,
      },

      // 5 · sticky sessions: everyone pinned to server 1, which then dies.
      {
        start: B.sticky + 0.5,
        end: B.store + 1.2,
        assignments: steadyRequests(B.sticky + 0.5, Math.ceil((B.store + 0.7 - B.sticky) / 0.45), 0.45, 0.9).map((r) => ({ ...r, server: 0 })),
        failing: (a) => a.at + ARRIVE >= this.stickyCrashAt(),
      },
      seg(B.store + 1.4, B.spof + 0.5, steady(B.store + 1.4, B.spof + 0.5), rr),
      // Single LB, then failover to the standby.
      seg(B.spof + 0.5, this.failoverAt(), steady(B.spof + 0.5, this.failoverAt()), rr),
      seg(this.failoverAt() + 0.6, B.cloud, steady(this.failoverAt() + 0.6, B.cloud), rr, [], { via: 'standby' }),
      // Two zones: both load balancers active.
      seg(B.cloud + 0.6, B.database, steady(B.cloud + 0.6, B.database, 0.55), rr, [], { via: (a) => (a.client === 2 ? 'standby' : 'lb') }),
      seg(B.database, B.recap + 0.5, steady(B.database, B.recap + 0.5, 0.55), rr),
      // Recap: calm traffic.
      seg(B.recap + 0.5, B.next, steady(B.recap + 0.5, B.next, 0.9), rr),
    ];
  }

  private unhealthyAt() {
    return B.awsDefaults + 6.2;
  }
  private recoveredAt() {
    return B.recovers + 4.6;
  }
  private stickyCrashAt() {
    return B.pileUp + 3.0;
  }
  private failoverAt() {
    return B.runTwo + 3.6;
  }

  update(t: number) {
    const s1 = t < B.s2 - 0.3;
    const lbOn = t >= B.job;

    // ---- Users & load balancers -----------------------------------------
    this.users.forEach((u, i) => u.setAppear(life(t, B.shop + 2.8 + i * 0.15)));
    // Brief teaser in the hook, then for good from section 2.
    this.lb.setAppear(Math.max(life(t, B.fix + 0.6, B.s1 - 0.6), life(t, B.job + 0.1)));
    const lbDown = within(t, this.failoverAt() - 0.2, B.cloud + 0.2);
    const spofPulse = fadeWindow(t, B.spof + 0.3, B.runTwo, 0.3) * pulse(t, 0.7);
    this.lb.setStatus(
      lbDown ? COLORS.failure : new THREE.Color(COLORS.healthy).lerp(new THREE.Color(COLORS.failure), spofPulse),
      lbDown ? 2.6 : 2.2,
    );
    this.lbStandby.setAppear(life(t, B.runTwo + 0.4, B.database - 0.4));
    const standbyActive = t >= this.failoverAt() + 0.3;
    this.lbStandby.setStatus(standbyActive ? COLORS.healthy : COLORS.serverDark, standbyActive ? 2.2 : 0.6);

    // ---- Servers ----------------------------------------------------------
    // Section 1: one server (index 1); the others slide out of it on "scaling out".
    const out = ramp(t, B.scaleOut + 0.4, B.scaleOut + 2.2);
    this.servers.forEach((s, i) => {
      if (i === 1) s.setAppear(life(t, B.shop + 2.7));
      else if (i === 3) s.setAppear(life(t, B.autoscale + 0.8, B.s4 + 0.2));
      else {
        // Server 1 is swapped for a new version during the deploy beat.
        if (i === 0 && within(t, B.draining + 5.6, B.draining + 6.6)) s.setAppear(1 - progress(t, B.draining + 5.6, B.draining + 6.2));
        else if (i === 0 && t >= B.draining + 6.6 && t < B.s4) s.setAppear(life(t, B.draining + 6.6));
        else s.setAppear(life(t, B.scaleOut + 0.4));
        if (t < B.s2) s.group.position.copy(POS.servers[1]).lerp(POS.servers[i], easeInOut(out));
        else s.group.position.copy(POS.servers[i]);
      }
    });
    // Scale up: the single server grows to the ceiling, then back.
    const grow = ramp(t, B.scaleUp + 0.6, B.scaleUp + 3.2) * (1 - ramp(t, B.scaleOut, B.scaleOut + 0.8));
    this.servers[1].group.scale.y *= 1 + 0.9 * grow;
    // Weighted demo: server 3 is the "bigger" one.
    const big = fadeWindow(t, B.weighted + 0.1, B.leastConn - 0.1, 0.4);
    this.servers[2].group.scale.multiplyScalar(1 + 0.3 * big);
    this.ceiling.visible = grow > 0.01;
    this.ceiling.material.opacity = grow;

    this.servers.forEach((s, i) => s.setStatus(...this.serverStatus(t, i)));

    // Database & session store.
    this.database.setAppear(life(t, B.database + 0.3));
    const dbLoad = ramp(t, B.database + 2, B.dbNotFaster + 1);
    this.database.setStatus(new THREE.Color(COLORS.healthy).lerp(new THREE.Color(COLORS.warning), clamp(dbLoad * 2)).lerp(new THREE.Color(COLORS.failure), clamp(dbLoad * 2 - 1)));
    this.store.setAppear(life(t, B.store + 0.4, B.spof - 0.3));

    // Carts: in server 1's memory, lost when it dies, then safe in the store.
    const cartsLost = this.stickyCrashAt();
    this.carts.forEach((c, i) => {
      const inServer = life(t, B.sticky + 1 + i * 0.3, cartsLost + i * 0.08, 0.3);
      const inStore = life(t, B.store + 1.4 + i * 0.2, B.spof - 0.3, 0.35);
      c.setAppear(Math.max(inServer, inStore));
      const base = inStore > 0 ? POS.store : POS.servers[0];
      c.group.position.copy(base).add(new THREE.Vector3((i - 1) * 0.42, inStore > 0 ? 1.65 : 1.95, 0));
    });

    // Queue in front of the single server (section 1 + hook).
    const queueLen = this.queueLength(t);
    this.queue.setLength(queueLen, queueLen > 8 ? COLORS.failure : queueLen > 4 ? COLORS.warning : COLORS.network);
    this.queue.group.visible = queueLen > 0.01;

    // Frames.
    this.poolFrame.visible = within(t, B.pool, B.picks + 3);
    this.poolFrame.material.opacity = 0.8 * fadeWindow(t, B.pool, B.picks + 3, 0.4);
    const zoneAlpha = fadeWindow(t, B.cloud + 0.3, B.database, 0.4);
    this.zones.forEach((z) => {
      z.visible = zoneAlpha > 0;
      z.material.opacity = zoneAlpha;
    });

    // ---- Arcs -------------------------------------------------------------
    const direct = fadeWindow(t, B.shop + 3, B.question + 0.6, 0.4);
    this.userDirect.forEach((a) => a.show(0.45 * direct));
    const viaStandby = within(t, this.failoverAt(), B.cloud + 0.4);
    const zonesOn = within(t, B.cloud + 0.4, B.database);
    this.userToLb.forEach((a, i) => {
      const on = lbOn && !s1 ? ramp(t, B.job + 0.3, B.job + 1.2) : 0;
      const dimmed = viaStandby || (zonesOn && i === 2) ? 0.08 : 1;
      a.show(0.5 * on * dimmed);
      a.setColor(within(t, B.spof + 0.3, this.failoverAt()) ? COLORS.warning : COLORS.network);
    });
    this.userToStandby.forEach((a, i) => a.show(0.5 * (viaStandby ? ramp(t, this.failoverAt(), this.failoverAt() + 0.6) : zonesOn && i === 2 ? zoneAlpha : 0)));
    // Question beat: dashed-looking faint fork from where the LB will be.
    const fork = fadeWindow(t, B.question + 0.4, B.job + 0.4, 0.4);
    this.lbToServer.forEach((a, i) => {
      if (i === 3) {
        a.show(0.45 * life(t, B.autoscale + 4.5, B.s4 + 0.2));
        return;
      }
      const base = lbOn ? ramp(t, B.job + 0.6, B.job + 1.6) : fork * 0.6;
      const hiddenDim = 1 - 0.5 * fadeWindow(t, B.hidden, B.pool, 0.4);
      const downDim = this.isDown(t, i) ? 0.12 : 1;
      a.show(0.45 * base * hiddenDim * downDim * (viaStandby ? 0.1 : 1));
      a.setColor(within(t, B.failOpen + 0.5, B.deploys) ? COLORS.warning : COLORS.network);
    });
    this.standbyToServer.forEach((a, i) => a.show(i < 3 ? 0.45 * (viaStandby ? 1 : zoneAlpha) * ramp(t, B.runTwo + 0.6, B.runTwo + 1.4) : 0));
    const dbArcs = life(t, B.database + 0.8, B.recap + 0.2);
    this.serverToDb.forEach((a) => {
      a.show(0.55 * dbArcs);
      a.setColor(COLORS.storage);
    });
    const storeArcs = life(t, B.store + 1.0, B.spof - 0.3);
    this.serverToStore.forEach((a) => {
      a.show(0.55 * storeArcs);
      a.setColor(COLORS.storage);
    });

    this.updatePackets(t);
    this.updateMascot(t);
  }

  /** Servers taken out of rotation at time t (index 3 is the autoscaled one). */
  private isDown(t: number, i: number) {
    if (i === 1 && within(t, this.unhealthyAt(), this.recoveredAt())) return true;
    if (i === 0 && within(t, B.draining + 0.4, B.draining + 7.5)) return true;
    return false;
  }

  private serverStatus(t: number, i: number): [THREE.ColorRepresentation, number] {
    // Hook / section 1: the single server overheats, then crashes.
    if (i === 1 && t < B.s2) {
      const hot = clamp((this.queueLength(t) - 2) / 8);
      if (within(t, B.crash + 0.6, B.scaleUp)) return [COLORS.failure, 0.4 + 2.4 * pulse(t, 0.5)];
      return [new THREE.Color(COLORS.healthy).lerp(new THREE.Color(COLORS.warning), clamp(hot * 2)).lerp(new THREE.Color(COLORS.failure), clamp(hot * 2 - 1)), 2.2];
    }
    // Health checks: server 2 crashes, is marked unhealthy, recovers.
    if (i === 1 && within(t, B.breaks + 0.8, this.recoveredAt())) return [COLORS.failure, 0.5 + 2 * pulse(t, 0.8)];
    if (within(t, B.failOpen + 0.5, B.deploys - 0.2) && i < 3) return [COLORS.failure, 2.2];
    if (i === 0 && within(t, B.draining + 0.4, B.draining + 5.6)) return [COLORS.warning, 2.2];
    // Sticky sessions: server 1 overloads and dies.
    if (i === 0 && within(t, B.sticky, B.store + 1.4)) {
      if (t >= this.stickyCrashAt()) return [COLORS.failure, 0.4 + 2.4 * pulse(t, 0.5)];
      const load = progress(t, B.pins, this.stickyCrashAt() - 0.5);
      return [new THREE.Color(COLORS.healthy).lerp(new THREE.Color(COLORS.warning), clamp(load * 2)).lerp(new THREE.Color(COLORS.failure), clamp(load * 2 - 1)), 2.2];
    }
    return [COLORS.healthy, 2.2];
  }

  /** Requests waiting in front of the single server (hook and section 1). */
  private queueLength(t: number) {
    const hook = clamp((t - B.spike - 0.6) * 1.6, 0, 6) * (1 - progress(t, B.fix + 0.4, B.s1));
    const growth = clamp((t - B.queue - 0.8) * 0.9, 0, 13);
    const drain = 1 - progress(t, B.crash + 0.6, B.crash + 1.4);
    return Math.max(hook, t >= B.queue ? growth * drain : 0);
  }

  private updatePackets(t: number) {
    const p = this.pool;
    p.begin();
    const blue: EmitOptions = { color: COLORS.network };
    const green: EmitOptions = { color: COLORS.healthy, reverse: true };
    const red: EmitOptions = { color: COLORS.failure, reverse: true };

    // Hook + section 1: users hit the single server directly.
    for (let u = 0; u < 3; u++) {
      p.stream(this.userDirect[u].curve, t, B.spike + 0.2 + u * 0.12, B.fix + 0.5, 0.33, 0.9, blue);
      p.stream(this.userDirect[u].curve, t, B.limits + 1 + u * 0.4, B.queue, 1.2, 1.0, blue);
      p.stream(this.userDirect[u].curve, t, B.queue + u * 0.14, B.crash + 0.6, 0.42, 1.0, blue);
      // Errors while the server is down.
      p.stream(this.userDirect[u].curve, t, B.crash + 1 + u * 0.3, B.scaleUp, 0.9, 0.8, red);
    }
    // The question: one request stops where the load balancer will be.
    const q = progress(t, B.question + 0.3, B.question + 1.6);
    if (t < B.job + 0.3) p.emit(this.userToLb[1].curve, Math.min(q, 0.98), { ...blue, size: 0.14 });

    // Health-check pulses (section 3): small dots out and back.
    if (within(t, B.checking, B.s4)) {
      for (let i = 0; i < 4; i++) {
        if (i === 3 && t < B.autoscale + 2.5) continue;
        const period = 2.4;
        const offset = i * 0.6;
        const first = Math.floor((t - B.checking - offset - 1.2) / period);
        for (let n = Math.max(0, first); n <= first + 1; n++) {
          const start = B.checking + offset + n * period;
          const ok = this.checkPasses(start + 0.6, i);
          p.travel(this.lbToServer[i].curve, t, start, 0.6, { color: COLORS.healthy, size: 0.06 });
          p.travel(this.lbToServer[i].curve, t, start + 0.6, 0.6, { color: ok ? COLORS.healthy : COLORS.failure, size: 0.07, reverse: true });
        }
      }
    }

    // Load-balanced traffic.
    for (const seg of this.segments) {
      if (t < seg.start - 0.1 || t > seg.end + 4) continue;
      seg.assignments.forEach((a, i) => {
        if (t < a.at || t > a.at + ARRIVE + a.work + 2 * BACK + 0.2) return;
        const user = seg.user ? seg.user(a, i) : a.client % 3;
        const via = typeof seg.via === 'function' ? seg.via(a) : (seg.via ?? 'lb');
        const toLb = (via === 'standby' ? this.userToStandby : this.userToLb)[user].curve;
        const toServer = (via === 'standby' ? this.standbyToServer : this.lbToServer)[a.server].curve;
        const color = seg.color ? seg.color(a) : COLORS.network;
        const fail = seg.failing?.(a) ?? false;
        p.travel(toLb, t, a.at, TO_LB, { color });
        p.travel(toServer, t, a.at + TO_LB, TO_SERVER, { color });
        const back = a.at + ARRIVE + a.work;
        p.travel(toServer, t, back, BACK, fail ? red : green);
        p.travel(toLb, t, back + BACK, BACK, fail ? red : green);
      });
    }

    // Section 5: app servers query the database / session store.
    for (let i = 0; i < 3; i++) {
      p.stream(this.serverToDb[i].curve, t, B.database + 1.2 + i * 0.25, B.recap, 0.5, 0.8, { color: COLORS.storage });
      p.stream(this.serverToStore[i].curve, t, B.store + 1.6 + i * 0.3, B.spof - 0.4, 1.0, 0.7, { color: COLORS.storage, size: 0.08 });
    }
    p.end();
  }

  /** Whether the health check reaching server i at time `arrive` passes. */
  private checkPasses(arrive: number, i: number) {
    if (within(arrive, B.failOpen + 0.5, B.deploys - 0.2) && i < 3) return false;
    if (i === 1 && within(arrive, B.breaks + 0.8, B.recovers + 0.2)) return false;
    return true;
  }

  /** The mascot is user 1's request during the sticky-session beat. */
  private updateMascot(t: number) {
    const m = this.mascot;
    const start = B.pins + 0.4;
    const lap = 3.2;
    const end = this.stickyCrashAt() + 0.4;
    const appear = Math.min(progress(t, start - 0.3, start), 1 - progress(t, end, end + 0.4));
    m.group.visible = appear > 0.001;
    if (!m.group.visible) return;
    // Each lap: user → load balancer → server 1, then a quick hop back.
    const k = ((t - start) % lap) / lap;
    const leg1 = this.userToLb[1].curve;
    const leg2 = this.lbToServer[0].curve;
    const pos = k < 0.45 ? leg1.getPointAt(easeInOut(k / 0.45)) : k < 0.9 ? leg2.getPointAt(easeInOut((k - 0.45) / 0.45)) : leg2.getPointAt(1);
    m.group.position.copy(pos);
    m.group.scale.setScalar(0.6 * Math.max(0.001, appear));
    const ahead = (k < 0.45 ? leg1 : leg2).getTangentAt(clamp(k < 0.45 ? k / 0.45 : (k - 0.45) / 0.45, 0.01, 0.99));
    m.group.rotation.set(0, Math.atan2(ahead.x, ahead.z) * 0.55, 0);
    m.apply(poseRun(t, 9), t);
  }

  /** Beside server i (to its right), where counters, badges and meters go. */
  private side(i: number, y: number) {
    return POS.servers[i].clone().add(new THREE.Vector3(1.5, y, 0));
  }

  /** Where the mascot is (for its cookie badge). */
  mascotAnchor() {
    return this.mascot.group.visible ? this.mascot.group.position.clone().setY(this.mascot.group.position.y + 1.0) : null;
  }

  drawOverlay(hud: Hud, t: number) {
    const L = this.labels;
    const stage = fadeWindow(t, B.shop + 3, B.recap + 0.2, 0.4);

    // Users: IPs for hashing and Layer 4.
    const showIps = within(t, B.hash, B.defaults + 0.5) || within(t, B.l4, B.l7);
    L.users.forEach((label, i) =>
      label.draw(hud, stage * (i === 1 || t >= B.spike ? 1 : 0), { text: showIps ? USER_IPS[i] : label.text, mono: showIps, size: showIps ? 20 : 22 }),
    );

    // Load balancers.
    const lbAlpha = Math.max(fadeWindow(t, B.fix + 0.8, B.s1 - 0.6, 0.3), fadeWindow(t, B.job + 0.3, B.recap + 0.2, 0.4));
    let lbText = 'Load balancer';
    let lbSub: string | undefined;
    if (within(t, B.address, B.hidden)) lbSub = 'shop.example · 203.0.113.10';
    if (within(t, B.tls, B.xff)) lbSub = 'TLS ends here';
    if (within(t, B.spof + 0.3, this.failoverAt())) lbSub = 'single point of failure';
    if (within(t, this.failoverAt() - 0.2, B.cloud + 0.2)) lbSub = 'down';
    if (within(t, B.runTwo + 0.4, B.cloud)) lbText = this.failoverAt() <= t ? 'Load balancer' : 'Active';
    if (within(t, B.cloud + 0.4, B.database)) lbText = 'LB node · Zone A';
    L.lb.draw(hud, lbAlpha, { text: lbText, sub: lbSub, accent: lbSub === 'down' || lbSub === 'single point of failure' ? CSS.failure : CSS.network });
    const standbyText = within(t, B.cloud + 0.4, B.database) ? 'LB node · Zone B' : t >= this.failoverAt() ? 'Now active' : 'Standby';
    L.standby.draw(hud, fadeWindow(t, B.runTwo + 0.6, B.database - 0.4, 0.4), { text: standbyText, accent: t >= this.failoverAt() ? CSS.healthy : CSS.network });

    // Virtual IP pill: on the active LB, hops to the standby on failover.
    const vipAlpha = fadeWindow(t, B.runTwo + 1.2, B.cloud + 0.2, 0.4);
    if (vipAlpha > 0) {
      const hop = ramp(t, this.failoverAt(), this.failoverAt() + 1.0);
      const from = POS.lb.clone().setY(1.9);
      const to = POS.lbStandby.clone().setY(1.9);
      hud.label(from.lerp(to, hop), 'virtual IP 203.0.113.10', { alpha: vipAlpha, size: 22, mono: true, accent: CSS.healthy, offsetY: 0 });
    }

    // Servers.
    const l7 = within(t, B.pools, B.s5);
    const poolNames = ['shop pool', 'API pool', 'images pool'];
    L.servers.forEach((label, i) => {
      const a = i === 3 ? fadeWindow(t, B.autoscale + 1, B.s4, 0.4) : stage * (i === 1 || t >= B.scaleOut + 1 ? 1 : 0);
      let text = t < B.scaleOut + 1 && i === 1 ? 'Server' : `Server ${i + 1}`;
      let sub: string | undefined;
      if (l7 && i < 3) text = poolNames[i];
      if (i === 1 && within(t, this.unhealthyAt(), this.recoveredAt())) sub = 'unhealthy';
      if (i === 0 && within(t, B.draining + 0.4, B.draining + 5.6)) sub = 'draining';
      if (i === 0 && within(t, B.draining + 6.6, B.autoscale + 2)) sub = 'new version';
      if (i === 3 && t < B.autoscale + 4.5) sub = 'health check…';
      if (i === 3 && t >= B.autoscale + 4.5) sub = 'in rotation';
      if (i === 1 && t < B.s2) sub = 'shop.example';
      label.draw(hud, a, { text, sub });
    });
    L.database.draw(hud, fadeWindow(t, B.database + 0.5, B.recap + 0.2, 0.4), { sub: t >= B.dbNotFaster ? 'still one machine' : undefined });
    L.store.draw(hud, fadeWindow(t, B.store + 0.6, B.spof - 0.3, 0.4), { sub: 'carts live here now' });

    // ---- Hook & section 1 -------------------------------------------------
    const server1 = POS.servers[1].clone().setY(1.6);
    hud.badge(server1, 'SALE', CSS.warning, fadeWindow(t, B.shop + 3.2, B.fix + 0.4, 0.3), 0.9, 70);
    const gauges = fadeWindow(t, B.limits + 0.3, B.crash + 0.6, 0.4);
    if (gauges > 0) {
      const load = clamp(0.35 + (this.queueLength(t) / 12) * 0.65);
      const top = hud.project(POS.servers[1].clone().setY(1.7));
      ['CPU', 'Memory', 'Connections'].forEach((name, i) => {
        const v = clamp(load * [1, 0.85, 1.1][i]);
        const y = top.y - 150 + i * 46;
        const x = top.x - 380;
        hud.roundRect(x - 10, y - 18, 290, 38, 10, CSS.panel, CSS.panelBorder, gauges, 1.5);
        hud.text(name, x + 4, y + 1, { size: 18, weight: 600, color: CSS.muted, alpha: gauges });
        hud.roundRect(x + 120, y - 6, 150, 12, 6, 'rgba(148,163,184,0.25)', undefined, gauges);
        hud.roundRect(x + 120, y - 6, Math.max(12, 150 * v), 12, 6, v < 0.6 ? CSS.healthy : v < 0.85 ? CSS.warning : CSS.failure, undefined, gauges);
      });
    }
    const latencyAlpha = fadeWindow(t, B.queue + 1, B.crash + 0.6, 0.4);
    if (latencyAlpha > 0) {
      const seconds = 0.2 + this.queueLength(t) * 0.28;
      drawCounter(hud, POS.servers[1].clone().setX(POS.servers[1].x - 2.4).setY(1.2), `response time ${seconds.toFixed(1)} s`, latencyAlpha, seconds > 2 ? CSS.failure : seconds > 1 ? CSS.warning : CSS.network, 30);
    }
    hud.badge(server1, 'DOWN', CSS.failure, fadeWindow(t, B.crash + 0.8, B.scaleUp + 0.2, 0.3), 1, 80);
    hud.label(POS.servers[1].clone().setY(2.8).setX(POS.servers[1].x + 1.1), 'biggest size', {
      alpha: fadeWindow(t, B.scaleUp + 3, B.scaleOut, 0.3),
      size: 20,
      accent: CSS.warning,
      offsetY: 0,
    });
    hud.badge(POS.lb.clone().setY(1.2), '?', CSS.network, fadeWindow(t, B.question + 1.6, B.job, 0.3), 1.2, 30);

    // ---- Section 2 --------------------------------------------------------
    hud.label(POS.servers[1].clone().setY(2.3).setX(POS.servers[1].x + 1.6), 'hidden from users', {
      alpha: fadeWindow(t, B.hidden + 0.8, B.pool, 0.4),
      size: 20,
      offsetY: 0,
    });
    hud.label(POS.servers[0].clone().setZ(-4.2).setY(0.1), 'Pool · AWS: target group', {
      alpha: fadeWindow(t, B.pool + 0.3, B.picks + 3, 0.4),
      size: 22,
      accent: CSS.edge,
      offsetY: 0,
    });

    // Per-server counters during the algorithm demos.
    const demo = (seg: Segment | undefined, start: number, end: number, mode: 'total' | 'active') => {
      if (!seg) return;
      const alpha = fadeWindow(t, start, end, 0.3);
      if (alpha <= 0) return;
      const values = mode === 'total' ? countsAt(seg.assignments, t, SERVER_COUNT, ARRIVE) : activeAt(seg.assignments, t, SERVER_COUNT, ARRIVE);
      for (let i = 0; i < 3; i++) {
        const text = mode === 'total' ? `${values[i]}` : `${values[i]} active`;
        drawCounter(hud, this.side(i, 0.9), text, alpha, CSS.network, 0);
      }
    };
    demo(this.segments[1], B.roundRobin + 0.6, B.weighted - 0.2, 'total');
    demo(this.segments[2], B.weighted + 0.6, B.leastConn - 0.2, 'total');
    demo(this.segments[3], B.leastConn + 0.5, B.hash - 0.2, 'active');
    hud.label(POS.servers[2].clone().setY(0.2).setX(POS.servers[2].x + 1.3), 'weight 2', {
      alpha: fadeWindow(t, B.weighted + 0.6, B.leastConn - 0.2, 0.3),
      size: 20,
      accent: CSS.network,
      offsetY: 0,
    });
    hud.label(POS.servers[0].clone().setY(0.1).setX(POS.servers[0].x + 1.6), 'slow request', {
      alpha: fadeWindow(t, B.leastConn + 1.6, B.hash - 0.2, 0.3),
      size: 20,
      accent: CSS.warning,
      offsetY: 0,
    });
    // Hashing: which server each client always lands on.
    const hashAlpha = fadeWindow(t, B.hash + 1.5, B.defaults + 0.3, 0.3);
    const hashTargets = [3, 1, 2];
    POS.users.forEach((u, i) => hud.label(u.clone().add(new THREE.Vector3(1.2, 0.3, 0)), `→ server ${hashTargets[i]}`, { alpha: hashAlpha, size: 20, accent: CSS.network, offsetY: 0 }));

    // ---- Section 3 --------------------------------------------------------
    hud.label(this.lbToServer[0].curve.getPointAt(0.45), 'GET /health', {
      alpha: fadeWindow(t, B.checking + 0.8, B.awsDefaults + 1, 0.3),
      size: 20,
      mono: true,
      accent: CSS.healthy,
      offsetY: 10,
    });
    const s2 = this.side(1, 0.9);
    hud.badge(s2, '✗ 1', CSS.failure, fadeWindow(t, this.unhealthyAt() - 2.6, this.unhealthyAt() - 0.1, 0.2), 0.7, 0);
    hud.badge(s2, '✗ 2 → UNHEALTHY', CSS.failure, fadeWindow(t, this.unhealthyAt(), B.staysOpen, 0.3), 0.7, 0);
    hud.badge(POS.lb.clone().setY(1.2), 'SHOP STAYS OPEN', CSS.healthy, fadeWindow(t, B.staysOpen + 0.2, B.fewFail, 0.3), 0.7, 40);
    const recover = progress(t, B.recovers + 0.6, this.recoveredAt());
    hud.badge(s2, `✓ ${Math.min(5, Math.floor(recover * 5) + 1)}/5`, CSS.healthy, fadeWindow(t, B.recovers + 0.6, this.recoveredAt() + 0.8, 0.2), 0.7, 0);
    hud.badge(POS.lb.clone().setY(1.2), 'FAIL OPEN', CSS.warning, fadeWindow(t, B.failOpen + 2.5, B.deploys - 0.2, 0.3), 0.8, 40);
    this.drawDetectionStrip(hud, t);

    // ---- Section 4 --------------------------------------------------------
    const l4Alpha = fadeWindow(t, B.l4 + 0.6, B.l7, 0.3);
    hud.label(this.userToLb[0].curve.getPointAt(0.55), 'conn A · :51234 → :443', { alpha: l4Alpha, size: 18, mono: true, accent: CSS.network, offsetY: 18 });
    hud.label(this.userToLb[2].curve.getPointAt(0.55), 'conn B · :40112 → :443', { alpha: l4Alpha, size: 18, mono: true, accent: CSS.edge, offsetY: 18, below: true });
    hud.label(POS.lb.clone().setY(1.3), 'sees: IP + port', { alpha: fadeWindow(t, B.l4 + 1.2, B.l7, 0.3), size: 20, accent: CSS.panelBorder, offsetY: 30 });
    const open = fadeWindow(t, B.l7 + 0.6, B.paths, 0.3);
    hud.label(POS.lb.clone().setY(1.3), 'GET /api/cart', { alpha: open, size: 22, mono: true, accent: CSS.network, sub: 'Host: shop.example', offsetY: 30 });
    const pathAlpha = fadeWindow(t, B.paths + 0.3, B.s5, 0.3);
    ['/', '/api/*', '/images/*'].forEach((path, i) =>
      hud.label(this.lbToServer[i].curve.getPointAt(0.6), path, { alpha: pathAlpha, size: 20, mono: true, accent: CSS.network, offsetY: 8 }),
    );
    hud.label(POS.servers[1].clone().setY(1.8), 'X-Forwarded-For: 203.0.113.7', {
      alpha: fadeWindow(t, B.xff + 1.5, B.s5, 0.3),
      size: 20,
      mono: true,
      accent: CSS.network,
      offsetY: 40,
    });

    // ---- Section 5 --------------------------------------------------------
    const anchor = this.mascotAnchor();
    if (anchor) hud.label(anchor, 'cookie: AWSALB', { alpha: fadeWindow(t, B.cookie, this.stickyCrashAt() + 0.4, 0.3), size: 18, mono: true, accent: CSS.warning, offsetY: 6 });
    hud.label(POS.servers[0].clone().setY(2.4), 'carts in memory', { alpha: fadeWindow(t, B.sticky + 1.5, this.stickyCrashAt(), 0.3), size: 20, accent: CSS.warning, offsetY: 0 });
    hud.badge(this.side(0, 0.9), 'CARTS LOST', CSS.failure, fadeWindow(t, this.stickyCrashAt() + 0.3, B.store + 0.8, 0.3), 0.8, 0);
    const stickyMeters = fadeWindow(t, B.pins + 0.5, B.store + 1.2, 0.3);
    for (let i = 0; i < 3; i++) {
      const load = i === 0 ? clamp(progress(t, B.pins, this.stickyCrashAt() - 0.5) * 1.05) : 0.08;
      drawMeter(hud, this.side(i, 0.2), load, stickyMeters, { offsetY: 0, width: 100 });
    }
    const zoneLabel = fadeWindow(t, B.zones, B.database, 0.4);
    hud.label(POS.lb.clone().setX(POS.lb.x - 2.3).setY(0.05), 'Availability Zone A', { alpha: zoneLabel, size: 18, accent: CSS.network, offsetY: 0 });
    hud.label(POS.lbStandby.clone().setX(POS.lbStandby.x - 2.3).setY(0.05), 'Availability Zone B', { alpha: zoneLabel, size: 18, accent: CSS.network, offsetY: 0 });
    const dbMeter = fadeWindow(t, B.database + 1.5, B.recap + 0.2, 0.4);
    drawMeter(hud, POS.database.clone().add(new THREE.Vector3(1.8, 0.4, 0)), ramp(t, B.database + 2, B.dbNotFaster + 1), dbMeter, { label: 'database load', offsetY: 0 });
    for (let i = 0; i < 3; i++) drawMeter(hud, this.side(i, 0.2), 0.25, dbMeter, { offsetY: 0, width: 90 });
    hud.label(POS.database.clone().setY(0.1).setZ(1.6), 'caching · read replicas', { alpha: fadeWindow(t, B.dbTools + 0.5, B.recap + 0.2, 0.3), size: 20, accent: CSS.storage, offsetY: 0, below: true });
  }

  /** "Crash → check ✗ → check ✗ → removed" strip, with failed requests in the gap. */
  private drawDetectionStrip(hud: Hud, t: number) {
    const alpha = fadeWindow(t, B.fewFail + 0.2, B.recovers + 0.2, 0.3);
    if (alpha <= 0) return;
    const x0 = 560;
    const x1 = 1360;
    const y = 180;
    hud.roundRect(x0 - 40, y - 60, x1 - x0 + 80, 130, 18, CSS.panel, CSS.panelBorder, alpha);
    hud.roundRect(x0, y - 3, x1 - x0, 6, 3, 'rgba(148,163,184,0.35)', undefined, alpha);
    const gap = ramp(t, B.fewFail + 0.4, B.fewFail + 1.6);
    hud.roundRect(x0 + 40, y - 6, (x1 - x0 - 200) * gap, 12, 6, CSS.failure, undefined, alpha * 0.8);
    const marks: Array<[number, string, string]> = [
      [x0 + 40, 'crash', CSS.failure],
      [x0 + 280, 'check ✗', CSS.failure],
      [x0 + 520, 'check ✗', CSS.failure],
      [x1 - 160, 'removed', CSS.healthy],
    ];
    for (const [x, text, color] of marks) {
      hud.roundRect(x - 9, y - 9, 18, 18, 9, color, undefined, alpha);
      hud.text(text, x, y - 32, { size: 20, weight: 700, align: 'center', color, alpha });
    }
    hud.text('requests here can fail', (x0 + 40 + x1 - 160) / 2, y + 36, { size: 20, weight: 600, color: CSS.muted, align: 'center', alpha: alpha * gap });
  }

  dispose() {
    this.pool.dispose();
    this.mascot.dispose();
    for (const n of this.nodes) n.dispose();
    for (const a of this.arcs) a.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

function within(t: number, a: number, b: number) {
  return t >= a && t < b;
}
