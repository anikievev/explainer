/**
 * Deterministic cache-aside simulation: every request looks up its key in the
 * cache. A hit is answered from memory; a miss asks the database (taking
 * `fetch` seconds) and then stores the answer with a TTL. With coalescing, a
 * request for a key that is already being fetched waits for that answer
 * instead of asking the database again. Keys the database doesn't have are
 * only cached as "not found" once negative caching is on. Pure function of its
 * inputs, so the numbers on screen are correct and identical on every render.
 */

export interface CacheRequest {
  /** Time the request reaches the cache. */
  at: number;
  key: string;
  /** Which app server sends it (for drawing). */
  server: number;
}

export interface CacheOptions {
  /** Seconds a database read takes (scene time). */
  fetch: number;
  /** TTL (s) for stored answers. */
  ttl: number;
  /** Set false to send every request straight to the database (no cache). */
  enabled?: boolean;
  /** Only one database read per key at a time; other requests wait for it. */
  coalesce?: boolean;
  /** Keys the database doesn't have. */
  missing?: string[];
  /** From this time on, "not found" answers are cached too, with this TTL. */
  negative?: { from: number; ttl: number };
  /** Keys already in the cache at the start, with their expiry time. */
  prefill?: Record<string, number>;
  /** Forced expiry of one key at a time (a scripted TTL running out). */
  expire?: Array<{ key: string; at: number }>;
  /** The cache restarts empty at these times. */
  flushAt?: number[];
}

export type Outcome = 'hit' | 'miss' | 'wait';

export interface CacheEvent extends CacheRequest {
  outcome: Outcome;
  /** For a miss: the database read [at, at + fetch]. For a wait: when the answer arrives. */
  doneAt: number;
  /** A miss that found nothing in the database. */
  notFound: boolean;
}

export interface CacheSimResult {
  events: CacheEvent[];
  /** Database reads in progress at t. */
  dbReadsAt(t: number): number;
  /** Share of hits (waits count as hits: no extra database read) among requests in [from, t]. */
  hitRatioAt(t: number, from: number): number;
}

interface Entry {
  readyAt: number;
  expiresAt: number;
}

export function simulateCache(requests: CacheRequest[], opts: CacheOptions): CacheSimResult {
  const enabled = opts.enabled ?? true;
  const missing = new Set(opts.missing ?? []);
  const entries = new Map<string, Entry>();
  for (const [key, expiresAt] of Object.entries(opts.prefill ?? {})) entries.set(key, { readyAt: -Infinity, expiresAt });
  const expire = [...(opts.expire ?? [])].sort((a, b) => a.at - b.at);
  const flushes = [...(opts.flushAt ?? [])].sort((a, b) => a - b);
  const events: CacheEvent[] = [];

  for (const req of [...requests].sort((a, b) => a.at - b.at)) {
    while (flushes.length && flushes[0] <= req.at) {
      entries.clear();
      flushes.shift();
    }
    while (expire.length && expire[0].at <= req.at) {
      const e = entries.get(expire[0].key);
      if (e && e.readyAt <= expire[0].at) e.expiresAt = Math.min(e.expiresAt, expire[0].at);
      expire.shift();
    }
    const notFound = missing.has(req.key);
    const entry = enabled ? entries.get(req.key) : undefined;
    if (entry && entry.readyAt <= req.at && req.at < entry.expiresAt) {
      events.push({ ...req, outcome: 'hit', doneAt: req.at, notFound });
      continue;
    }
    if (entry && opts.coalesce && req.at < entry.readyAt) {
      events.push({ ...req, outcome: 'wait', doneAt: entry.readyAt, notFound });
      continue;
    }
    const doneAt = req.at + opts.fetch;
    events.push({ ...req, outcome: 'miss', doneAt, notFound });
    if (!enabled) continue;
    const cacheNotFound = opts.negative !== undefined && req.at >= opts.negative.from;
    if (notFound && !cacheNotFound) continue;
    const ttl = notFound ? opts.negative!.ttl : opts.ttl;
    // Without coalescing, misses pile up while one read is in flight; the first answer to land is the one stored.
    const prev = entries.get(req.key);
    if (!prev || prev.readyAt <= req.at) entries.set(req.key, { readyAt: doneAt, expiresAt: doneAt + ttl });
  }

  const reads = events.filter((e) => e.outcome === 'miss');
  return {
    events,
    dbReadsAt: (t) => reads.reduce((n, e) => n + (e.at <= t && t < e.doneAt ? 1 : 0), 0),
    hitRatioAt(t, from) {
      let hits = 0;
      let all = 0;
      for (const e of events) {
        if (e.at < from || e.at > t) continue;
        all++;
        if (e.outcome !== 'miss') hits++;
      }
      return all ? hits / all : 0;
    },
  };
}

/** Requests every `period` seconds in [start, end), cycling over keys and servers. */
export function steadyRequests(start: number, end: number, period: number, keys: string[] = ['product:42'], servers = 3): CacheRequest[] {
  const out: CacheRequest[] = [];
  for (let i = 0, t = start; t < end; i++, t = start + i * period) {
    out.push({ at: t, key: keys[i % keys.length], server: (i * 2 + Math.floor(i / 3)) % servers });
  }
  return out;
}
