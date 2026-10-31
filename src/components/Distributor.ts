/**
 * Deterministic load-balancing algorithms for animation. Given a list of
 * requests (arrival time, how long the server works on it, which client sent
 * it), returns which server handles each one. Pure functions, so counters and
 * packet paths on screen are exact and identical on every render.
 */

export interface Request {
  /** Time (s) the request reaches the load balancer. */
  at: number;
  /** Time (s) the server spends on it. */
  work: number;
  /** Client id, used by hashing. */
  client: number;
}

export type Algorithm =
  | { kind: 'round-robin' }
  | { kind: 'weighted'; weights: number[] }
  | { kind: 'least-connections' }
  | { kind: 'hash' };

export interface Assignment extends Request {
  server: number;
}

/** Assign every request to one of `servers` (indices 0..servers-1, skipping `down`). */
export function distribute(requests: Request[], servers: number, algorithm: Algorithm, down: number[] = []): Assignment[] {
  const up = Array.from({ length: servers }, (_, i) => i).filter((i) => !down.includes(i));
  if (up.length === 0) throw new Error('distribute: no servers up');

  // Weighted round robin as a repeating sequence: weights [1,1,2] → 0,1,2,2.
  const weightedOrder =
    algorithm.kind === 'weighted' ? up.flatMap((i) => Array.from({ length: algorithm.weights[i] ?? 1 }, () => i)) : [];

  const result: Assignment[] = [];
  requests.forEach((req, n) => {
    let server: number;
    switch (algorithm.kind) {
      case 'round-robin':
        server = up[n % up.length];
        break;
      case 'weighted':
        server = weightedOrder[n % weightedOrder.length];
        break;
      case 'hash':
        // Stable stand-in for hash(client IP) mod N.
        server = up[(client32(req.client) >>> 0) % up.length];
        break;
      case 'least-connections': {
        // Fewest requests still in progress when this one arrives; ties go to the lowest index.
        const active = up.map((i) => result.filter((a) => a.server === i && a.at + a.work > req.at).length);
        server = up[active.indexOf(Math.min(...active))];
        break;
      }
    }
    result.push({ ...req, server });
  });
  return result;
}

function client32(id: number) {
  let h = 2166136261 ^ id;
  h = Math.imul(h ^ (h >>> 13), 16777619);
  return h ^ (h >>> 16);
}

/** Requests that have arrived at their server by time t, per server. */
export function countsAt(assignments: Assignment[], t: number, servers: number, travel = 0): number[] {
  const counts = new Array<number>(servers).fill(0);
  for (const a of assignments) if (a.at + travel <= t) counts[a.server]++;
  return counts;
}

/** Requests a server is working on at time t, per server. */
export function activeAt(assignments: Assignment[], t: number, servers: number, travel = 0): number[] {
  const counts = new Array<number>(servers).fill(0);
  for (const a of assignments) if (a.at + travel <= t && t < a.at + travel + a.work) counts[a.server]++;
  return counts;
}

/** Evenly spaced requests from rotating clients: the common case in demos. */
export function steadyRequests(start: number, count: number, period: number, work: number, clients = 3): Request[] {
  return Array.from({ length: count }, (_, i) => ({ at: start + i * period, work, client: i % clients }));
}
