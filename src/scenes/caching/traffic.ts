/**
 * Every request flow in the episode, simulated once with CacheSim. Pure data
 * (no three.js), so hit ratios and database load can be checked from Node.
 */
import { simulateCache, steadyRequests, type CacheOptions, type CacheRequest, type CacheSimResult } from '../../components/CacheSim.ts';
import { B } from './beats.ts';

/** A database read in scene time (slowed down so the trips are visible). */
export const DB_READ = 0.9;
/** Reads the database handles comfortably at once (its load meter is full here). */
export const DB_CAPACITY = 6;
export const HOT = 'product:42';
export const GHOST = 'product:404';
/** 40 product keys for the cold-start trap. */
export const CATALOG = Array.from({ length: 40 }, (_, i) => `product:${i + 1}`);

export interface Flow {
  start: number;
  end: number;
  requests: CacheRequest[];
  sim: CacheSimResult;
}

const flow = (start: number, end: number, requests: CacheRequest[], opts: Partial<CacheOptions> = {}): Flow => ({
  start,
  end,
  requests,
  sim: simulateCache(requests, { fetch: DB_READ, ttl: 1e6, ...opts }),
});

/** Hook + section 1: no cache, every visit is a database read. Busy, calm, then the sale again. */
export function noCache(): Flow {
  const requests = [
    ...steadyRequests(B.sale + 0.5, B.lbAgo, 0.12),
    ...steadyRequests(B.lbAgo, B.thousands, 1.0),
    ...steadyRequests(B.thousands, B.remember + 0.8, 0.12),
  ];
  return flow(B.sale + 0.5, B.remember + 0.8, requests, { enabled: false });
}

/** Section 2: product 42 was just loaded (the scripted first miss); everyone after hits. */
export function warmCache(): Flow {
  const start = B.hit + 0.4;
  const requests = [...steadyRequests(start, B.micro, 0.9), ...steadyRequests(B.micro, B.s3 + 1.5, 0.22)];
  return flow(start, B.s3 + 1.5, requests, { prefill: { [HOT]: 1e6 } });
}

/** Trap 1: the hot key expires under heavy traffic, first without, then with coalescing. */
export const STAMPEDE_EXPIRE = () => B.stampede - 0.2;
/** Slow reads under a stampede, so the pile-up stays on screen. */
const STAMPEDE_READ = 2.4;
export const COALESCE_EXPIRE = () => B.coalesce + 2.4;
export function stampede(): Flow {
  const start = B.herd + 0.6;
  const end = B.coalesce - 0.2;
  return flow(start, end, steadyRequests(start, end, 0.11), { prefill: { [HOT]: 1e6 }, expire: [{ key: HOT, at: STAMPEDE_EXPIRE() }], fetch: STAMPEDE_READ });
}
export function coalesced(): Flow {
  const start = B.coalesce + 0.4;
  const end = B.missing - 0.2;
  return flow(start, end, steadyRequests(start, end, 0.11), { prefill: { [HOT]: 1e6 }, expire: [{ key: HOT, at: COALESCE_EXPIRE() }], coalesce: true, fetch: STAMPEDE_READ });
}

/** Trap 2: requests for a product that doesn't exist; negative caching switches on mid-way. */
export function ghostKey(): Flow {
  const start = B.p404 + 0.6;
  const end = B.depend - 0.2;
  return flow(start, end, steadyRequests(start, end, 0.3, [GHOST]), { missing: [GHOST], negative: { from: B.negative + 1.2, ttl: 1e6 } });
}

/** Trap 3: a warm cache restarts empty under steady traffic across the catalogue. */
export const RESTART_AT = () => B.restart + 1.0;
export function coldStart(): Flow {
  const start = B.depend + 0.4;
  const end = B.recap - 0.5;
  const prefill = Object.fromEntries(CATALOG.map((k) => [k, 1e6]));
  return flow(start, end, steadyRequests(start, end, 0.1, CATALOG), { prefill, flushAt: [RESTART_AT()] });
}

export function allFlows() {
  return { noCache: noCache(), warm: warmCache(), stampede: stampede(), coalesced: coalesced(), ghost: ghostKey(), cold: coldStart() };
}
