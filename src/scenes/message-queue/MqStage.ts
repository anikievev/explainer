import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { Label3D } from '../../components/Label3D.ts';
import { LogTape } from '../../components/LogTape.ts';
import { Mascot, poseCheer, poseIdle, poseRun } from '../../components/Mascot.ts';
import {
  createDeadLetterBin,
  createFileCube,
  createLoadBalancer,
  createOriginServer,
  createQueueBroker,
  createUser,
  createWorker,
  type NodeMesh,
} from '../../components/NodeMesh.ts';
import { drawCounter, drawMeter } from '../../components/Overlays.ts';
import { PacketPool, type EmitOptions } from '../../components/PacketPool.ts';
import { RequestQueue } from '../../components/RequestQueue.ts';
import { clamp, easeInOut, fadeWindow, progress, pulse, ramp } from '../../components/Timeline.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { B } from './beats.ts';
import { POISON_ID, WORKER4_JOINS, sectionFive, sectionFour, sectionThree, sectionTwo, type Flow } from './traffic.ts';

const NODE_SCALE = 1.9;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const POS = {
  user: V(-9.2, 0, 0),
  lb: V(-7, 0, 0),
  /** Index 1 is the checkout server the episode follows; 0 and 2 only appear in the hook. */
  checkout: [V(-4.8, 0, -2.4), V(-4.8, 0, 0), V(-4.8, 0, 2.4)],
  services: [V(2, 0, -3.3), V(2, 0, -1.1), V(2, 0, 1.1), V(2, 0, 3.3)],
  queue: V(-0.9, 0, 0),
  queueIn: V(-2.6, 0.46, 0),
  queueOut: V(0.8, 0.46, 0),
  workers: [V(3.6, 0, -2.4), V(3.6, 0, 0), V(3.6, 0, 2.4), V(3.6, 0, 4.8)],
  payment: V(7.6, 0, -1.4),
  email: V(7.6, 0, 1.4),
  dlq: V(-0.9, 0, 3.3),
  log: V(-2.6, 0, -8),
  teams: [V(6.4, 0, -9.8), V(6.4, 0, -8), V(6.4, 0, -6.2)],
};

const SERVICE_NAMES = ['Payment', 'Stock', 'Email', 'Invoice'];
const TEAM_NAMES = ['Email', 'Shipping', 'Analytics'];
/** Illustrative per-step delays (ms), labelled "example" on screen. */
const STEP_MS = [300, 200, 900, 600];
const LOG_SLOTS = 16;
/** Order card positions (design px), chosen per shot to stay clear of the nodes. */
const CARD_TOP_LEFT: [number, number] = [60, 120];
const CARD_TOP_RIGHT: [number, number] = [1440, 150];
const CARD_MID_LEFT: [number, number] = [60, 560];
const PARTITION_Z = [-0.7, 0, 0.7];
/** Customer keys in the log: blue, cyan, indigo. */
const KEY_COLORS = [COLORS.network, COLORS.edge, 0x818cf8];

const life = (t: number, inAt: number, outAt = Infinity, dur = 0.5) =>
  outAt === Infinity ? progress(t, inAt, inAt + dur) : Math.min(progress(t, inAt, inAt + dur), 1 - progress(t, outAt, outAt + dur));
const at = (p: THREE.Vector3, y = 0.7) => p.clone().setY(y);
const within = (t: number, a: number, b: number) => t >= a && t < b;
const mix = (a: number, b: number, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(k));

/** One synchronous checkout: the server calls each service in turn. */
interface Chain {
  start: number;
  steps: number[];
  /** Index of the service that fails (the chain stops there). */
  failAt?: number;
  ms?: number[];
}

/** Every visual beat of the episode. */
export class MqStage {
  readonly group = new THREE.Group();
  private readonly pool = new PacketPool(170, 0.1);
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly arcs: ArcPath[] = [];

  private readonly user = createUser();
  private readonly lb = createLoadBalancer();
  private readonly checkout = POS.checkout.map(() => createOriginServer(false));
  private readonly services = POS.services.map(() => createOriginServer(false));
  private readonly queue = createQueueBroker();
  private readonly waiting = new RequestQueue(24, V(-1, 0, 0), 0.22);
  private readonly workers = POS.workers.map(() => createWorker());
  private readonly payment = createOriginServer(false);
  private readonly email = createOriginServer(false);
  private readonly dlq = createDeadLetterBin();
  private readonly deadCubes = [0, 1, 2, 3, 4].map(() => createFileCube(COLORS.failure));
  private readonly ghost = createFileCube(COLORS.network);
  private readonly teams = POS.teams.map(() => createOriginServer(false));
  private readonly tape = new LogTape(LOG_SLOTS);
  private readonly partitions = PARTITION_Z.map(() => new LogTape(LOG_SLOTS));
  private readonly mascot = new Mascot();
  private readonly nodes: NodeMesh[];

  private readonly userToLb: ArcPath;
  private readonly lbToCheckout: ArcPath[];
  private readonly userToCheckout: ArcPath;
  private readonly checkoutToService: ArcPath[];
  private readonly checkoutToQueue: ArcPath;
  private readonly queueToWorker: ArcPath[];
  private readonly workerToPayment: ArcPath[];
  private readonly workerToEmail: ArcPath[];
  private readonly queueToDlq: ArcPath;
  private readonly checkoutToLog: ArcPath;
  private readonly logToTeam: ArcPath[];

  private readonly flows: Flow[];
  private readonly chains: { hook: Chain; inARow: Chain; slow: Chain; down: Chain };
  private readonly labels: {
    user: Label3D;
    lb: Label3D;
    checkout: Label3D;
    services: Label3D[];
    queue: Label3D;
    workers: Label3D[];
    payment: Label3D;
    email: Label3D;
    dlq: Label3D;
    teams: Label3D[];
  };

