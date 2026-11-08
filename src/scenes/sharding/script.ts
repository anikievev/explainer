/**
 * "How Database Sharding Works" — narration script. Times are in seconds and drive
 * the animation beats, the voiceover placement and the exported .srt captions.
 * Timings come from the measured voiceover clips: natural length + 0.7 s, plus
 * `hold` where the animation needs time. Re-lock after editing text with
 * `npm run voiceover -- --episode sharding && npm run retime -- --episode sharding`.
 */
import type { Cue, Section } from '../../components/Script.ts';
import { findCue, findSection, toSrt as cuesToSrt } from '../../components/Script.ts';

export const DURATION = 345;

export const SECTIONS: Section[] = [
  { start: 0, end: 32.3, index: "", title: "Hook" },
  { start: 32.3, end: 83, index: "1", title: "Split the data" },
  { start: 83, end: 150.8, index: "2", title: "Picking the shard key" },
  { start: 150.8, end: 188.3, index: "3", title: "Queries across shards" },
  { start: 188.3, end: 242.8, index: "4", title: "The hot shard" },
  { start: 242.8, end: 304.7, index: "5", title: "Adding a shard" },
  { start: 304.7, end: 345, index: "✓", title: "Recap" },
];

export const CUES: Cue[] = [
  // Hook
  { start: 0.3, end: 4, text: "Black Friday. Every order is a write." },
  { start: 4, end: 9.2, text: "And every write lands on one database server: the primary.", hold: 0.5 },
  { start: 9.2, end: 17, text: "Replicas copy everything, so each one is just as full. The disks are filling up on all of them.", hold: 0.5 },
  { start: 17, end: 21.4, text: "Another replica won't help. The fix is sharding." },
  { start: 21.4, end: 31.1, text: "In six minutes: how to pick a shard key, why one shard can melt down, and why adding a database can move 80 percent of your data." },

  // Split the data
  { start: 32.6, end: 37.8, text: "Sharding splits one table across several databases, called shards." },
  { start: 37.8, end: 41.7, text: "Each shard holds a different slice of the rows.", hold: 0.5 },
  { start: 41.7, end: 49.4, text: "Compare that with replicas. Every replica holds the same data. Shards hold different data.", hold: 0.5 },
  { start: 49.4, end: 55.9, text: "So the writes split up too. Each shard only takes the writes for its own rows.", hold: 0.5 },
  { start: 55.9, end: 63.3, text: "But how does a row find its shard? A router reads one field, the shard key, and picks the shard." },
  { start: 63.3, end: 72.8, text: "In MongoDB, that router is called mongos. Vitess, for MySQL, has one called VTGate.", say: "In Mongo D B, that router is called Mongo S. Vitess, for My S Q L, has one called V T Gate." },
  { start: 72.8, end: 81.8, text: "Order 1042 belongs to customer 7. With the customer ID as the shard key, it goes to shard 3.", hold: 1.0 },

  // Picking the shard key
  { start: 83.3, end: 87.4, text: "Everything depends on that key. Let's try three." },
  { start: 87.4, end: 92.8, text: "First try: the order date. Each shard holds a range of dates." },
  { start: 92.8, end: 101.9, text: "But every new order has today's date. So every new write lands on the last shard, while the others sit idle.", hold: 1.0 },
  { start: 101.9, end: 110.5, text: "MongoDB's docs warn about this: with an always increasing key, one shard becomes the bottleneck for writes.", say: "Mongo D B's docs warn about this: with an always increasing key, one shard becomes the bottleneck for writes.", hold: 0.5 },
  { start: 110.5, end: 119.6, text: "Second try: hash the order ID. A hash scrambles the value, so orders spread evenly across the shards.", hold: 0.5 },
  { start: 119.6, end: 128.4, text: "Writes are balanced now. But ask for all of customer 7's orders, and the router has to ask every shard.", hold: 1.0 },
  { start: 128.4, end: 137, text: "Third try: the customer ID. Each customer's orders stay together, and customers spread across the shards.", hold: 0.5 },
  { start: 137, end: 141.7, text: "Notion shards its data the same way, by workspace.", hold: 0.5 },
  { start: 141.7, end: 149.6, text: "A good shard key has many different values, they're used about evenly, and it doesn't keep growing like a date.", hold: 0.5 },

  // Queries across shards
  { start: 151.1, end: 154.8, text: "Even with a good key, some questions don't fit." },
  { start: 154.8, end: 162.6, text: "Top products today needs everyone's orders. So the router asks every shard, and merges the answers.", hold: 0.5 },
  { start: 162.6, end: 170.9, text: "MongoDB calls this scatter gather. It can be slow, and it doesn't scale the way single shard queries do.", say: "Mongo D B calls this scatter gather. It can be slow, and it doesn't scale the way single shard queries do.", hold: 0.5 },
  { start: 170.9, end: 173.5, text: "Transactions get harder too." },
  { start: 173.5, end: 180.2, text: "Figma wrote that once transactions span shards, Postgres can no longer enforce them.", hold: 0.5 },
  { start: 180.2, end: 187.1, text: "They chose not to support transactions across shards at all, and worked around the failures instead.", hold: 0.5 },

  // The hot shard
  { start: 188.6, end: 194, text: "Now the customer key looks great. Until one customer gets huge." },
  { start: 194, end: 202.2, text: "A big seller runs a flash sale. Their orders all share one ID, so they all land on one shard.", hold: 0.5 },
  { start: 202.2, end: 207.6, text: "That shard turns red, while the others are fine.", hold: 1.0 },
  { start: 207.6, end: 216, text: "MongoDB's docs say it plainly: many different values don't, on their own, guarantee an even spread.", say: "Mongo D B's docs say it plainly: many different values don't, on their own, guarantee an even spread.", hold: 0.5 },
  { start: 216, end: 224.6, text: "And every shard has a limit. DynamoDB gives each partition at most a thousand write units per second.", say: "And every shard has a limit. Dynamo D B gives each partition at most a thousand write units per second.", hold: 0.5 },
  { start: 224.6, end: 233.9, text: "One fix: split the hot key. Add a suffix, one to four, so that seller's writes land on several shards.", hold: 1.0 },
  { start: 233.9, end: 241.6, text: "The cost: reading that seller's orders now means asking every piece, and merging.", hold: 0.5 },

  // Adding a shard
  { start: 243.1, end: 247.8, text: "Sooner or later, four shards aren't enough. Let's add a fifth." },
  { start: 247.8, end: 253.4, text: "A simple way to pick a shard is the hash, modulo the number of shards." },
  { start: 253.4, end: 258.4, text: "Go from four shards to five, and the answer changes for most keys." },
  { start: 258.4, end: 266.7, text: "Here are a thousand keys. Eight hundred of them now belong on a different shard, and have to move.", hold: 1.5 },
  { start: 266.7, end: 272.1, text: "That's 80 percent of the data on the move, while the shop is still running.", hold: 0.5 },
  { start: 272.1, end: 278.5, text: "One way out: create many small shards up front, and put several on each machine." },
  { start: 278.5, end: 290.4, text: "Notion runs 480 logical shards on 32 databases. To grow, whole shards move to new machines, and no key changes its shard.", hold: 1.0 },
  { start: 290.4, end: 295.9, text: "They picked 480 because it divides evenly in so many ways.", hold: 0.5 },
  { start: 295.9, end: 303.5, text: "MongoDB works in a similar way: a balancer moves chunks of data between shards in the background.", say: "Mongo D B works in a similar way: a balancer moves chunks of data between shards in the background.", hold: 0.5 },

  // Recap
  { start: 305, end: 306.5, text: "Let's recap." },
  { start: 306.5, end: 313, text: "Sharding splits the data, so each shard holds a slice and takes its own writes." },
  { start: 313, end: 321.4, text: "The shard key decides everything. A growing key makes a hot shard, and queries without the key ask every shard." },
  { start: 321.4, end: 327.5, text: "Adding shards moves data. Many small logical shards keep that manageable." },
  { start: 327.5, end: 337, text: "Next up: consistent hashing. Adding one shard moved 80 percent of the keys. What if it moved only a small slice?" },
  { start: 337, end: 341.4, text: "What would you pick as the shard key for your app? Tell me below." },
];

export const cueAt = (t: number) => findCue(CUES, t);
export const sectionAt = (t: number) => findSection(SECTIONS, t);
export const toSrt = () => cuesToSrt(CUES);
