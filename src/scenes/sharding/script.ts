/**
 * "How Database Sharding Works" — narration script. Times are in seconds and drive
 * the animation beats, the voiceover placement and the exported .srt captions.
 * Timings come from the measured voiceover clips: natural length + 0.7 s, plus
 * `hold` where the animation needs time. Re-lock after editing text with
 * `npm run voiceover -- --episode sharding && npm run retime -- --episode sharding`.
 */
import type { Cue, Section } from '../../components/Script.ts';
import { findCue, findSection, toSrt as cuesToSrt } from '../../components/Script.ts';

export const DURATION = 348;

export const SECTIONS: Section[] = [
  { start: 0, end: 35, index: "", title: "Hook" },
  { start: 35, end: 85.7, index: "1", title: "Split the data" },
  { start: 85.7, end: 153.5, index: "2", title: "Picking the shard key" },
  { start: 153.5, end: 191, index: "3", title: "Queries across shards" },
  { start: 191, end: 245.5, index: "4", title: "The hot shard" },
  { start: 245.5, end: 307.4, index: "5", title: "Adding a shard" },
  { start: 307.4, end: 348, index: "✓", title: "Recap" },
];

export const CUES: Cue[] = [
  // Hook
  { start: 0.3, end: 6.1, text: "Black Friday. Orders pour in, and every order is a write.", hold: 0.5 },
  { start: 6.1, end: 13.1, text: "Last episode, replicas took the reads. But every write still goes to one primary.", hold: 0.5 },
  { start: 13.1, end: 19.5, text: "And every replica holds the whole database. The disks are filling up on all of them.", hold: 0.5 },
  { start: 19.5, end: 24.1, text: "Adding another replica won't help. The fix is sharding." },
  { start: 24.1, end: 33.8, text: "In six minutes: how to pick a shard key, why one shard can melt down, and why adding a database can move 80 percent of your data." },

  // Split the data
  { start: 35.3, end: 40.5, text: "Sharding splits one table across several databases, called shards." },
  { start: 40.5, end: 44.4, text: "Each shard holds a different slice of the rows.", hold: 0.5 },
  { start: 44.4, end: 52.1, text: "Compare that with replicas. Every replica holds the same data. Shards hold different data.", hold: 0.5 },
  { start: 52.1, end: 58.6, text: "So the writes split up too. Each shard only takes the writes for its own rows.", hold: 0.5 },
  { start: 58.6, end: 66, text: "But how does a row find its shard? A router reads one field, the shard key, and picks the shard." },
  { start: 66, end: 75.5, text: "In MongoDB, that router is called mongos. Vitess, for MySQL, has one called VTGate.", say: "In Mongo D B, that router is called Mongo S. Vitess, for My S Q L, has one called V T Gate." },
  { start: 75.5, end: 84.5, text: "Order 1042 belongs to customer 7. With the customer ID as the shard key, it goes to shard 3.", hold: 1.0 },

  // Picking the shard key
  { start: 86, end: 90.1, text: "Everything depends on that key. Let's try three." },
  { start: 90.1, end: 95.5, text: "First try: the order date. Each shard holds a range of dates." },
  { start: 95.5, end: 104.6, text: "But every new order has today's date. So every new write lands on the last shard, while the others sit idle.", hold: 1.0 },
  { start: 104.6, end: 113.2, text: "MongoDB's docs warn about this: with an always increasing key, one shard becomes the bottleneck for writes.", say: "Mongo D B's docs warn about this: with an always increasing key, one shard becomes the bottleneck for writes.", hold: 0.5 },
  { start: 113.2, end: 122.3, text: "Second try: hash the order ID. A hash scrambles the value, so orders spread evenly across the shards.", hold: 0.5 },
  { start: 122.3, end: 131.1, text: "Writes are balanced now. But ask for all of customer 7's orders, and the router has to ask every shard.", hold: 1.0 },
  { start: 131.1, end: 139.7, text: "Third try: the customer ID. Each customer's orders stay together, and customers spread across the shards.", hold: 0.5 },
  { start: 139.7, end: 144.4, text: "Notion shards its data the same way, by workspace.", hold: 0.5 },
  { start: 144.4, end: 152.3, text: "A good shard key has many different values, they're used about evenly, and it doesn't keep growing like a date.", hold: 0.5 },

  // Queries across shards
  { start: 153.8, end: 157.5, text: "Even with a good key, some questions don't fit." },
  { start: 157.5, end: 165.3, text: "Top products today needs everyone's orders. So the router asks every shard, and merges the answers.", hold: 0.5 },
  { start: 165.3, end: 173.6, text: "MongoDB calls this scatter gather. It can be slow, and it doesn't scale the way single shard queries do.", say: "Mongo D B calls this scatter gather. It can be slow, and it doesn't scale the way single shard queries do.", hold: 0.5 },
  { start: 173.6, end: 176.2, text: "Transactions get harder too." },
  { start: 176.2, end: 182.9, text: "Figma wrote that once transactions span shards, Postgres can no longer enforce them.", hold: 0.5 },
  { start: 182.9, end: 189.8, text: "They chose not to support transactions across shards at all, and worked around the failures instead.", hold: 0.5 },

  // The hot shard
  { start: 191.3, end: 196.7, text: "Now the customer key looks great. Until one customer gets huge." },
  { start: 196.7, end: 204.9, text: "A big seller runs a flash sale. Their orders all share one ID, so they all land on one shard.", hold: 0.5 },
  { start: 204.9, end: 210.3, text: "That shard turns red, while the others are fine.", hold: 1.0 },
  { start: 210.3, end: 218.7, text: "MongoDB's docs say it plainly: many different values don't, on their own, guarantee an even spread.", say: "Mongo D B's docs say it plainly: many different values don't, on their own, guarantee an even spread.", hold: 0.5 },
  { start: 218.7, end: 227.3, text: "And every shard has a limit. DynamoDB gives each partition at most a thousand write units per second.", say: "And every shard has a limit. Dynamo D B gives each partition at most a thousand write units per second.", hold: 0.5 },
  { start: 227.3, end: 236.6, text: "One fix: split the hot key. Add a suffix, one to four, so that seller's writes land on several shards.", hold: 1.0 },
  { start: 236.6, end: 244.3, text: "The cost: reading that seller's orders now means asking every piece, and merging.", hold: 0.5 },

  // Adding a shard
  { start: 245.8, end: 250.5, text: "Sooner or later, four shards aren't enough. Let's add a fifth." },
  { start: 250.5, end: 256.1, text: "A simple way to pick a shard is the hash, modulo the number of shards." },
  { start: 256.1, end: 261.1, text: "Go from four shards to five, and the answer changes for most keys." },
  { start: 261.1, end: 269.4, text: "Here are a thousand keys. Eight hundred of them now belong on a different shard, and have to move.", hold: 1.5 },
  { start: 269.4, end: 274.8, text: "That's 80 percent of the data on the move, while the shop is still running.", hold: 0.5 },
  { start: 274.8, end: 281.2, text: "One way out: create many small shards up front, and put several on each machine." },
  { start: 281.2, end: 293.1, text: "Notion runs 480 logical shards on 32 databases. To grow, whole shards move to new machines, and no key changes its shard.", hold: 1.0 },
  { start: 293.1, end: 298.6, text: "They picked 480 because it divides evenly in so many ways.", hold: 0.5 },
  { start: 298.6, end: 306.2, text: "MongoDB works in a similar way: a balancer moves chunks of data between shards in the background.", say: "Mongo D B works in a similar way: a balancer moves chunks of data between shards in the background.", hold: 0.5 },

  // Recap
  { start: 307.7, end: 309.2, text: "Let's recap." },
  { start: 309.2, end: 315.7, text: "Sharding splits the data, so each shard holds a slice and takes its own writes." },
  { start: 315.7, end: 324.1, text: "The shard key decides everything. A growing key makes a hot shard, and queries without the key ask every shard." },
  { start: 324.1, end: 330.2, text: "Adding shards moves data. Many small logical shards keep that manageable." },
  { start: 330.2, end: 339.7, text: "Next up: consistent hashing. Adding one shard moved 80 percent of the keys. What if it moved only a small slice?" },
  { start: 339.7, end: 344.1, text: "What would you pick as the shard key for your app? Tell me below." },
];

export const cueAt = (t: number) => findCue(CUES, t);
export const sectionAt = (t: number) => findSection(SECTIONS, t);
export const toSrt = () => cuesToSrt(CUES);
