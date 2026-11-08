/**
 * Every write flow in the episode, simulated once with ReplicationSim. Pure
 * data (no three.js), so lost-write counts can be checked from Node.
 * Times are scene time: replication is slowed down so changes are visible on
 * the wire. On-screen numbers that refer to real systems are labelled
 * "example" / "slow motion".
 */
import { simulateReplication, steadyWrites, type ReplicationResult, type ReplicationWrite } from '../../components/ReplicationSim.ts';
import { B } from './beats.ts';

export interface WriteFlow {
  start: number;
  end: number;
  writes: ReplicationWrite[];
  sim: ReplicationResult;
}

/** One-way trip primary → replica, scene time. */
export const LAG = 2.2;

/** Sections 1–2: steady writes, copied to both replicas. */
export function background(): WriteFlow {
  const writes = steadyWrites(B.primary + 0.6, B.s3, 1.3, 'bg');
  return { start: B.primary + 0.6, end: B.s3, writes, sim: simulateReplication(writes, { replicas: 2, mode: 'async', lag: LAG }) };
}

/** Section 4, async: writes keep coming; the primary crashes with changes on the wire. */
export const ASYNC_CRASH = () => B.crash + 2.6;
export function asyncCrash(): WriteFlow {
  const writes = steadyWrites(B.asyncMode + 0.4, ASYNC_CRASH(), 0.75, 'a');
  return {
    start: B.asyncMode + 0.4,
    end: ASYNC_CRASH() + 0.1,
    writes,
    sim: simulateReplication(writes, { replicas: 2, mode: 'async', lag: (r) => LAG + 0.6 * r, crashAt: ASYNC_CRASH() }),
  };
}

/** Section 4, sync: every save waits for replica 0's confirmation; the crash loses nothing confirmed. */
export const SYNC_RT = 1.1;
export const SYNC_CRASH = () => B.syncSafe + 1.4;
export function syncCrash(): WriteFlow {
  const writes = steadyWrites(B.syncMode + 0.4, SYNC_CRASH(), 0.9, 's');
  return {
    start: B.syncMode + 0.4,
    end: SYNC_CRASH() + 0.1,
    writes,
    sim: simulateReplication(writes, { replicas: 2, mode: 'sync', lag: (r) => (r === 0 ? SYNC_RT : LAG), crashAt: SYNC_CRASH() }),
  };
}

export function allFlows() {
  return { background: background(), asyncCrash: asyncCrash(), syncCrash: syncCrash() };
}
