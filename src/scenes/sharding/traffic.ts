/**
 * Every write stream in the episode, simulated once with ShardSim. Pure data
 * (no three.js), so the per-shard rates on screen can be checked from Node.
 * Rates are illustrative ("example" on screen); the routing is computed.
 */
import { orderStream, rehash, writeRates, type OrderWrite, type ShardKey } from '../../components/ShardSim.ts';
import { B } from './beats.ts';

/** Writes per second into the router (scene time). */
export const RATE = 8;
/** A shard's capacity in the same units: above this it is overloaded. */
export const CAPACITY = 6;
/** On-screen rates are shown ×100 and labelled "example". */
export const DISPLAY_SCALE = 100;
/** The big seller in section 4 (customer 12 → shard 2). */
export const HOT_CUSTOMER = 12;
/** Customer 7 owns order 1042 (→ shard 3). */
export const CUSTOMER_7 = 7;

export interface Phase {
  key: ShardKey;
  start: number;
  end: number;
  writes: OrderWrite[];
}

export function phases(): Phase[] {
  const mk = (key: ShardKey, start: number, end: number, opts: Parameters<typeof orderStream>[3] = {}): Phase => ({ key, start, end, writes: orderStream(start, end, RATE, opts) });
  return [
    // Section 1: writes split across the shards (by customer, as decided in the end).
    mk('customer', B.writesSplit + 0.6, B.s2),
    // Section 2: three shard keys.
    mk('date', B.date + 1.0, B.hash),
    mk('hash', B.hash + 1.0, B.customer),
    mk('customer', B.customer + 1.0, B.flash + 1.0),
    // Section 4: one customer takes 70% of the writes, then their key is split.
    mk('customer', B.flash + 1.0, B.suffix + 1.6, { hotCustomer: HOT_CUSTOMER, hotShare: 0.7, firstOrder: 9000 }),
    mk('customerSplit', B.suffix + 1.6, B.s5, { hotCustomer: HOT_CUSTOMER, hotShare: 0.7, splitInto: 4, firstOrder: 9500 }),
  ];
}

export const phaseAt = (all: Phase[], t: number) => all.find((p) => t >= p.start && t < p.end + 1.5) ?? null;

/** Per-shard load (0..1+) and displayed rate at t. */
export function loadsAt(all: Phase[], t: number, shards = 4) {
  const p = phaseAt(all, t);
  if (!p) return { loads: new Array(shards).fill(0), rates: new Array(shards).fill(0) };
  const r = writeRates(p.writes, p.key, Math.min(t, p.end), shards);
  return { loads: r.map((x) => x / CAPACITY), rates: r.map((x) => x * DISPLAY_SCALE) };
}

/**
 * Section 5: 1,000 keys, hash % 4 → hash % 5. Drawn as 20 blocks of 50 keys
 * each, so they stay readable; 16 of 20 blocks move = 800 of 1,000 keys.
 */
export const KEYS = 1000;
export const BLOCKS = 20;
export const KEYS_PER_BLOCK = KEYS / BLOCKS;
export const REHASH = rehash(BLOCKS, 4, 5);
