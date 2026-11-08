/**
 * Vertical Shorts cut from the full "How Database Sharding Works" render.
 * Times are looked up from cue text (like beats.ts), so they follow
 * `npm run retime`; each Short starts and ends on a cue boundary and stays
 * under 60 s.
 *
 * Every Short opens on its problem or payoff (`open`), never on setup: in the
 * first uploads 86–91% of feed viewers swiped away within the first seconds.
 */
import type { Short } from '../../components/Script.ts';
import { CUES } from './script.ts';

function cue(fragment: string) {
  const found = CUES.find((c) => c.text.includes(fragment));
  if (!found) throw new Error(`No cue contains "${fragment}"`);
  return found;
}
/** Start a little before the cue, end a little after it, so no word is clipped. */
const from = (fragment: string) => cue(fragment).start - 0.3;
const to = (fragment: string) => cue(fragment).end + 0.8;
const at = (fragment: string) => cue(fragment).start;
/** One or more whole cues, for a cold open. */
const clip = (first: string, last = first) => ({ start: from(first), end: cue(last).end + 0.2 });

const GREEN = '#34d399';
const YELLOW = '#fbbf24';
const RED = '#f87171';
const BLUE = '#38bdf8';
const PURPLE = '#a78bfa';

export const SHORTS: Short[] = [
  {
    slug: 'add-one-server-move-80-percent',
    // Open on the payoff: 800 of 1,000 keys flying to new shards.
    open: clip('Here are a thousand keys'),
    start: from("Sooner or later, four shards aren't enough"),
    end: to("That's 80 percent of the data on the move"),
    hook: 'Add one database. 80% of your data moves.',
    // Keys mid-flight with the "moved" counter climbing.
    cover: at('Here are a thousand keys') + 5,
    beats: [
      { at: at("Sooner or later, four shards aren't enough"), text: 'Add a fifth shard', color: PURPLE },
      { at: at('A simple way to pick a shard is the hash'), text: 'shard = hash % N', color: BLUE },
      { at: at('Go from four shards to five'), text: '% 4 → % 5', color: YELLOW },
      { at: at('Here are a thousand keys'), text: '800 of 1,000 keys move', color: RED },
    ],
    title: 'Add one database, move 80% of your data (hash % N sharding)',
    description:
      'With shard = hash(key) % N, going from four shards to five changes the answer for most keys: 800 of 1,000 keys have to move to a different shard, while the app is still running. The fixes: many small logical shards, or consistent hashing.',
    hashtags: ['#systemdesign', '#database', '#sharding'],
    // Sound test (2026-11): accents on every on-screen change. Compare "Stayed to watch" with the others.
    beatSounds: true,
    sfx: [
      { at: at("Sooner or later, four shards aren't enough") + 0.8, sound: 'whoosh' },
      { at: at('Here are a thousand keys') + 1.2, sound: 'scatter' },
      { at: at('Here are a thousand keys') + 3.4, sound: 'scatter' },
      { at: at('Here are a thousand keys') + 7.0, sound: 'alert' },
      { at: at("That's 80 percent of the data on the move") + 0.2, sound: 'alert' },
    ],
  },
  {
    slug: 'never-shard-by-timestamp',
    // Open on the problem: one red shard taking every write.
    open: clip("But every new order has today's date"),
    start: from('First try: the order date'),
    end: to('Second try: hash the order ID'),
    hook: 'Shard by date, and one shard takes every write.',
    // The "ALL WRITES" badge over the last shard, its bar maxed out.
    cover: at("But every new order has today's date") + 4,
    beats: [
      { at: at('First try: the order date'), text: 'Shard key: order date', color: BLUE },
      { at: at("But every new order has today's date"), text: 'Every write → last shard', color: RED },
      { at: at("MongoDB's docs warn about this"), text: 'Always increasing = hot shard', color: RED },
      { at: at('Second try: hash the order ID'), text: 'Hash it: even writes', color: GREEN },
    ],
    title: "Never shard by timestamp: the hot shard problem",
    description:
      "Shard orders by date, and every new order has today's date, so every write lands on the last shard while the others sit idle. MongoDB's docs warn that with an always-increasing shard key, one shard becomes the bottleneck for writes. Hashing the key spreads writes evenly.",
    hashtags: ['#systemdesign', '#database', '#mongodb'],
  },
  {
    slug: 'sharding-vs-replication',
    // Open on the comparison itself.
    open: clip('Compare that with replicas'),
    start: from('So the writes split up too'),
    end: to('Order 1042 belongs to customer 7'),
    hook: 'Replication vs sharding: what is the difference?',
    // The replicas-vs-shards panel.
    cover: at('Compare that with replicas') + 3.5,
    beats: [
      { at: at('So the writes split up too'), text: 'Writes split across shards', color: GREEN },
      { at: at('But how does a row find its shard'), text: 'Router + shard key', color: BLUE },
      { at: at('In MongoDB, that router is called mongos'), text: 'mongos · VTGate', color: BLUE },
      { at: at('Order 1042 belongs to customer 7'), text: 'customer 7 → shard 3', color: PURPLE },
    ],
    title: 'Sharding vs. replication in 40 seconds',
    description:
      'Every replica holds the same data. Shards hold different data, so the writes split up too. A router reads one field of each row, the shard key, and picks the shard. In MongoDB the router is mongos; Vitess, for MySQL, has VTGate.',
    hashtags: ['#systemdesign', '#database', '#sharding'],
  },
  {
    slug: 'why-notion-picked-480-shards',
    // Open on the surprising number.
    open: clip('They picked 480 because'),
    start: from("That's 80 percent of the data on the move"),
    end: to('Notion runs 480 logical shards'),
    hook: 'Why Notion runs exactly 480 shards.',
    // 480 small boxes moving to the new databases.
    cover: at('Notion runs 480 logical shards') + 7,
    beats: [
      { at: at("That's 80 percent of the data on the move"), text: 'Resharding moves data', color: RED },
      { at: at('One way out: create many small shards'), text: 'Many small logical shards', color: PURPLE },
      { at: at('Notion runs 480 logical shards'), text: '480 shards · 32 databases', color: GREEN },
    ],
    title: 'Why Notion picked 480 shards (logical sharding)',
    description:
      'Notion runs 480 logical shards on 32 physical databases. To grow, whole logical shards move to new machines and no key changes its shard. They picked 480 because it divides evenly in so many ways: 32 × 15, 40 × 12, 48 × 10.',
    hashtags: ['#systemdesign', '#database', '#postgresql'],
  },
];