  constructor() {
    const floorGeo = new THREE.CircleGeometry(80, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    const grid = new THREE.GridHelper(160, 160, COLORS.oceanGrid, COLORS.oceanGrid);
    this.group.add(floor, grid, this.pool.group, this.waiting.group, this.mascot.group, this.tape.group, ...this.partitions.map((p) => p.group));
    this.disposables.push(floorGeo, floorMat, grid.geometry, grid.material as THREE.Material, this.waiting, this.tape, ...this.partitions);

    const place = (node: NodeMesh, pos: THREE.Vector3, scale = NODE_SCALE) => {
      node.group.position.copy(pos);
      node.setBaseScale(scale);
      this.group.add(node.group);
      return node;
    };
    place(this.user, POS.user);
    place(this.lb, POS.lb, NODE_SCALE * 1.1);
    this.checkout.forEach((c, i) => place(c, POS.checkout[i]));
    this.services.forEach((s, i) => place(s, POS.services[i], NODE_SCALE * 0.8));
    place(this.queue, POS.queue, 1);
    this.workers.forEach((w, i) => place(w, POS.workers[i]));
    place(this.payment, POS.payment, NODE_SCALE * 0.8);
    place(this.email, POS.email, NODE_SCALE * 0.8);
    place(this.dlq, POS.dlq, 1.3);
    this.deadCubes.forEach((c, i) => place(c, POS.dlq.clone().add(V(-0.36 + i * 0.18, 0.05, (i % 2) * 0.2 - 0.1)), 1.1));
    place(this.ghost, POS.queueOut.clone().setX(POS.queueOut.x - 0.55).setY(0.1), 1.3);
    this.teams.forEach((s, i) => place(s, POS.teams[i], NODE_SCALE * 0.8));
    this.waiting.group.position.set(POS.queueOut.x - 0.3, 0.46, 0);
    this.tape.group.position.copy(POS.log);
    this.partitions.forEach((p, i) => p.group.position.copy(POS.log).add(V(0, 0, PARTITION_Z[i])));
    this.mascot.shadowVisible = false;
    this.nodes = [this.user, this.lb, ...this.checkout, ...this.services, this.queue, ...this.workers, this.payment, this.email, this.dlq, ...this.deadCubes, this.ghost, ...this.teams];

    const arc = (from: THREE.Vector3, to: THREE.Vector3, height: number, radius = 0.03) => {
      const a = new ArcPath(from, to, { height, radius });
      this.group.add(a.mesh);
      this.arcs.push(a);
      return a;
    };
    this.userToLb = arc(at(POS.user), at(POS.lb), 0.6);
    this.lbToCheckout = POS.checkout.map((c) => arc(at(POS.lb), at(c), 0.6));
    this.userToCheckout = arc(at(POS.user), at(POS.checkout[1]), 0.8);
    this.checkoutToService = POS.services.map((s) => arc(at(POS.checkout[1]), at(s, 0.5), 1.0));
    this.checkoutToQueue = arc(at(POS.checkout[1]), POS.queueIn, 0.5);
    this.queueToWorker = POS.workers.map((w) => arc(POS.queueOut, at(w, 0.5), 0.6));
    this.workerToPayment = POS.workers.slice(0, 3).map((w) => arc(at(w, 0.5), at(POS.payment, 0.5), 0.7, 0.025));
    this.workerToEmail = POS.workers.slice(0, 3).map((w) => arc(at(w, 0.5), at(POS.email, 0.5), 0.7, 0.025));
    this.queueToDlq = arc(POS.queue.clone().setY(0.5), at(POS.dlq, 0.5), 0.9);
    this.checkoutToLog = arc(at(POS.checkout[1]), at(POS.log, 0.3), 1.2);
    this.logToTeam = POS.teams.map((s) => arc(at(POS.log, 0.3).setX(POS.log.x + LOG_SLOTS * 0.36), at(s, 0.5), 0.8));

    this.flows = [sectionTwo(), sectionThree(), sectionFour(), sectionFive()];
    this.chains = {
      hook: { start: B.click + 0.6, steps: [1.8, 1.8, 1.8], failAt: 2 },
      inARow: { start: B.inARow + 0.3, steps: [1.5, 1.5, 1.5, 1.5], ms: STEP_MS },
      slow: { start: B.slow + 0.2, steps: [0.7, 0.7, 2.0, 0.6], ms: [300, 200, 3500, 600] },
      down: { start: B.down + 0.4, steps: [1.0, 1.0, 1.2], failAt: 2 },
    };

    this.labels = {
      user: new Label3D(this.user.top, 'You', { size: 22 }),
      lb: new Label3D(this.lb.top, 'Load balancer', { size: 22, accent: CSS.network }),
      checkout: new Label3D(this.checkout[1].top, 'Checkout server', { size: 24 }),
      services: this.services.map((s, i) => new Label3D(s.top, SERVICE_NAMES[i], { size: 22, offset: [0.45, -0.4, 0], offsetY: 0 })),
      queue: new Label3D(this.queue.top, 'Message queue', { size: 26, accent: CSS.storage }),
      workers: this.workers.map((w, i) => new Label3D(w.top, `Worker ${i + 1}`, { size: 20, offset: [0.55, -0.35, 0], offsetY: 0 })),
      payment: new Label3D(this.payment.top, 'Payment', { size: 22 }),
      email: new Label3D(this.email.top, 'Email service', { size: 22 }),
      dlq: new Label3D(this.dlq.top, 'Dead-letter queue', { size: 22, accent: CSS.failure, below: true, offset: [0, -0.5, 0.5], offsetY: 10 }),
      teams: this.teams.map((s, i) => new Label3D(s.top, TEAM_NAMES[i], { size: 22, offset: [0.5, -0.4, 0], offsetY: 0 })),
    };
  }

  // ---- Timing helpers -------------------------------------------------------

  /** Start/end of each service call in a chain (the chain stops at `failAt`). */
  private chainCalls(c: Chain) {
    const calls: Array<{ service: number; start: number; end: number; failed: boolean }> = [];
    let t = c.start;
    c.steps.forEach((d, i) => {
      calls.push({ service: i, start: t, end: t + d, failed: c.failAt === i });
      t += d;
    });
    return calls;
  }
  private chainEnd(c: Chain) {
    return c.start + c.steps.reduce((a, b) => a + b, 0);
  }

  private activeFlow(t: number): Flow | undefined {
    return this.flows.find((f) => t >= f.start - 1 && t < f.end + 0.5);
  }

  /** Worker 1 crashes in the crash story (section 3) and restarts later. */
  private crashedAt() {
    return B.crash + 0.8;
  }
  private restartAt() {
    return B.rabbit + 3;
  }
  /** The visibility timeout of #1042 runs out here. */
  private timerOutAt() {
    return B.crash + 3.8;
  }
  private takeAt() {
    return B.hides + 0.6;
  }

  // ---- Update ---------------------------------------------------------------

  update(t: number) {
    const hookCluster = life(t, B.lastTime + 0.3, B.click + 1.2);
    this.user.setAppear(life(t, 0.2));
    this.lb.setAppear(hookCluster);
    this.checkout.forEach((c, i) => c.setAppear(i === 1 ? life(t, 0.3) : hookCluster));
    this.checkout[1].setStatus(this.checkoutStatus(t));

    // Section 1 services (also the hook's chain).
    const servicesOn = (i: number) => life(t, B.click + 0.3 + i * 0.12, B.idea + 0.1, 0.4);
    this.services.forEach((s, i) => {
      s.setAppear(servicesOn(i));
      s.setStatus(...this.serviceStatus(t, i));
    });

    // Queue and workers.
    this.queue.setAppear(life(t, B.idea + 0.3, Infinity, 0.6));
    const workerIn = [B.idea + 0.8, B.idea + 1.0, B.moreWorkers + 0.6, WORKER4_JOINS() - 0.4];
    this.workers.forEach((w, i) => {
      let appear = life(t, workerIn[i]);
      if (i === 0 && t >= this.crashedAt() && t < this.restartAt()) appear = Math.max(0.55, 1 - progress(t, this.crashedAt(), this.crashedAt() + 0.6) * 0.45);
      w.setAppear(appear);
      w.setStatus(...this.workerStatus(t, i));
    });

    const flow = this.activeFlow(t);
    const depth = flow ? flow.sim.depthAt(t) : 0;
    this.waiting.setLength(depth, depth > 11 ? COLORS.failure : depth > 6 ? COLORS.warning : COLORS.network);
    this.waiting.group.visible = depth > 0.01 && t >= B.idea;

    // Downstream services.
    this.email.setAppear(life(t, B.emailDown + 0.2, B.s3 - 0.3));
    this.email.setStatus(within(t, B.emailDown + 1, B.emailBack + 0.6) ? COLORS.failure : COLORS.healthy, within(t, B.emailDown + 1, B.emailBack + 0.6) ? 0.5 + 2 * pulse(t, 0.7) : 2.2);
    this.payment.setAppear(life(t, B.twice + 0.2, B.poison - 0.2));

    // Dead-letter queue.
    this.dlq.setAppear(life(t, B.dlq + 0.2));
    const dead = this.flows[1].sim.dead;
    this.deadCubes.forEach((c, i) => {
      // Cube 0: the poison message from section 3. Cubes 1-4: failed orders piling up in the trap.
      const inAt = i === 0 ? (dead[0]?.at ?? Infinity) + 0.8 : B.dlqTrap + 0.6 + (i - 1) * 0.5;
      c.setAppear(life(t, inAt, this.expireAt(), 0.35));
    });
    // "Hidden" message #1041 during the happy path.
    this.ghost.setAppear(life(t, B.s3 - 0.4, B.deletes + 0.9, 0.3));
    this.ghost.setStatus(t >= this.takeAt() ? COLORS.serverDark : COLORS.network, t >= this.takeAt() ? 0.4 : 1.2);

    // Log (section 4).
    const tapeOn = fadeWindow(t, B.kafka + 0.3, B.partitions + 0.6, 0.5);
    const events = this.logEvents(t);
    this.tape.update(events, tapeOn, (i) => KEY_COLORS[i % 3]);
    const partsOn = fadeWindow(t, B.partitions + 0.2, B.s5 - 0.2, 0.5);
    this.partitions.forEach((p, r) => p.update(events / 3 + 1, partsOn, () => KEY_COLORS[r]));
    this.teams.forEach((s, i) => s.setAppear(life(t, B.teams + 0.4 + i * 0.2, B.s5 - 0.3)));

    // ---- Arcs ---------------------------------------------------------------
    this.userToLb.show(0.5 * hookCluster);
    this.lbToCheckout.forEach((a) => a.show(0.45 * hookCluster));
    this.userToCheckout.show(0.5 * life(t, B.click, B.next));
    this.checkoutToService.forEach((a, i) => a.show(0.45 * servicesOn(i)));
    const queueArcs = life(t, B.idea + 0.6, Infinity, 0.6);
    this.checkoutToQueue.show(0.5 * queueArcs);
    this.checkoutToQueue.setColor(COLORS.network);
    this.queueToWorker.forEach((a, i) => a.show(0.45 * Math.min(queueArcs, life(t, workerIn[i] + 0.2))));
    this.workerToEmail.forEach((a) => {
      a.show(0.4 * life(t, B.emailDown + 0.4, B.s3 - 0.3));
      a.setColor(within(t, B.emailDown + 1, B.emailBack + 0.6) ? COLORS.failure : COLORS.network);
    });
    this.workerToPayment.forEach((a) => a.show(0.4 * life(t, B.twice + 0.4, B.poison - 0.2)));
    this.queueToDlq.show(0.45 * life(t, B.dlq + 0.3));
    this.queueToDlq.setColor(COLORS.failure);
    this.checkoutToLog.show(0.45 * fadeWindow(t, B.kafka + 0.4, B.s5 - 0.2, 0.5));
    this.logToTeam.forEach((a, i) => a.show(0.45 * fadeWindow(t, B.keeps + 0.3 + i * 0.1, B.s5 - 0.2, 0.5) * (i === 1 ? 0.5 : 1)));

    this.updatePackets(t, flow);
    this.updateMascot(t);
  }

  /** Events appended to the log so far (fractional). */
  private logEvents(t: number) {
    return clamp((t - B.kafka - 0.8) * 1.4, 0, LOG_SLOTS);
  }

  /** Failed orders in the dead-letter queue expire ("deleted after 4 days"). */
  private expireAt() {
    return B.silence + 5.6;
  }

  private checkoutStatus(t: number): THREE.ColorRepresentation {
    if (within(t, B.spike + 0.3, B.question + 0.5)) return mix(COLORS.warning, COLORS.failure, pulse(t, 0.6));
    return COLORS.healthy;
  }

  private serviceStatus(t: number, i: number): [THREE.ColorRepresentation, number] {
    // Sale spike: everything is hit at once.
    if (within(t, B.spike + 0.4, B.idea)) return [mix(COLORS.warning, COLORS.failure, pulse(t + i * 0.2, 0.7)), 2.2];
    for (const c of [this.chains.hook, this.chains.inARow, this.chains.slow, this.chains.down]) {
      for (const call of this.chainCalls(c)) {
        if (call.service !== i) continue;
        if (call.failed && within(t, call.start + 0.4, (c === this.chains.hook ? B.fix : B.spike) + 0.2)) return [COLORS.failure, 0.5 + 2 * pulse(t, 0.6)];
        if (within(t, call.start, call.end)) return [c === this.chains.slow && i === 2 ? COLORS.warning : COLORS.network, 2.4];
      }
    }
    return [COLORS.healthy, 1.6];
  }

  private workerStatus(t: number, i: number): [THREE.ColorRepresentation, number] {
    if (i === 0 && within(t, this.crashedAt(), this.restartAt())) return [COLORS.failure, 0.4 + 2.2 * pulse(t, 0.6)];
    // Scripted crash story: worker 1 holds #1042, worker 2 holds #1041, then #1042.
    if (within(t, this.takeAt(), B.rabbit)) {
      if (i === 0 && t < this.crashedAt()) return [COLORS.network, 2.4];
      if (i === 1 && (t < B.deletes + 0.5 || within(t, B.retry + 1.4, B.retry + 4))) return [COLORS.network, 2.4];
      return [COLORS.healthy, 1.4];
    }
    const flow = this.activeFlow(t);
    if (flow) {
      if (within(t, B.emailDown + 1, B.emailBack + 0.6) && i < 3) return [COLORS.warning, 1.8];
      const job = flow.sim.deliveries.find((d) => d.worker === i && t >= d.start && t < d.end);
      if (job) return [job.id === POISON_ID ? COLORS.failure : COLORS.network, 2.4];
    }
    return [COLORS.healthy, 1.4];
  }

  private updatePackets(t: number, flow: Flow | undefined) {
    const p = this.pool;
    p.begin();
    const blue: EmitOptions = { color: COLORS.network };
    const green: EmitOptions = { color: COLORS.healthy, reverse: true };
    const red: EmitOptions = { color: COLORS.failure, reverse: true };

    // Hook: episode 2 recap traffic through the load balancer.
    for (let i = 0; i < 3; i++) {
      p.stream(this.userToLb.curve, t, B.lastTime + 0.6 + i * 0.25, B.click - 0.3, 0.75, 0.6, blue);
      p.stream(this.lbToCheckout[i].curve, t, B.lastTime + 1.2 + i * 0.25, B.click + 0.3, 0.75 * 3, 0.6, blue);
    }

    // Synchronous chains (hook + section 1).
    const chain = (c: Chain, requestAt: number) => {
      p.travel(this.userToCheckout.curve, t, requestAt, 0.5, { ...blue, size: 0.13 });
      for (const call of this.chainCalls(c)) {
        const curve = this.checkoutToService[call.service].curve;
        p.travel(curve, t, call.start, 0.35, blue);
        if (call.failed) {
          p.travel(curve, t, call.start + 0.6, 0.35, red);
          p.travel(this.userToCheckout.curve, t, call.start + 0.95, 0.5, { ...red, size: 0.13 });
          break;
        }
        p.travel(curve, t, call.end - 0.35, 0.35, green);
      }
      if (c.failAt === undefined) p.travel(this.userToCheckout.curve, t, this.chainEnd(c), 0.5, { ...green, size: 0.13 });
    };
    chain(this.chains.hook, B.click + 0.1);
    chain(this.chains.inARow, B.inARow - 0.2);
    chain(this.chains.slow, B.slow - 0.3);
    chain(this.chains.down, B.down - 0.1);
    // The sale: every service at once.
    for (let i = 0; i < 4; i++) p.stream(this.checkoutToService[i].curve, t, B.spike + 0.3 + i * 0.07, B.question, 0.28, 0.5, blue);
    p.stream(this.userToCheckout.curve, t, B.spike, B.question, 0.2, 0.5, blue);

    // Section 2: #1042's "order received" reply.
    p.travel(this.userToCheckout.curve, t, B.drops + 1.6, 0.6, { ...green, size: 0.14 });

    // Queue traffic from the simulations.
    if (flow) {
      for (const m of flow.messages) {
        if (m.at < flow.start || m.at > flow.end) continue;
        p.travel(this.checkoutToQueue.curve, t, m.at - 0.5, 0.5, m.poison ? { color: COLORS.failure } : blue);
        if (m.at - 0.5 <= t && t < m.at) p.travel(this.userToCheckout.curve, t, m.at - 1.0, 0.5, { ...blue, size: 0.08 });
      }
      for (const d of flow.sim.deliveries) {
        if (t < d.start || t > d.end + 1) continue;
        const poison = d.id === POISON_ID;
        p.travel(this.queueToWorker[d.worker].curve, t, d.start, 0.45, poison ? { color: COLORS.failure } : blue);
        if (d.outcome === 'failed') p.travel(this.queueToWorker[d.worker].curve, t, d.end, 0.45, red);
        // Email jobs call the email service while it is on stage.
        if (d.worker < 3 && d.outcome === 'done' && within(d.start, B.emailDown + 0.4, B.s3 - 0.5)) {
          p.travel(this.workerToEmail[d.worker].curve, t, d.start + 0.45, 0.35, { color: COLORS.network, size: 0.07 });
        }
      }
      for (const dl of flow.sim.dead) p.travel(this.queueToDlq.curve, t, dl.at, 0.8, { color: COLORS.failure, size: 0.14 });
    }

    // Section 3 script: #1041 to worker 2, #1042 (the mascot's copy) to worker 1.
    p.travel(this.queueToWorker[1].curve, t, this.takeAt(), 0.5, { ...blue, size: 0.13 });
    p.travel(this.queueToWorker[0].curve, t, this.takeAt() + 0.15, 0.5, { color: COLORS.storage, size: 0.15 });
    // Charged twice, then charged once.
    p.travel(this.workerToPayment[0].curve, t, B.twice + 0.6, 0.5, { color: COLORS.storage, size: 0.13 });
    p.travel(this.workerToPayment[1].curve, t, B.twice + 1.6, 0.5, { color: COLORS.storage, size: 0.13 });
    p.travel(this.workerToPayment[2].curve, t, B.example + 1.0, 0.5, { color: COLORS.storage, size: 0.13 });
    // Dead-letter trap: failed orders drop into the bin.
    for (let i = 0; i < 4; i++) p.travel(this.queueToDlq.curve, t, B.dlqTrap + 0.6 + i * 0.5 - 0.8, 0.8, { color: COLORS.failure, size: 0.12 });

    // Section 4: orders appended to the log, read by the teams at their own pace.
    p.stream(this.checkoutToLog.curve, t, B.kafka + 0.3, B.kafka + 0.3 + LOG_SLOTS / 1.4, 1 / 1.4, 0.5, blue);
    p.stream(this.logToTeam[0].curve, t, B.keeps + 0.8, B.s5 - 1, 0.7, 0.6, blue);
    p.stream(this.logToTeam[2].curve, t, B.keeps + 1.2, B.s5 - 1, 1.5, 0.6, blue);
    p.end();
  }

  /** The mascot is order #1042: queued in section 2, dropped by a crash in section 3. */
  private updateMascot(t: number) {
    const m = this.mascot;
    const front = POS.queueOut.clone().setX(POS.queueOut.x - 0.25).setY(0.06);
    const beside = POS.checkout[1].clone().add(V(1.0, 0, 1.0));
    const s2In = B.message + 0.4;
    const s2Hop = B.drops + 0.3;
    const s2Leave = B.consumers + 1.2;
    const s3In = B.s3 - 0.5;
    const s3Leave = B.retry + 0.4;

    let appear = 0;
    let pos = front.clone();
    let pose = poseIdle(t);
    let yaw = 0.5;
    let opacity = 1;
    if (within(t, s2In - 0.3, s2Leave + 1.6)) {
      appear = Math.min(progress(t, s2In - 0.3, s2In), 1 - progress(t, s2Leave + 1.1, s2Leave + 1.5));
      if (t < s2Hop) pos = beside;
      else if (t < s2Hop + 1.2) {
        pos = this.checkoutToQueue.curve.getPointAt(easeInOut(progress(t, s2Hop, s2Hop + 1.2)));
        pos.lerp(front, progress(t, s2Hop + 0.9, s2Hop + 1.2));
        pose = poseRun(t, 9);
      } else if (t < s2Leave) pos = front;
      else {
        pos = this.queueToWorker[0].curve.getPointAt(easeInOut(progress(t, s2Leave, s2Leave + 1.1)));
        pose = poseRun(t, 9);
      }
    } else if (within(t, s3In, B.rabbit + 0.6)) {
      appear = Math.min(progress(t, s3In, s3In + 0.4), 1 - progress(t, B.rabbit, B.rabbit + 0.5));
      opacity = within(t, this.takeAt(), this.timerOutAt()) ? 0.28 + 0.72 * progress(t, this.timerOutAt() - 0.4, this.timerOutAt()) : 1;
      if (t < s3Leave) pos = front;
      else if (t < s3Leave + 1.2) {
        pos = this.queueToWorker[1].curve.getPointAt(easeInOut(progress(t, s3Leave, s3Leave + 1.2)));
        pose = poseRun(t, 9);
      } else {
        pos = at(POS.workers[1], 0.62).add(V(0, 0, 0.45));
        pose = t > B.retry + 2.2 ? poseCheer(t) : poseIdle(t);
        yaw = 0.2;
      }
    }
    m.group.visible = appear > 0.001;
    if (!m.group.visible) return;
    m.group.position.copy(pos);
    m.group.scale.setScalar(0.42 * Math.max(0.001, appear));
    m.group.rotation.set(0, yaw, 0);
    m.setOpacity(opacity);
    m.apply(pose, t);
  }

  // ---- Overlay --------------------------------------------------------------

  drawOverlay(hud: Hud, t: number) {
    const L = this.labels;
    L.user.draw(hud, life(t, 0.5, B.recap));
    L.lb.draw(hud, life(t, B.lastTime + 0.6, B.click + 0.8, 0.3));
    let checkoutSub: string | undefined;
    if (within(t, B.producer + 0.2, B.s3)) checkoutSub = 'producer';
    L.checkout.draw(hud, life(t, B.lastTime + 0.6, B.recap), { sub: checkoutSub, accent: checkoutSub ? CSS.network : undefined });
    L.services.forEach((label, i) => label.draw(hud, life(t, B.click + 0.6 + i * 0.12, B.idea, 0.3)));
    let queueSub: string | undefined;
    if (within(t, B.vendors, B.s3)) queueSub = 'Amazon SQS · RabbitMQ';
    L.queue.draw(hud, life(t, B.idea + 0.6, B.recap), { sub: queueSub });
    const workerIn = [B.idea + 1.0, B.idea + 1.2, B.moreWorkers + 0.8, WORKER4_JOINS() - 0.2];
    L.workers.forEach((label, i) => {
      let sub: string | undefined;
      if (within(t, B.consumers + 0.3, B.holds + 2) && i < 2) sub = 'consumer';
      if (within(t, B.emailDown + 1, B.emailBack + 0.6) && i < 3) sub = 'waiting for email';
      if (i === 0 && within(t, this.crashedAt(), this.restartAt())) sub = 'crashed';
      if (i === 0 && within(t, this.restartAt(), this.restartAt() + 3)) sub = 'restarted';
      label.draw(hud, life(t, workerIn[i], B.recap), { sub, accent: sub === 'crashed' ? CSS.failure : undefined });
    });
    L.payment.draw(hud, life(t, B.twice + 0.4, B.poison - 0.3, 0.3));
    L.email.draw(hud, life(t, B.emailDown + 0.4, B.s3 - 0.4, 0.3), {
      sub: within(t, B.emailDown + 1, B.emailBack + 0.6) ? 'down' : undefined,
      accent: within(t, B.emailDown + 1, B.emailBack + 0.6) ? CSS.failure : undefined,
    });
    let dlqSub: string | undefined;
    if (within(t, B.dlq + 0.6, B.s4)) dlqSub = 'after 3 failed tries';
    L.dlq.draw(hud, life(t, B.dlq + 0.5, B.recap), { sub: dlqSub });
    L.teams.forEach((label, i) => label.draw(hud, life(t, B.teams + 0.6 + i * 0.2, B.s5 - 0.4, 0.3)));

    this.drawHook(hud, t);
    this.drawSectionOne(hud, t);
    this.drawSectionTwo(hud, t);
    this.drawSectionThree(hud, t);
    this.drawSectionFour(hud, t);
    this.drawSectionFive(hud, t);
  }

  /** Browser-style order card, top right. */
  private orderCard(
    hud: Hud,
    [x, y]: [number, number],
    alpha: number,
    title: string,
    status: { text: string; color: string; spinner?: boolean },
    t: number,
    note?: { text: string; color: string; alpha: number },
  ) {
    if (alpha <= 0.001) return;
    const w = 400;
    hud.roundRect(x, y, w, note ? 230 : 160, 20, CSS.panel, CSS.panelBorder, alpha);
    hud.text('shop.example/checkout', x + 24, y + 30, { size: 18, mono: true, color: CSS.muted, alpha });
    hud.text(title, x + 24, y + 72, { size: 28, weight: 700, alpha });
    hud.roundRect(x + 24, y + 98, w - 48, 42, 21, 'rgba(5,8,15,0.6)', status.color, alpha, 2);
    hud.text(status.text, x + (status.spinner ? 70 : w / 2), y + 120, { size: 22, weight: 700, color: status.color, align: status.spinner ? 'left' : 'center', alpha });
    if (status.spinner) {
      const { ctx } = hud;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = status.color;
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
    const a = fadeWindow(t, B.click + 0.2, B.fix + 0.6, 0.4);
    if (a > 0) {
      const failed = t >= B.error;
      this.orderCard(
        hud,
        CARD_TOP_LEFT,
        a,
        'Place order',
        failed ? { text: 'Something went wrong', color: CSS.failure } : { text: 'Processing…', color: CSS.network, spinner: true },
        t,
        { text: '✓ Card charged  €49.00', color: CSS.healthy, alpha: ramp(t, B.error + 1.2, B.error + 1.8) },
      );
    }
  }

  private drawSectionOne(hud: Hud, t: number) {
    // Latency counter: illustrative delays adding up per call.
    const counter = (c: Chain, from: number, to: number) => {
      const alpha = fadeWindow(t, from, to, 0.3);
      if (alpha <= 0 || !c.ms) return;
      let total = 0;
      this.chainCalls(c).forEach((call, i) => {
        total += c.ms![i] * clamp((t - call.start) / (call.end - call.start));
      });
      const seconds = total / 1000;
      const color = seconds > 3 ? CSS.failure : seconds > 1.5 ? CSS.warning : CSS.network;
      drawCounter(hud, POS.checkout[1].clone().setY(2.6), `you wait: ${seconds.toFixed(1)} s`, alpha, color, 0);
    };
    counter(this.chains.inARow, B.inARow + 0.2, B.slow - 0.1);
    counter(this.chains.slow, B.slow + 0.1, B.down);
    hud.label(POS.checkout[1].clone().setY(2.6), 'example timings', { alpha: fadeWindow(t, B.delays + 0.3, B.down, 0.3), size: 16, offsetY: -70, below: true });
    // Per-step delays beside each service.
    const steps = fadeWindow(t, B.delays + 0.2, B.slow - 0.1, 0.3);
    POS.services.forEach((s, i) => drawCounter(hud, s.clone().add(V(1.5, 0.3, 0)), `+${STEP_MS[i]} ms`, steps * ramp(t, B.delays + 0.2 + i * 0.4, B.delays + 0.6 + i * 0.4), CSS.network, 0));
    hud.badge(POS.services[2].clone().setY(1.2), 'SLOW', CSS.warning, fadeWindow(t, B.slow + 1.4, B.down + 0.2, 0.3), 0.7, 40);
    hud.badge(POS.services[2].clone().setY(1.2), 'DOWN', CSS.failure, fadeWindow(t, B.down + 2.4, B.spike, 0.3), 0.7, 40);
    hud.badge(POS.services[0].clone().setY(1.2), '✓ CHARGED', CSS.healthy, fadeWindow(t, B.down + 1.6, B.spike, 0.3), 0.6, 40);
    hud.badge(POS.user.clone().setY(1.2), '✗ ORDER FAILED', CSS.failure, fadeWindow(t, B.down + 3.4, B.spike, 0.3), 0.6, 85);
    hud.badge(POS.checkout[1].clone().setY(1.6), 'SALE', CSS.warning, fadeWindow(t, B.spike + 0.3, B.question, 0.3), 0.8, 60);
    hud.badge(POS.services[2].clone().setY(1.2), '?', CSS.network, fadeWindow(t, B.question + 0.6, B.idea + 0.2, 0.3), 1.2, 40);
  }

  private drawSectionTwo(hud: Hud, t: number) {
    const mascot = this.mascotAnchor();
    if (mascot) {
      hud.label(mascot, 'order #1042 placed', {
        alpha: fadeWindow(t, B.message + 0.6, B.consumers + 1.4, 0.3),
        size: 20,
        mono: true,
        accent: CSS.storage,
        offsetY: 8,
      });
    }
    this.orderCard(hud, CARD_TOP_RIGHT, fadeWindow(t, B.drops + 2.0, B.consumers, 0.4), 'Order #1042', { text: '✓ Order received', color: CSS.healthy }, t);
    hud.badge(POS.user.clone().setY(1.2), 'INSTANT', CSS.healthy, fadeWindow(t, B.drops + 2.2, B.producer + 1, 0.3), 0.6, 40);
    // Queue depth meter.
    const flow = this.flows[0];
    const meter = fadeWindow(t, B.rush + 0.4, B.emailBack + 4, 0.4);
    const depth = flow.sim.depthAt(t);
    drawMeter(hud, POS.queue.clone().setY(1.6).setZ(-1.2), depth / 16, meter, { label: `waiting: ${Math.round(depth)}`, offsetY: 0 });
    hud.badge(POS.workers[1].clone().setY(1.2).setX(POS.workers[1].x + 1.8), 'STEADY PACE', CSS.healthy, fadeWindow(t, B.longer + 2.5, B.drains, 0.3), 0.55, 0);
    hud.label(POS.queue.clone().setY(1.5).setZ(1.4), 'nothing is lost', { alpha: fadeWindow(t, B.emailBack + 2.5, B.vendors, 0.3), size: 20, accent: CSS.healthy, offsetY: 0, below: true });
  }

  private drawSectionThree(hud: Hud, t: number) {
    const mascot = this.mascotAnchor();
    // Visibility timeout ring around #1042 while worker 1 holds it.
    const ringAlpha = fadeWindow(t, this.takeAt() + 0.3, this.timerOutAt() + 1.2, 0.3);
    if (mascot && ringAlpha > 0) {
      const p = hud.project(mascot.clone().setY(mascot.y - 0.5));
      const left = 1 - progress(t, this.takeAt() + 0.3, this.timerOutAt());
      const { ctx } = hud;
      ctx.save();
      ctx.globalAlpha = ringAlpha;
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = left > 0 ? CSS.warning : CSS.healthy;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      ctx.stroke();
      ctx.restore();
      hud.label(mascot.clone().setY(mascot.y + 0.1), left > 0 ? `#1042 hidden · ${Math.ceil(left * 30)} s` : '#1042 visible again', {
        alpha: ringAlpha,
        size: 20,
        mono: true,
        accent: left > 0 ? CSS.warning : CSS.healthy,
        offsetY: 40,
      });
    }
    if (mascot) hud.label(mascot, '#1042', { alpha: fadeWindow(t, B.s3, this.takeAt() + 0.2, 0.3), size: 20, mono: true, accent: CSS.storage, offsetY: 8 });
    const ghostPos = this.ghost.group.position.clone().setY(0.6);
    hud.label(ghostPos, t >= this.takeAt() ? '#1041 hidden' : '#1041', { alpha: fadeWindow(t, B.s3, B.deletes + 0.6, 0.3), size: 18, mono: true, below: true, offsetY: 30 });
    const w2 = POS.workers[1].clone().setY(1.0);
    hud.badge(w2.clone().setX(w2.x + 1.9), '✓ DELETE #1041', CSS.healthy, fadeWindow(t, B.deletes + 0.4, B.crash, 0.3), 0.55, 0);
    hud.badge(POS.workers[0].clone().setY(1.0).setX(POS.workers[0].x + 1.7), 'CRASH', CSS.failure, fadeWindow(t, this.crashedAt(), B.retry + 0.5, 0.2), 0.7, 0);
    hud.badge(w2.clone().setX(w2.x + 1.9), '✓ #1042 DONE', CSS.healthy, fadeWindow(t, B.retry + 2.4, B.rabbit + 0.5, 0.3), 0.55, 0);
    hud.badge(POS.queue.clone().setY(1.5), 'AT LEAST ONCE', CSS.warning, fadeWindow(t, B.atLeastOnce + 0.4, B.twice, 0.3), 0.8, 30);

    // Charged twice → idempotent.
    const pay = POS.payment.clone().setY(1.2);
    hud.badge(pay, '#1042 charged ×2', CSS.failure, fadeWindow(t, B.twice + 2.2, B.example + 1.2, 0.3), 0.55, 40);
    hud.badge(pay, '#1042 charged ×1 ✓', CSS.healthy, fadeWindow(t, B.example + 1.6, B.poison - 0.3, 0.3), 0.55, 40);
    const doneList = fadeWindow(t, B.example + 0.2, B.poison - 0.3, 0.3);
    if (doneList > 0) {
      const p = hud.project(POS.payment.clone().add(V(-0.9, 0, 1.6)));
      hud.roundRect(p.x, p.y - 70, 330, 140, 16, CSS.panel, CSS.healthy, doneList, 2);
      hud.text('already processed', p.x + 20, p.y - 40, { size: 18, weight: 600, color: CSS.muted, alpha: doneList });
      hud.text('#1040 ✓  #1041 ✓  #1042 ✓', p.x + 20, p.y - 6, { size: 20, mono: true, alpha: doneList });
      hud.text('#1042 again → skip', p.x + 20, p.y + 36, { size: 22, weight: 700, color: CSS.healthy, alpha: doneList * ramp(t, B.example + 1.0, B.example + 1.5) });
    }

    // Poison message: tries counter, then the dead-letter queue.
    const tries = this.flows[1].sim.deliveries.filter((d) => d.id === POISON_ID);
    tries.forEach((d, i) => {
      hud.badge(POS.workers[d.worker].clone().setY(1.0).setX(POS.workers[d.worker].x + 1.7), `✗ try ${i + 1}/3`, CSS.failure, fadeWindow(t, d.end, d.end + 1.4, 0.2), 0.55, 0);
    });
  }

  private drawSectionFour(hud: Hud, t: number) {
    this.tape.group.updateMatrixWorld(true);
    const events = this.logEvents(t);
    const tapeAlpha = fadeWindow(t, B.kafka + 0.6, B.partitions + 0.4, 0.4);
    hud.label(this.tape.slotPosition(0).setY(0.1), 'Log · Apache Kafka', { alpha: tapeAlpha, size: 22, accent: CSS.storage, below: true, offsetY: 50 });
    // Offsets under the first slots.
    for (let i = 0; i < Math.floor(events); i += 3) {
      hud.text(`${i}`, hud.project(this.tape.slotPosition(i).setY(0)).x, hud.project(this.tape.slotPosition(i).setY(0)).y + 26, { size: 16, mono: true, color: CSS.muted, align: 'center', alpha: tapeAlpha });
    }
    // Read heads: email reads fast, analytics slower; events stay.
    const heads = fadeWindow(t, B.keeps + 0.8, B.partitions + 0.4, 0.4);
    const emailAt = Math.min(events - 0.5, (t - B.keeps - 0.8) * 1.1);
    const analyticsAt = Math.min(events - 0.5, (t - B.keeps - 1.2) * 0.55);
    if (heads > 0) {
      const head = (offset: number, text: string, color: string, up: boolean) => {
        const i = clamp(Math.floor(offset), 0, LOG_SLOTS - 1);
        hud.label(this.tape.slotPosition(i), `${text} @ ${i}`, { alpha: heads, size: 18, mono: true, accent: color, offsetY: up ? 40 : 20, below: !up });
      };
      head(emailAt, 'email', CSS.network, true);
      head(analyticsAt, 'analytics', CSS.edge, false);
    }
    hud.badge(this.tape.slotPosition(8).setY(0.5), 'KEPT AFTER READING', CSS.storage, fadeWindow(t, B.bothSee + 2, B.retention, 0.3), 0.6, 60);
    const partsAlpha = fadeWindow(t, B.partitions + 0.6, B.standard - 0.2, 0.3);
    ['partition 0 · customer A', 'partition 1 · customer B', 'partition 2 · customer C'].forEach((text, r) => {
      this.partitions[r].group.updateMatrixWorld(true);
      hud.label(this.partitions[r].slotPosition(0).setY(0.1).setX(this.partitions[r].slotPosition(0).x - 1.5), text, { alpha: partsAlpha, size: 18, offsetY: 0 });
    });

    // Standard vs. FIFO ordering panel.
    const ordering = fadeWindow(t, B.standard + 0.3, B.s5 - 0.3, 0.4);
    if (ordering > 0) {
      const x = 560;
      const y = 150;
      hud.roundRect(x, y, 800, 190, 20, CSS.panel, CSS.panelBorder, ordering);
      const row = (label: string, order: number[], color: string, yy: number, a: number) => {
        hud.text(label, x + 30, yy, { size: 22, weight: 700, color, alpha: a });
        order.forEach((n, i) => {
          const cx = x + 360 + i * 76;
          const swapped = n !== i + 1;
          hud.roundRect(cx - 28, yy - 24, 56, 48, 10, 'rgba(5,8,15,0.6)', swapped ? CSS.warning : color, a, 2);
          hud.text(`${n}`, cx, yy + 1, { size: 24, weight: 800, mono: true, color: swapped ? CSS.warning : CSS.text, align: 'center', alpha: a });
        });
      };
      row('SQS standard · best effort', [1, 2, 4, 3, 5], CSS.network, y + 60, ordering);
      row('SQS FIFO · strict per group', [1, 2, 3, 4, 5], CSS.healthy, y + 130, ordering * ramp(t, B.fifo + 0.3, B.fifo + 0.9));
    }
  }

  private drawSectionFive(hud: Hud, t: number) {
    const flow = this.flows[3];
    const meter = fadeWindow(t, B.backlog + 0.4, B.dlqTrap, 0.4);
    const depth = flow.sim.depthAt(t);
    drawMeter(hud, POS.queue.clone().setY(1.6).setZ(-1.2), depth / 16, meter, { label: `waiting: ${Math.round(depth)}`, offsetY: 0 });
    drawCounter(hud, POS.queue.clone().setY(1.6).setZ(1.6), `oldest: ${flow.sim.oldestAgeAt(t).toFixed(0)} s`, fadeWindow(t, B.watch + 0.6, B.dlqTrap, 0.3), CSS.warning, 0);
    hud.badge(POS.workers[3].clone().setY(1.0).setX(POS.workers[3].x + 1.8), '+ WORKER', CSS.healthy, fadeWindow(t, WORKER4_JOINS(), WORKER4_JOINS() + 3, 0.3), 0.55, 0);

    // DLQ nobody watches: days tick by, then the messages expire.
    const bin = POS.dlq.clone().setY(1.0);
    const days = Math.min(4, 1 + Math.floor(progress(t, B.silence + 1, this.expireAt()) * 4));
    hud.badge(bin.clone().setX(bin.x + 2.2), `day ${days}`, CSS.muted, fadeWindow(t, B.silence + 1, this.expireAt() + 0.6, 0.3), 0.55, 0);
    hud.badge(bin.clone().setX(bin.x + 2.2), 'DELETED', CSS.failure, fadeWindow(t, this.expireAt() + 0.6, B.alarm + 0.4, 0.3), 0.55, 0);
    hud.badge(bin, 'ALARM · DLQ NOT EMPTY', CSS.warning, fadeWindow(t, B.alarm + 0.6, B.notDone, 0.3), 0.6, 40);

    // Received isn't done.
    const card = fadeWindow(t, B.notDone + 0.2, B.recap, 0.4);
    let status: { text: string; color: string } = { text: '✓ Order received', color: CSS.healthy };
    if (t >= B.status + 1) status = { text: 'Processing…', color: CSS.network };
    if (t >= B.status + 4) status = { text: '✓ Confirmed', color: CSS.healthy };
    this.orderCard(hud, CARD_MID_LEFT, card, 'Order #1042', status, t, { text: 'Later: "payment declined" email', color: CSS.warning, alpha: ramp(t, B.status + 6, B.status + 6.6) });
  }

  /** Where the mascot is (for its labels), if on stage. */
  private mascotAnchor() {
    return this.mascot.group.visible ? this.mascot.group.position.clone().setY(this.mascot.group.position.y + 0.95) : null;
  }

  dispose() {
    this.pool.dispose();
    this.mascot.dispose();
    for (const n of this.nodes) n.dispose();
    for (const a of this.arcs) a.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

