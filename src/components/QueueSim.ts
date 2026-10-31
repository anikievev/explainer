/**
 * Deterministic message-queue simulation: messages arrive, wait until a
 * worker is free, are hidden while a worker holds them (visibility timeout),
 * and are deleted when the job succeeds. A crash or a failed job makes the
 * message visible again after the timeout; after `maxReceives` receives it
 * moves to the dead-letter queue instead. Pure function of its inputs, so the
 * numbers on screen are correct and identical on every render.
 */

export interface QueueMessage {
  id: number;
  /** Time the message lands in the queue. */
  at: number;
  /** Seconds of work once a worker has it. */
  work: number;
  /** Fails on every attempt (a "poison" message). */
  poison?: boolean;
}

export interface WorkerSpec {
  /** Online from this time... */
  from: number;
  /** ...until this time (exclusive). */
  to?: number;
  /** Windows where the worker finishes its current job but takes no new one (e.g. a service it calls is down). */
  pauses?: Array<[number, number]>;
  /** The worker crashes at this time, dropping its current job, and stays down until `restartAt`. */
  crashAt?: number;
  restartAt?: number;
}

export interface Delivery {
  id: number;
  worker: number;
  start: number;
  end: number;
  outcome: 'done' | 'crashed' | 'failed';
  /** 1 for the first receive, 2 for the first retry, ... */
  receive: number;
}

export interface SimOptions {
  /** Visibility timeout (s, in scene time). */
  timeout: number;
  /** Move to the dead-letter queue when a message would be received more than this many times. */
  maxReceives?: number;
  start: number;
  end: number;
  /** Simulation step and sample interval (s). */
  dt?: number;
}

export interface QueueSimResult {
  deliveries: Delivery[];
  dead: Array<{ id: number; at: number }>;
  /** Visible messages waiting in the queue at t. */
  depthAt(t: number): number;
  /** Messages held (hidden) by a worker at t. */
  inFlightAt(t: number): number;
  /** Age (s) of the oldest waiting message at t, 0 when the queue is empty. */
  oldestAgeAt(t: number): number;
  /** Whether worker i is online and not crashed at t. */
  workerUp(i: number, t: number): boolean;
}

interface State {
  msg: QueueMessage;
  visibleAt: number;
  receives: number;
  finished: boolean;
}

const inWindow = (t: number, [a, b]: [number, number]) => t >= a && t < b;

export function workerOnline(w: WorkerSpec, t: number) {
  if (t < w.from || (w.to !== undefined && t >= w.to)) return false;
  if (w.crashAt !== undefined && t >= w.crashAt && (w.restartAt === undefined || t < w.restartAt)) return false;
  return true;
}

export function simulateQueue(messages: QueueMessage[], workers: WorkerSpec[], opts: SimOptions): QueueSimResult {
  const dt = opts.dt ?? 0.05;
  const maxReceives = opts.maxReceives ?? Infinity;
  const states: State[] = [...messages].sort((a, b) => a.at - b.at || a.id - b.id).map((msg) => ({ msg, visibleAt: msg.at, receives: 0, finished: false }));
  const busy: Array<{ state: State; delivery: Delivery } | null> = workers.map(() => null);
  const deliveries: Delivery[] = [];
  const dead: Array<{ id: number; at: number }> = [];
  const depth: number[] = [];
  const inFlight: number[] = [];
  const oldest: number[] = [];
  const steps = Math.ceil((opts.end - opts.start) / dt);

  for (let k = 0; k <= steps; k++) {
    const t = opts.start + k * dt;

    // Running jobs: crash, finish, or fail.
    workers.forEach((w, i) => {
      const job = busy[i];
      if (!job) return;
      const { state, delivery } = job;
      if (w.crashAt !== undefined && t >= w.crashAt && delivery.start < w.crashAt) {
        delivery.end = w.crashAt;
        delivery.outcome = 'crashed';
        state.visibleAt = delivery.start + opts.timeout;
        busy[i] = null;
      } else if (t >= delivery.start + state.msg.work) {
        if (state.msg.poison) {
          delivery.outcome = 'failed';
          state.visibleAt = delivery.start + opts.timeout;
        } else {
          state.finished = true;
        }
        busy[i] = null;
      }
    });

    // Free workers take the oldest visible message.
    workers.forEach((w, i) => {
      if (busy[i] || !workerOnline(w, t) || w.pauses?.some((p) => inWindow(t, p))) return;
      for (const state of states) {
        if (state.finished || state.visibleAt > t || busy.some((b) => b?.state === state)) continue;
        if (state.receives >= maxReceives) {
          state.finished = true;
          dead.push({ id: state.msg.id, at: t });
          continue;
        }
        state.receives++;
        const delivery: Delivery = { id: state.msg.id, worker: i, start: t, end: t + state.msg.work, outcome: 'done', receive: state.receives };
        deliveries.push(delivery);
        busy[i] = { state, delivery };
        break;
      }
    });

    let waiting = 0;
    let oldestAt = Infinity;
    for (const state of states) {
      if (state.finished || state.visibleAt > t || busy.some((b) => b?.state === state)) continue;
      waiting++;
      oldestAt = Math.min(oldestAt, state.msg.at);
    }
    depth.push(waiting);
    inFlight.push(busy.filter(Boolean).length);
    oldest.push(waiting ? t - oldestAt : 0);
  }

  const sample = (series: number[], t: number) => {
    const x = (t - opts.start) / dt;
    if (x <= 0) return series[0] ?? 0;
    if (x >= series.length - 1) return series[series.length - 1] ?? 0;
    const i = Math.floor(x);
    return series[i] + (series[i + 1] - series[i]) * (x - i);
  };

  return {
    deliveries,
    dead,
    depthAt: (t) => (t < opts.start || t > opts.end ? 0 : sample(depth, t)),
    inFlightAt: (t) => (t < opts.start || t > opts.end ? 0 : sample(inFlight, t)),
    oldestAgeAt: (t) => (t < opts.start || t > opts.end ? 0 : sample(oldest, t)),
    workerUp: (i, t) => workerOnline(workers[i], t),
  };
}

/** `count` messages, one every `period` seconds from `start`. */
export function steadyMessages(firstId: number, start: number, count: number, period: number, work: number): QueueMessage[] {
  return Array.from({ length: count }, (_, i) => ({ id: firstId + i, at: start + i * period, work }));
}
