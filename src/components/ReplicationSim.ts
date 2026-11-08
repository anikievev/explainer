/**
 * Deterministic primary → replicas simulation. Every write is committed on the
 * primary, then shipped to each replica, which applies it after `lag` seconds.
 *
 * - async: the primary confirms ("saved") as soon as it has committed.
 * - sync: the primary confirms only after replica 0 has the change and its
 *   confirmation is back, so every write waits one extra round trip.
 *
 * If the primary crashes at `crashAt`, a write is **lost** when it was
 * confirmed to the user but hadn't reached replica 0 (the one that gets
 * promoted). Pure function of its inputs, so the numbers on screen are correct
 * and identical on every render.
 */

export interface ReplicationWrite {
  /** Time the write reaches the primary. */
  at: number;
  id: string;
  /** Which app server sends it (for drawing). */
  server: number;
}

export interface ReplicationOptions {
  replicas: number;
  mode: 'async' | 'sync';
  /** Seconds a change takes to travel to replica r (one way). */
  lag: number | ((replica: number) => number);
  /** Seconds the primary needs to commit locally. */
  commit?: number;
  /** The primary crashes here: nothing is sent or confirmed after it. */
  crashAt?: number;
}

export interface WriteEvent extends ReplicationWrite {
  committedAt: number;
  /** When the user sees "saved" (Infinity if the primary died first). */
  ackAt: number;
  /** When each replica has applied it (Infinity if it never arrives). */
  arrivals: number[];
  /** Confirmed to the user, but never reached replica 0. */
  lost: boolean;
}

export interface ReplicationResult {
  events: WriteEvent[];
  /** Changes on their way to replica r at t. */
  inFlightAt(replica: number, t: number): number;
  /** Has replica r applied write `id` by t? */
  hasAt(replica: number, id: string, t: number): boolean;
  /** Confirmed writes missing from replica 0 once the primary has crashed (counted from the crash on). */
  lostAt(t: number): number;
}

export function simulateReplication(writes: ReplicationWrite[], opts: ReplicationOptions): ReplicationResult {
  const commit = opts.commit ?? 0;
  const crash = opts.crashAt ?? Infinity;
  const lagOf = (r: number) => (typeof opts.lag === 'number' ? opts.lag : opts.lag(r));

  const events: WriteEvent[] = [...writes]
    .sort((a, b) => a.at - b.at)
    .map((w) => {
      const committedAt = w.at + commit;
      // A write that wasn't committed before the crash never left the primary.
      const sent = committedAt <= crash;
      // A change still on its way when the primary dies never arrives (the stream is cut).
      const arrivals = Array.from({ length: opts.replicas }, (_, r) => {
        const arrive = committedAt + lagOf(r);
        return sent && arrive <= crash ? arrive : Infinity;
      });
      let ackAt = opts.mode === 'async' ? committedAt : arrivals[0] + lagOf(0);
      if (!sent || ackAt > crash) ackAt = Infinity;
      return { ...w, committedAt, ackAt, arrivals, lost: ackAt <= crash && arrivals[0] === Infinity };
    });

  return {
    events,
    inFlightAt: (r, t) => events.reduce((n, e) => n + (e.committedAt <= t && t < e.arrivals[r] && t < crash ? 1 : 0), 0),
    hasAt: (r, id, t) => events.some((e) => e.id === id && e.arrivals[r] <= t),
    lostAt: (t) => (t < crash ? 0 : events.filter((e) => e.lost).length),
  };
}

/** One write every `period` seconds in [start, end), cycling over servers. */
export function steadyWrites(start: number, end: number, period: number, prefix = 'w', servers = 3): ReplicationWrite[] {
  const out: ReplicationWrite[] = [];
  for (let i = 0, t = start; t < end; i++, t = start + i * period) out.push({ at: t, id: `${prefix}${i}`, server: (i * 2 + 1) % servers });
  return out;
}
