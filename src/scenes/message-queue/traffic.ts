/**
 * Every message flow in the episode, simulated once with QueueSim. Pure data
 * (no three.js), so the queue depths can be checked from Node.
 */
import { simulateQueue, steadyMessages, type QueueMessage, type QueueSimResult } from '../../components/QueueSim.ts';
import { B } from './beats.ts';

/** Visibility timeout in scene time (the real SQS default is 30 s; the crash beat shows that countdown separately). */
export const SCENE_TIMEOUT = 1.6;

export interface Flow {
  start: number;
  end: number;
  sim: QueueSimResult;
  messages: QueueMessage[];
}

const flow = (start: number, end: number, messages: QueueMessage[], workers: Parameters<typeof simulateQueue>[1], maxReceives?: number): Flow => ({
  start,
  end,
  messages,
  sim: simulateQueue(messages, workers, { timeout: SCENE_TIMEOUT, maxReceives, start, end: end + 6 }),
});

const range = (firstId: number, start: number, end: number, period: number, work: number) =>
  steadyMessages(firstId, start, Math.max(0, Math.ceil((end - start) / period)), period, work);

/** 2 · steady orders, a sale spike, the drain, a third worker, an email outage. */
export function sectionTwo(): Flow {
  const start = B.consumers + 0.8;
  const work = 1.2;
  const messages = [
    ...range(100, start, B.rush + 0.3, 1.1, work),
    ...range(200, B.rush + 0.3, B.drains, 0.36, work),
    ...range(300, B.drains, B.moreWorkers + 1, 2.2, work),
    ...range(400, B.moreWorkers + 1, B.emailDown + 1, 1.0, work),
    ...range(500, B.emailDown + 1, B.emailBack + 0.6, 0.45, work),
    ...range(600, B.emailBack + 0.6, B.s3 - 1, 1.2, work),
  ];
  const outage: [number, number] = [B.emailDown + 1.0, B.emailBack + 0.6];
  return flow(start, B.s3, messages, [
    { from: start - 0.5, pauses: [outage] },
    { from: start - 0.5, pauses: [outage] },
    { from: B.moreWorkers + 1.2, pauses: [outage] },
    { from: Infinity },
  ]);
}

/** 3 · background traffic after the crash story, with one poison message. */
export const POISON_ID = 999;
export function sectionThree(): Flow {
  const start = B.rabbit + 0.5;
  const messages: QueueMessage[] = [
    ...range(1500, start, B.poison, 1.5, 1.6),
    { id: POISON_ID, at: B.poison + 1.5, work: 0.8, poison: true },
    ...range(1600, B.poison + 2.3, B.s4 - 1, 1.6, 1.6),
  ];
  return flow(
    start,
    B.s4,
    messages,
    [{ from: B.rabbit + 3 }, { from: start - 0.5 }, { from: start - 0.5 }, { from: Infinity }],
    3,
  );
}

/** 4 · calm traffic while the log is explained. */
export function sectionFour(): Flow {
  const start = B.s4 + 0.3;
  return flow(start, B.s5, range(700, start, B.s5 - 1, 1.0, 1.5), [{ from: start - 0.5 }, { from: start - 0.5 }, { from: start - 0.5 }, { from: Infinity }]);
}

/** 5 · a backlog that grows until a fourth worker joins, then calm traffic to the end. */
export function sectionFive(): Flow {
  const start = B.s5 + 0.3;
  const work = 2.4;
  const joins = B.watch + 2.5;
  const messages = [
    ...range(800, start, B.grows - 0.5, 1.0, work),
    ...range(900, B.grows - 0.5, joins, 0.34, work),
    ...range(1000, joins, B.dlqTrap + 2, 1.6, work),
    ...range(1100, B.dlqTrap + 2, B.next - 1, 1.3, work),
  ];
  return flow(start, B.next, messages, [{ from: start - 0.5 }, { from: start - 0.5 }, { from: start - 0.5 }, { from: joins }]);
}

export const WORKER4_JOINS = () => B.watch + 2.5;
