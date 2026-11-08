/**
 * Deterministic sharding model. Routes order writes to shards under different
 * shard keys, measures per-shard write rates, and counts which keys move when
 * the number of shards changes. Pure functions (no three.js, no randomness),
 * so every bar and counter on screen is computed and identical on each render.
 */

export type ShardKey = 'date' | 'hash' | 'customer' | 'customerSplit';

export interface OrderWrite {
  /** Time the write reaches the router. */
  at: number;
  orderId: number;
  customer: number;
  /** Day of the year the order was placed (all orders in a burst are "today"). */
  day: number;
  /** Suffix 1..n when a hot customer's key is split (customerSplit). */
  suffix: number;
}

/** A deterministic scramble of 0..n-1 (a permutation when gcd(7, n) = 1): our "hash". */
export const scramble = (k: number, n = 1000) => (k * 7 + 3) % n;

/** Which shard a customer ID lands on, for `shards` shards. */
export const customerShard = (customer: number, shards: number) => (customer * 3 + 1) % shards;

/** Ranges of days per shard under the date key: equal slices of the year. */
export const dateShard = (day: number, shards: number) => Math.min(shards - 1, Math.floor((day / 366) * shards));

export function route(w: OrderWrite, key: ShardKey, shards = 4): number {
  switch (key) {
    case 'date':
      return dateShard(w.day, shards);
    case 'hash':
      return scramble(w.orderId) % shards;
    case 'customer':
      return customerShard(w.customer, shards);
    case 'customerSplit':
      // A split key "customer#suffix" spreads one customer over consecutive shards.
      return (customerShard(w.customer, shards) + Math.max(0, w.suffix - 1)) % shards;
  }
}

export interface StreamOptions {
  /** First order ID; IDs increase by one per write. */
  firstOrder?: number;
  /** Today, as a day of the year. Black Friday 2026 is day 331 (Nov 27). */
  today?: number;
  /** One customer takes this share of the writes (0..1) from `hotFrom` on. */
  hotCustomer?: number;
  hotShare?: number;
  hotFrom?: number;
  /** Split the hot customer's key into this many suffixes. */
  splitInto?: number;
}

/** A steady stream of orders: `rate` writes per second in [start, end). */
export function orderStream(start: number, end: number, rate: number, opts: StreamOptions = {}): OrderWrite[] {
  const out: OrderWrite[] = [];
  const period = 1 / rate;
  let others = 0;
  for (let i = 0, t = start; t < end; i++, t = start + i * period) {
    const hot = opts.hotCustomer !== undefined && t >= (opts.hotFrom ?? -Infinity) && (i * 7) % 10 < Math.round((opts.hotShare ?? 0) * 10);
    // Everyone else: customers 1..400, visited in a scrambled but even order.
    const customer = hot ? opts.hotCustomer! : 1 + ((others++ * 37 + 11) % 400);
    const suffix = hot && opts.splitInto ? 1 + (i % opts.splitInto) : 0;
    out.push({ at: t, orderId: (opts.firstOrder ?? 5000) + i, customer, day: opts.today ?? 331, suffix });
  }
  return out;
}

/** Writes per second each shard received in the `window` seconds before t. */
export function writeRates(writes: OrderWrite[], key: ShardKey, t: number, shards = 4, window = 2): number[] {
  const rates = new Array<number>(shards).fill(0);
  for (const w of writes) if (w.at <= t && w.at > t - window) rates[route(w, key, shards)] += 1 / window;
  return rates;
}

/** Keys 0..n-1 placed with scramble(k) % from, then % to: which ones change shard. */
export function rehash(n: number, from: number, to: number) {
  const before = Array.from({ length: n }, (_, k) => scramble(k, n) % from);
  const after = Array.from({ length: n }, (_, k) => scramble(k, n) % to);
  const moved = before.map((b, k) => b !== after[k]);
  return { before, after, moved, count: moved.filter(Boolean).length };
}

/** Logical shards on hosts: shard i lives on host i % hosts (even spread when hosts divides shards). */
export function logicalPlacement(logicalShards: number, hosts: number): number[] {
  return Array.from({ length: logicalShards }, (_, i) => i % hosts);
}
